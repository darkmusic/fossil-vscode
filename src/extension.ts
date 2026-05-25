'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import {
    registerFossilContentProvider,
    notifyFossilContentChanged,
} from './fossilContentProvider';
import { registerOpenChangeCommand } from './openChange';
import { openInMergeEditor } from './mergeConflict';
import { fetchRenameMap } from './renameInfo';
import {
    FossilQuickDiffProvider,
    FileStatusEntry,
} from './fossilQuickDiffProvider';
import { normalizeRelativePath } from './paths';
import { getRepoDir, setRepoDir } from './repoContext';
import { registerViewTimelineCommand } from './viewTimeline';
import {
    registerFossilTimelineProvider,
    notifyFossilTimelineChanged,
    registerTimelineCommands,
} from './fossilTimelineProvider';
import { getFossilExePath, runFossil, FossilCommandError } from './fossilCli';
import { registerFossilScmCommands } from './fossilScmCommands';
import { registerFossilUi, disposeFossilUi } from './fossilUi';
import { createStatusRefreshScheduler } from './statusRefresh';
import { registerFossilLog, logError, logInfo } from './fossilLog';
import { isUnmanagedStatus } from './statusGroups';
import { parseStatusOutput } from './statusParse';
import {
    clearScmOperationContexts,
    setFossilContext,
} from './scmOperationState';
import { findFossilWorkspaceDir } from './fossilCheckoutDiscovery';

export { getRepoDir } from './repoContext';

let extensionPath = '';
let fossilSCM: vscode.SourceControl;
let trackedGroup: vscode.SourceControlResourceGroup;
let unmanagedGroup: vscode.SourceControlResourceGroup;
let missingGroup: vscode.SourceControlResourceGroup;
let mergeConflicts: vscode.SourceControlResourceGroup;
let quickDiffProvider: FossilQuickDiffProvider;
const statusByRelativePath = new Map<string, FileStatusEntry>();
const emptyRenameMap = new Map<string, string>();

function setCheckoutContext(): void {
    setFossilContext('fossil.hasCheckout', Boolean(getRepoDir()));
    if (!getRepoDir()) {
        setFossilContext('fossil.uiRunning', false);
        clearScmOperationContexts();
    }
}

function getFossilSCM(): vscode.SourceControl | undefined {
    return fossilSCM;
}

function setupScmInputBox(): void {
    if (!fossilSCM) {
        return;
    }
    fossilSCM.inputBox.placeholder = 'Commit message';
    fossilSCM.acceptInputCommand = {
        command: 'fossil.commit',
        title: 'Commit',
        arguments: [],
    };
}

function createResourceUri(relativePath: string): vscode.Uri {
    const absolutePath = path.join(getRepoDir(), relativePath);
    return vscode.Uri.file(absolutePath);
}

function activeEditorFilePath(): string | undefined {
    const uri = vscode.window.activeTextEditor?.document.uri;
    return uri?.scheme === 'file' ? uri.fsPath : undefined;
}

export function init(workspaceDir?: string) {
    const dir =
        workspaceDir ??
        findFossilWorkspaceDir(
            vscode.workspace.workspaceFolders,
            activeEditorFilePath()
        );
    if (!dir) {
        setRepoDir('');
        setCheckoutContext();
        logInfo('No Fossil checkout found in workspace.');
        return;
    }
    if (getRepoDir() === dir && fossilSCM) {
        setCheckoutContext();
        return;
    }
    const repoChanged = Boolean(fossilSCM) && getRepoDir() !== dir;
    setRepoDir(dir);
    if (repoChanged && fossilSCM) {
        logInfo(`Fossil checkout changed to ${dir}`);
    }
    if (!fossilSCM) {
        fossilSCM = vscode.scm.createSourceControl(
            'fossil',
            'Fossil',
            vscode.Uri.file(getRepoDir())
        );
        trackedGroup = fossilSCM.createResourceGroup(
            'tracked',
            'In Checkout'
        );
        trackedGroup.hideWhenEmpty = true;
        unmanagedGroup = fossilSCM.createResourceGroup(
            'unmanaged',
            'Not in Checkout'
        );
        unmanagedGroup.hideWhenEmpty = true;
        missingGroup = fossilSCM.createResourceGroup('missing', 'Missing');
        missingGroup.hideWhenEmpty = true;
        mergeConflicts = fossilSCM.createResourceGroup(
            'merge',
            'Merge Conflicts'
        );
        mergeConflicts.hideWhenEmpty = true;
        setupScmInputBox();
        quickDiffProvider = new FossilQuickDiffProvider(
            getRepoDir(),
            () => statusByRelativePath
        );
        fossilSCM.quickDiffProvider = quickDiffProvider;
    } else {
        quickDiffProvider = new FossilQuickDiffProvider(
            getRepoDir(),
            () => statusByRelativePath
        );
        fossilSCM.quickDiffProvider = quickDiffProvider;
    }
    setCheckoutContext();
    logInfo(`Fossil checkout: ${dir}`);
}

