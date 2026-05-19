'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
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

export function init(workspaceDir?: string) {
    const dir =
        workspaceDir ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!dir) {
        return;
    }
    repoDir = dir;
    fossilSCM = vscode.scm.createSourceControl(
        'fossil',
        'Fossil',
        vscode.Uri.file(repoDir)
    );
    workingTree = fossilSCM.createResourceGroup('workingTree', 'Changes');
    workingTree.hideWhenEmpty = true;
}

enum Operation {
    Add = 'added',
    Delete = 'deleted',
    Modify = 'modified',
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
        if (line.length === 0) {
            continue;
        }
        if (line.startsWith('DELETED')) {
            const relativePath = line.substring(8).trim();
            states.push({
                resourceUri: createResourceUri(relativePath),
                decorations: {
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
                },
            });
        } else if (line.startsWith('EDITED')) {
            const relativePath = line.substring(8).trim();
            states.push({
                resourceUri: createResourceUri(relativePath),
                decorations: {
                    tooltip: 'Modified',
                    dark: {
                        iconPath: getIconPath(Operation.Modify, ThemeType.Dark),
                    },
                    light: {
                        iconPath: getIconPath(
                            Operation.Modify,
                            ThemeType.Light
                        ),
                    },
                },
            });
        } else if (line.startsWith('ADDED')) {
            const relativePath = line.substring(6).trim();
            states.push({
                resourceUri: createResourceUri(relativePath),
                decorations: {
                    tooltip: 'Added',
                    dark: {
                        iconPath: getIconPath(Operation.Add, ThemeType.Dark),
                    },
                    light: {
                        iconPath: getIconPath(Operation.Add, ThemeType.Light),
                    },
                },
            });
        }
    }

    workingTree.resourceStates = states;
    fossilSCM.count = states.length;
}

export function activate(context: vscode.ExtensionContext) {
    extensionPath = context.extensionPath;
    init();
    console.log('fossil-scm extension activated.');

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
