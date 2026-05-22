'use strict';

import * as vscode from 'vscode';
import { FossilCommandError, runFossil, relativePathFromResourceUri } from './fossilCli';
import { toAbsolutePathInsideRepo } from './paths';

export interface FossilScmCommandDeps {
    getRepoDir: () => string;
    getFossilSCM: () => vscode.SourceControl | undefined;
    getConflictCount: () => number;
    refreshFossilStatusNow: () => Promise<void>;
}

function isResourceState(
    arg: unknown
): arg is vscode.SourceControlResourceState {
    return (
        typeof arg === 'object' &&
        arg !== null &&
        'resourceUri' in arg &&
        (arg as vscode.SourceControlResourceState).resourceUri instanceof
            vscode.Uri
    );
}

function visitArgs(arg: unknown, visit: (item: unknown) => void): void {
    if (Array.isArray(arg)) {
        for (const item of arg) {
            visitArgs(item, visit);
        }
        return;
    }
    visit(arg);
}

function resolveResourceStates(args: unknown[]): vscode.SourceControlResourceState[] {
    const states: vscode.SourceControlResourceState[] = [];
    for (const arg of args) {
        visitArgs(arg, (item) => {
            if (isResourceState(item)) {
                states.push(item);
            }
        });
    }
    return states;
}

function resolveRelativePaths(
    args: unknown[],
    repoDir: string
): string[] {
    const states = resolveResourceStates(args);
    if (states.length > 0) {
        const paths = states.map((s) =>
            relativePathFromResourceUri(s.resourceUri, repoDir)
        );
        return [...new Set(paths)];
    }
    const paths: string[] = [];
    for (const arg of args) {
        visitArgs(arg, (item) => {
            if (item instanceof vscode.Uri && item.scheme === 'file') {
                paths.push(relativePathFromResourceUri(item, repoDir));
            }
        });
    }
    return [...new Set(paths)];
}

async function runFossilOnPaths(
    fossilArgs: string[],
    relativePaths: string[],
    repoDir: string
): Promise<void> {
    const absolutePaths: string[] = [];
    for (const relativePath of relativePaths) {
        const absolute = toAbsolutePathInsideRepo(repoDir, relativePath);
        if (absolute !== undefined) {
            absolutePaths.push(absolute);
        }
    }
    if (absolutePaths.length === 0) {
        void vscode.window.showWarningMessage(
            relativePaths.length === 0
                ? 'No files selected.'
                : 'Selected files are outside the Fossil checkout.'
        );
        return;
    }
    await runFossil([...fossilArgs, ...absolutePaths], repoDir);
}

function showFossilError(err: unknown): void {
    const message =
        err instanceof FossilCommandError
            ? err.stderr
            : err instanceof Error
              ? err.message
              : String(err);
    void vscode.window.showErrorMessage(message);
}

export function registerFossilScmCommands(
    context: vscode.ExtensionContext,
    deps: FossilScmCommandDeps
): void {
    const { getRepoDir, getFossilSCM, getConflictCount, refreshFossilStatusNow } =
        deps;

    function requireRepo(): string | undefined {
        const repoDir = getRepoDir();
        if (!repoDir) {
            void vscode.window.showErrorMessage(
                'No Fossil checkout found in the workspace.'
            );
            return undefined;
        }
        return repoDir;
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('fossil.refresh', () => {
            void refreshFossilStatusNow();
        }),
        vscode.commands.registerCommand(
            'extension.fossilSCM',
            () => {
                void refreshFossilStatusNow();
            }
        ),
        vscode.commands.registerCommand(
            'fossil.add',
            async (...args: unknown[]) => {
                const repoDir = requireRepo();
                if (!repoDir) {
                    return;
                }
                const paths = resolveRelativePaths(args, repoDir);
                try {
                    await runFossilOnPaths(['add'], paths, repoDir);
                    await refreshFossilStatusNow();
                } catch (err) {
                    showFossilError(err);
                }
            }
        ),
        vscode.commands.registerCommand(
            'fossil.resetAdd',
            async (...args: unknown[]) => {
                const repoDir = requireRepo();
                if (!repoDir) {
                    return;
                }
                const paths = resolveRelativePaths(args, repoDir);
                try {
                    await runFossilOnPaths(['add', '--reset'], paths, repoDir);
                    await refreshFossilStatusNow();
                } catch (err) {
                    showFossilError(err);
                }
            }
        ),
        vscode.commands.registerCommand(
            'fossil.revert',
            async (...args: unknown[]) => {
                const repoDir = requireRepo();
                if (!repoDir) {
                    return;
                }
                const paths = resolveRelativePaths(args, repoDir);
                try {
                    await runFossilOnPaths(['revert'], paths, repoDir);
                    await refreshFossilStatusNow();
                } catch (err) {
                    showFossilError(err);
                }
            }
        ),
        vscode.commands.registerCommand('fossil.commit', async () => {
            const repoDir = requireRepo();
            if (!repoDir) {
                return;
            }
            const scm = getFossilSCM();
            const message = scm?.inputBox.value.trim() ?? '';
            if (!message) {
                void vscode.window.showWarningMessage(
                    'Enter a commit message before committing.'
                );
                return;
            }
            try {
                await runFossil(['commit', '-m', message], repoDir);
                if (scm) {
                    scm.inputBox.value = '';
                }
                await refreshFossilStatusNow();
            } catch (err) {
                showFossilError(err);
            }
        }),
        vscode.commands.registerCommand('fossil.sync', async () => {
            const repoDir = requireRepo();
            if (!repoDir) {
                return;
            }
            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Fossil Sync',
                        cancellable: false,
                    },
                    async () => {
                        await runFossil(['sync'], repoDir);
                    }
                );
                await refreshFossilStatusNow();
                const conflicts = getConflictCount();
                if (conflicts > 0) {
                    void vscode.window.showWarningMessage(
                        `Fossil sync finished with ${conflicts} merge conflict(s). Open Merge Conflicts in Source Control to resolve.`
                    );
                } else {
                    void vscode.window.showInformationMessage(
                        'Fossil sync completed.'
                    );
                }
            } catch (err) {
                showFossilError(err);
            }
        })
    );
}