export function getStatusGroupCounts(): {
    tracked: number;
    unmanaged: number;
    missing: number;
    merge: number;
} {
    return {
        tracked: trackedGroup?.resourceStates.length ?? 0,
        unmanaged: unmanagedGroup?.resourceStates.length ?? 0,
        missing: missingGroup?.resourceStates.length ?? 0,
        merge: mergeConflicts?.resourceStates.length ?? 0,
    };
}

enum Operation {
    Add = 'added',
    Conflict = 'conflict',
    Delete = 'deleted',
    Modify = 'modified',
    Untracked = 'untracked',
}

enum ThemeType {
    Light = 'light',
    Dark = 'dark',
}

function getIconPath(operation: Operation, themeType: ThemeType): string {
    return path.join(
        extensionPath,
        'resources/icons/' + themeType + '/status-' + operation + '.svg'
    );
}

function contextValueForType(type: string): string {
    return type.toLowerCase();
}

export function getStateCount(): number {
    return fossilSCM?.count ?? 0;
}

export function getConflictCount(): number {
    let count = 0;
    for (const entry of statusByRelativePath.values()) {
        if (entry.type === 'CONFLICT') {
            count++;
        }
    }
    return count;
}

export function getMissingCount(): number {
    return missingGroup?.resourceStates.length ?? 0;
}

function buildResourceState(
    resourceUri: vscode.Uri,
    type: string,
    normalizedPath: string,
    renameMap: Map<string, string>
): vscode.SourceControlResourceState {
    const priorPath =
        type === 'RENAMED' ? renameMap.get(normalizedPath) : undefined;

    statusByRelativePath.set(normalizedPath, {
        type,
        priorPath,
    });

    return {
        resourceUri,
        contextValue: contextValueForType(type),
        command: {
            command: 'fossil.openChange',
            title: 'Open Change',
            arguments: [resourceUri, type, getRepoDir(), priorPath],
        },
        decorations: getDecorations(type),
    };
}

