'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
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

const execFileAsync = promisify(execFile);

let extensionPath = '';
let repoDir = '';
let fossilSCM: vscode.SourceControl;
let workingTree: vscode.SourceControlResourceGroup;
let quickDiffProvider: FossilQuickDiffProvider;
const statusByRelativePath = new Map<string, FileStatusEntry>();
const emptyRenameMap = new Map<string, string>();

function createResourceUri(relativePath: string): vscode.Uri {
    const absolutePath = path.join(repoDir, relativePath);
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
        return;
    }
    if (repoDir === dir && fossilSCM) {
        return;
    }
    repoDir = dir;
    if (!fossilSCM) {
        fossilSCM = vscode.scm.createSourceControl(
            'fossil',
            'Fossil',
            vscode.Uri.file(repoDir)
        );
        workingTree = fossilSCM.createResourceGroup('workingTree', 'Changes');
        workingTree.hideWhenEmpty = true;
        quickDiffProvider = new FossilQuickDiffProvider(
            repoDir,
            () => statusByRelativePath
        );
        fossilSCM.quickDiffProvider = quickDiffProvider;
    } else {
        quickDiffProvider = new FossilQuickDiffProvider(
            repoDir,
            () => statusByRelativePath
        );
        fossilSCM.quickDiffProvider = quickDiffProvider;
    }
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
        command: {
            command: 'fossil.openChange',
            title: 'Open Change',
            arguments: [resourceUri, type, repoDir, priorPath],
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
    if (!repoDir) {
        return;
    }

    const fossilExePath = vscode.workspace
        .getConfiguration('fossilScm')
        .get<string>('fossilExePath', 'fossil');

    let stdout: string;
    try {
        const result = await execFileAsync(fossilExePath, ['status'], {
            cwd: repoDir,
        });
        stdout = result.stdout;
    } catch (err: unknown) {
        const execErr = err as { stderr?: string; message?: string };
        console.log('Could not execute command.');
        console.log(`stderr: ${execErr.stderr ?? execErr.message}`);
        console.log(`Repository directory: ${repoDir}`);
        return;
    }

    statusByRelativePath.clear();

    const states: vscode.SourceControlResourceState[] = [];
    let renameMap: Map<string, string> | undefined;

    for (const line of stdout.split('\n')) {
        const parsed = parseStatusLine(line);
        if (!parsed) {
            continue;
        }
        const { type, relativePath: rawPath } = parsed;
        if (type === 'RENAMED' && renameMap === undefined) {
            renameMap = await fetchRenameMap(fossilExePath, repoDir);
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
}

export function activate(context: vscode.ExtensionContext) {
    extensionPath = context.extensionPath;
    registerFossilContentProvider(context);
    registerOpenChangeCommand(context);
    init();
    void getFossilStatus();
    console.log('fossil-scm extension activated.');

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            init();
            void getFossilStatus();
        })
    );

    const fsWatcher = vscode.workspace.createFileSystemWatcher('**');
    fsWatcher.onDidChange(() => {
        void getFossilStatus();
    });
    fsWatcher.onDidCreate(() => {
        void getFossilStatus();
    });
    fsWatcher.onDidDelete(() => {
        void getFossilStatus();
    });

    const disposable = vscode.commands.registerCommand(
        'extension.fossilSCM',
        () => {
            void getFossilStatus();
        }
    );

    context.subscriptions.push(disposable);
    context.subscriptions.push(fsWatcher);
}

export function deactivate() {}
