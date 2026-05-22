'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    registerFossilContentProvider,
    notifyFossilContentChanged,
} from './fossilContentProvider';
import { registerOpenChangeCommand } from './openChange';
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
import { createStatusRefreshScheduler } from './statusRefresh';

export { getRepoDir } from './repoContext';

let extensionPath = '';
let fossilSCM: vscode.SourceControl;
let workingTree: vscode.SourceControlResourceGroup;
let quickDiffProvider: FossilQuickDiffProvider;
const statusByRelativePath = new Map<string, FileStatusEntry>();
const emptyRenameMap = new Map<string, string>();

function setCheckoutContext(): void {
    void vscode.commands.executeCommand(
        'setContext',
        'fossil.hasCheckout',
        Boolean(getRepoDir())
    );
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

function findFossilWorkspaceDir(): string | undefined {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const root = folder.uri.fsPath;
        if (
            fs.existsSync(path.join(root, '.fslckout')) ||
            fs.existsSync(path.join(root, '_FOSSIL_'))
        ) {
            return root;
        }
    }
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function init(workspaceDir?: string) {
    const dir = workspaceDir ?? findFossilWorkspaceDir();
    if (!dir) {
        setRepoDir('');
        setCheckoutContext();
        return;
    }
    if (getRepoDir() === dir && fossilSCM) {
        setCheckoutContext();
        return;
    }
    setRepoDir(dir);
    if (!fossilSCM) {
        fossilSCM = vscode.scm.createSourceControl(
            'fossil',
            'Fossil',
            vscode.Uri.file(getRepoDir())
        );
        workingTree = fossilSCM.createResourceGroup('workingTree', 'Changes');
        workingTree.hideWhenEmpty = true;
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
}

enum Operation {
    Add = 'added',
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

/** Fossil status lines: "<TYPE>  <path>" (padding varies by type). */
const STATUS_LINE =
    /^(DELETED|EDITED|ADDED|UNMANAGE|EXTRA|RENAMED|CONFLICT)\s+(.+)$/;

function parseStatusLine(line: string): { type: string; relativePath: string } | null {
    const match = STATUS_LINE.exec(line);
    if (!match) {
        return null;
    }
    return { type: match[1], relativePath: match[2].trim() };
}

function contextValueForType(type: string): string {
    return type.toLowerCase();
}

export function getStateCount(): number {
    return fossilSCM?.count ?? 0;
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
                tooltip: 'Conflict',
                dark: {
                    iconPath: getIconPath(Operation.Modify, ThemeType.Dark),
                },
                light: {
                    iconPath: getIconPath(Operation.Modify, ThemeType.Light),
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

export async function getFossilStatus(): Promise<void> {
    if (!getRepoDir() || !workingTree) {
        return;
    }

    let stdout: string;
    try {
        const result = await runFossil(['status', '--differ'], getRepoDir());
        stdout = result.stdout;
    } catch (err: unknown) {
        const message =
            err instanceof FossilCommandError
                ? err.stderr
                : err instanceof Error
                  ? err.message
                  : String(err);
        console.log('Could not execute fossil status.');
        console.log(`stderr: ${message}`);
        console.log(`Repository directory: ${getRepoDir()}`);
        return;
    }

    statusByRelativePath.clear();

    const states: vscode.SourceControlResourceState[] = [];
    let renameMap: Map<string, string> | undefined;
    const fossilExePath = getFossilExePath();

    for (const line of stdout.split('\n')) {
        const parsed = parseStatusLine(line);
        if (!parsed) {
            continue;
        }
        const { type, relativePath: rawPath } = parsed;
        if (type === 'RENAMED' && renameMap === undefined) {
            renameMap = await fetchRenameMap(fossilExePath, getRepoDir());
        }
        const normalizedPath = normalizeRelativePath(rawPath);
        const resourceUri = createResourceUri(rawPath);
        states.push(
            buildResourceState(
                resourceUri,
                type,
                normalizedPath,
                renameMap ?? emptyRenameMap
            )
        );
    }

    workingTree.resourceStates = states;
    fossilSCM.count = states.length;
    notifyFossilContentChanged();
    notifyFossilTimelineChanged();
}

export function activate(context: vscode.ExtensionContext) {
    extensionPath = context.extensionPath;
    registerFossilContentProvider(context);
    registerOpenChangeCommand(context);
    registerViewTimelineCommand(context);
    registerFossilTimelineProvider(context);
    registerTimelineCommands(context);
    init();

    const statusScheduler = createStatusRefreshScheduler(
        () => getFossilStatus()
    );
    context.subscriptions.push({ dispose: () => statusScheduler.dispose() });

    registerFossilScmCommands(context, {
        getRepoDir,
        getFossilSCM,
        refreshFossilStatusNow: () => statusScheduler.refreshNow(),
    });

    void statusScheduler.refreshNow();
    console.log('fossil-scm extension activated.');

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            init();
            void statusScheduler.refreshNow();
        })
    );

    const fsWatcher = vscode.workspace.createFileSystemWatcher('**');
    fsWatcher.onDidChange(() => statusScheduler.schedule());
    fsWatcher.onDidCreate(() => statusScheduler.schedule());
    fsWatcher.onDidDelete(() => statusScheduler.schedule());
    context.subscriptions.push(fsWatcher);
}

export function deactivate() {}