function getDecorations(
    type: string
): vscode.SourceControlResourceState['decorations'] {
    switch (type) {
        case 'MISSING':
            return {
                strikeThrough: true,
                tooltip: 'Missing (deleted locally)',
                faded: true,
                dark: {
                    iconPath: getIconPath(Operation.Delete, ThemeType.Dark),
                },
                light: {
                    iconPath: getIconPath(
                        Operation.Delete,
                        ThemeType.Light
                    ),
                },
            };
        case 'DELETED':
            return {
                strikeThrough: true,
                tooltip: 'Deleted',
                faded: true,
                dark: {
                    iconPath: getIconPath(Operation.Delete, ThemeType.Dark),
                },
                light: {
                    iconPath: getIconPath(
                        Operation.Delete,
                        ThemeType.Light
                    ),
                },
            };
        case 'EDITED':
            return {
                tooltip: 'Modified',
                dark: {
                    iconPath: getIconPath(Operation.Modify, ThemeType.Dark),
                },
                light: {
                    iconPath: getIconPath(Operation.Modify, ThemeType.Light),
                },
            };
        case 'CONFLICT':
            return {
                tooltip: 'Merge conflict',
                dark: {
                    iconPath: getIconPath(
                        Operation.Conflict,
                        ThemeType.Dark
                    ),
                },
                light: {
                    iconPath: getIconPath(
                        Operation.Conflict,
                        ThemeType.Light
                    ),
                },
            };
        case 'ADDED':
            return {
                tooltip: 'Added',
                dark: {
                    iconPath: getIconPath(Operation.Add, ThemeType.Dark),
                },
                light: {
                    iconPath: getIconPath(Operation.Add, ThemeType.Light),
                },
            };
        case 'UNMANAGE':
        case 'EXTRA':
            return {
                tooltip: 'Unmanaged',
                dark: {
                    iconPath: getIconPath(
                        Operation.Untracked,
                        ThemeType.Dark
                    ),
                },
                light: {
                    iconPath: getIconPath(
                        Operation.Untracked,
                        ThemeType.Light
                    ),
                },
            };
        case 'RENAMED':
            return {
                tooltip: 'Renamed',
                dark: {
                    iconPath: getIconPath(Operation.Modify, ThemeType.Dark),
                },
                light: {
                    iconPath: getIconPath(Operation.Modify, ThemeType.Light),
                },
            };
        default:
            return { tooltip: type };
    }
}

function pushResourceState(
    state: vscode.SourceControlResourceState,
    type: string,
    trackedStates: vscode.SourceControlResourceState[],
    unmanagedStates: vscode.SourceControlResourceState[],
    missingStates: vscode.SourceControlResourceState[],
    conflictStates: vscode.SourceControlResourceState[]
): void {
    if (type === 'CONFLICT') {
        conflictStates.push(state);
    } else if (type === 'MISSING') {
        missingStates.push(state);
    } else if (isUnmanagedStatus(type)) {
        unmanagedStates.push(state);
    } else {
        trackedStates.push(state);
    }
}

export async function getFossilStatus(): Promise<void> {
    if (
        !getRepoDir() ||
        !trackedGroup ||
        !unmanagedGroup ||
        !missingGroup ||
        !mergeConflicts
    ) {
        return;
    }

    let differStdout: string;
    let missingStdout: string;
    try {
        const [differResult, missingResult] = await Promise.all([
            runFossil(['status', '--differ'], getRepoDir()),
            runFossil(['status', '--missing'], getRepoDir()),
        ]);
        differStdout = differResult.stdout;
        missingStdout = missingResult.stdout;
    } catch (err: unknown) {
        const message =
            err instanceof FossilCommandError
                ? err.stderr
                : err instanceof Error
                  ? err.message
                  : String(err);
        logError(`Could not execute fossil status: ${message}`);
        return;
    }

    statusByRelativePath.clear();

    const trackedStates: vscode.SourceControlResourceState[] = [];
    const unmanagedStates: vscode.SourceControlResourceState[] = [];
    const missingStates: vscode.SourceControlResourceState[] = [];
    const conflictStates: vscode.SourceControlResourceState[] = [];
    const seenPaths = new Set<string>();
    let renameMap: Map<string, string> | undefined;
    const fossilExePath = getFossilExePath();

    const processEntries = async (
        entries: ReturnType<typeof parseStatusOutput>
    ): Promise<void> => {
        for (const { type, relativePath: rawPath } of entries) {
            const normalizedPath = normalizeRelativePath(rawPath);
            if (seenPaths.has(normalizedPath)) {
                continue;
            }
            seenPaths.add(normalizedPath);
            if (type === 'RENAMED' && renameMap === undefined) {
                renameMap = await fetchRenameMap(fossilExePath, getRepoDir());
            }
            const resourceUri = createResourceUri(rawPath);
            const state = buildResourceState(
                resourceUri,
                type,
                normalizedPath,
                renameMap ?? emptyRenameMap
            );
            pushResourceState(
                state,
                type,
                trackedStates,
                unmanagedStates,
                missingStates,
                conflictStates
            );
        }
    };

    await processEntries(parseStatusOutput(differStdout));
    await processEntries(parseStatusOutput(missingStdout));

    trackedGroup.resourceStates = trackedStates;
    unmanagedGroup.resourceStates = unmanagedStates;
    missingGroup.resourceStates = missingStates;
    mergeConflicts.resourceStates = conflictStates;
    fossilSCM.count =
        trackedStates.length +
        unmanagedStates.length +
        missingStates.length +
        conflictStates.length;
    logInfo(
        `Status: ${trackedStates.length} in checkout, ${unmanagedStates.length} not in checkout, ${missingStates.length} missing, ${conflictStates.length} merge conflict(s).`
    );
    notifyFossilContentChanged();
    notifyFossilTimelineChanged();
}

