'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let extensionPath = '';
let repoDir = '';
let fossilSCM: vscode.SourceControl;
let workingTree: vscode.SourceControlResourceGroup;

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

    const states: vscode.SourceControlResourceState[] = [];

    for (const line of stdout.split('\n')) {
        const parsed = parseStatusLine(line);
        if (!parsed) {
            continue;
        }
        const { type, relativePath } = parsed;
        const resourceUri = createResourceUri(relativePath);

        switch (type) {
            case 'DELETED':
                states.push({
                    resourceUri,
                    decorations: {
                        strikeThrough: true,
                        tooltip: 'Deleted',
                        faded: true,
                        dark: {
                            iconPath: getIconPath(
                                Operation.Delete,
                                ThemeType.Dark
                            ),
                        },
                        light: {
                            iconPath: getIconPath(
                                Operation.Delete,
                                ThemeType.Light
                            ),
                        },
                    },
                });
                break;
            case 'EDITED':
            case 'CONFLICT':
                states.push({
                    resourceUri,
                    decorations: {
                        tooltip:
                            type === 'CONFLICT' ? 'Conflict' : 'Modified',
                        dark: {
                            iconPath: getIconPath(
                                Operation.Modify,
                                ThemeType.Dark
                            ),
                        },
                        light: {
                            iconPath: getIconPath(
                                Operation.Modify,
                                ThemeType.Light
                            ),
                        },
                    },
                });
                break;
            case 'ADDED':
                states.push({
                    resourceUri,
                    decorations: {
                        tooltip: 'Added',
                        dark: {
                            iconPath: getIconPath(Operation.Add, ThemeType.Dark),
                        },
                        light: {
                            iconPath: getIconPath(
                                Operation.Add,
                                ThemeType.Light
                            ),
                        },
                    },
                });
                break;
            case 'UNMANAGE':
            case 'EXTRA':
                states.push({
                    resourceUri,
                    decorations: {
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
                    },
                });
                break;
            case 'RENAMED':
                states.push({
                    resourceUri,
                    decorations: {
                        tooltip: 'Renamed',
                        dark: {
                            iconPath: getIconPath(
                                Operation.Modify,
                                ThemeType.Dark
                            ),
                        },
                        light: {
                            iconPath: getIconPath(
                                Operation.Modify,
                                ThemeType.Light
                            ),
                        },
                    },
                });
                break;
        }
    }

    workingTree.resourceStates = states;
    fossilSCM.count = states.length;
}

export function activate(context: vscode.ExtensionContext) {
    extensionPath = context.extensionPath;
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