export function activate(context: vscode.ExtensionContext) {
    extensionPath = context.extensionPath;
    registerFossilLog(context);
    registerFossilContentProvider(context);
    registerOpenChangeCommand(context);
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'fossil.openMergeEditor',
            async (arg: unknown) => {
                let uri: vscode.Uri | undefined;

                // Extract URI from SourceControlResourceState (single or from array for multi-select)
                if (Array.isArray(arg) && arg.length > 0) {
                    const first = arg[0];
                    if (first && typeof first === 'object' && 'resourceUri' in first) {
                        uri = (first as vscode.SourceControlResourceState).resourceUri;
                    } else if (first instanceof vscode.Uri) {
                        uri = first as vscode.Uri;
                    }
                } else if (arg && typeof arg === 'object' && 'resourceUri' in arg) {
                    // Single SourceControlResourceState
                    uri = (arg as vscode.SourceControlResourceState).resourceUri;
                } else if (arg instanceof vscode.Uri) {
                    // Direct Uri
                    uri = arg as vscode.Uri;
                }

                // Fallback to active editor
                if (!uri) {
                    uri = vscode.window.activeTextEditor?.document.uri;
                }

                if (!uri || uri.scheme !== 'file') {
                    logInfo('Open merge editor: no file selected.');
                    void vscode.window.showWarningMessage(
                        'Select a conflicted file to open in the merge editor.'
                    );
                    return;
                }

                logInfo(`Open merge editor: ${uri.fsPath}`);
                const opened = await openInMergeEditor(uri);
                if (!opened) {
                    await vscode.commands.executeCommand(
                        'vscode.open',
                        uri
                    );
                    logInfo(
                        'Merge sidecar files not found; opened working file for inline conflict resolution.'
                    );
                    void vscode.window.showInformationMessage(
                        'Merge sidecar files not found; opened working file for inline conflict resolution.'
                    );
                } else {
                    logInfo('Opened file in merge editor.');
                }
            }
        )
    );
    registerViewTimelineCommand(context);
    try {
        registerFossilTimelineProvider(context);
        registerTimelineCommands(context);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError(`Fossil timeline provider unavailable: ${message}`);
    }
    init();

    const statusScheduler = createStatusRefreshScheduler(
        () => getFossilStatus()
    );
    context.subscriptions.push({ dispose: () => statusScheduler.dispose() });

    registerFossilScmCommands(context, {
        getRepoDir,
        getFossilSCM,
        getConflictCount,
        getMissingCount,
        refreshFossilStatusNow: () => statusScheduler.refreshNow(),
    });
    registerFossilUi(context, getRepoDir);

    void statusScheduler.refreshNow();
    logInfo('fossil-scm extension activated.');

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            init();
            void statusScheduler.refreshNow();
        }),
        vscode.window.onDidChangeActiveTextEditor(() => {
            const previous = getRepoDir();
            init();
            if (getRepoDir() && getRepoDir() !== previous) {
                void statusScheduler.refreshNow();
            }
        })
    );

    const fsWatcher = vscode.workspace.createFileSystemWatcher('**');
    fsWatcher.onDidChange(() => statusScheduler.schedule());
    fsWatcher.onDidCreate(() => statusScheduler.schedule());
    fsWatcher.onDidDelete(() => statusScheduler.schedule());
    context.subscriptions.push(fsWatcher);
}

export function deactivate() {
    disposeFossilUi();
}
