'use strict';

import * as vscode from 'vscode';
import { FossilCommandError, runFossil, relativePathFromResourceUri } from './fossilCli';
import { logError, logInfo } from './fossilLog';
import { toAbsolutePathInsideRepo } from './paths';
import { withCommitInProgress } from './scmOperationState';

export interface FossilScmCommandDeps {
    getRepoDir: () => string;
    getFossilSCM: () => vscode.SourceControl | undefined;
    getConflictCount: () => number;
    getMissingCount: () => number;
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
        const message =
            relativePaths.length === 0
                ? 'No files selected.'
                : 'Selected files are outside the Fossil checkout.';
        logInfo(message);
        void vscode.window.showWarningMessage(message);
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
    logError(message);
    void vscode.window.showErrorMessage(message);
}

export function registerFossilScmCommands(
    context: vscode.ExtensionContext,
    deps: FossilScmCommandDeps
): void {
    const {
        getRepoDir,
        getFossilSCM,
        getConflictCount,
        getMissingCount,
        refreshFossilStatusNow,
    } = deps;

    function requireRepo(): string | undefined {
        const repoDir = getRepoDir();
        if (!repoDir) {
            logError('No Fossil checkout found in the workspace.');
            void vscode.window.showErrorMessage(
                'No Fossil checkout found in the workspace.'
            );
            return undefined;
        }
        return repoDir;
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('fossil.refresh', () => {
            logInfo('Refresh requested.');
            void refreshFossilStatusNow();
        }),
        vscode.commands.registerCommand(
            'extension.fossilSCM',
            () => {
                logInfo('Refresh requested.');
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
                logInfo(`Add to checkout: ${paths.join(', ') || '(none)'}`);
                try {
                    await runFossilOnPaths(['add'], paths, repoDir);
                    await refreshFossilStatusNow();
                    logInfo('Add to checkout completed.');
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
                logInfo(`Reset add: ${paths.join(', ') || '(none)'}`);
                try {
                    await runFossilOnPaths(['add', '--reset'], paths, repoDir);
                    await refreshFossilStatusNow();
                    logInfo('Reset add completed.');
                } catch (err) {
                    showFossilError(err);
                }
            }
        ),
        vscode.commands.registerCommand(
            'fossil.rm',
            async (...args: unknown[]) => {
                const repoDir = requireRepo();
                if (!repoDir) {
                    return;
                }
                const paths = resolveRelativePaths(args, repoDir);
                logInfo(`Mark as deleted: ${paths.join(', ') || '(none)'}`);
                try {
                    await runFossilOnPaths(['rm'], paths, repoDir);
                    await refreshFossilStatusNow();
                    logInfo('Mark as deleted completed.');
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
                logInfo(`Revert: ${paths.join(', ') || '(none)'}`);
                try {
                    await runFossilOnPaths(['revert'], paths, repoDir);
                    await refreshFossilStatusNow();
                    logInfo('Revert completed.');
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
                logInfo('Commit skipped: empty message.');
                void vscode.window.showWarningMessage(
                    'Enter a commit message before committing.'
                );
                return;
            }
            const missingCount = getMissingCount();
            if (missingCount > 0) {
                const blockedMessage =
                    missingCount === 1
                        ? '1 file was deleted locally and is missing from the checkout. Use Mark as Deleted or Revert on the file under Missing in Source Control before committing.'
                        : `${missingCount} files were deleted locally and are missing from the checkout. Use Mark as Deleted or Revert on them under Missing in Source Control before committing.`;
                logInfo(`Commit blocked: ${missingCount} missing file(s).`);
                void vscode.window.showWarningMessage(blockedMessage);
                return;
            }
            try {
                await withCommitInProgress(scm, async () => {
                    await runFossil(['commit', '-m', message], repoDir);
                    if (scm) {
                        scm.inputBox.value = '';
                    }
                    await refreshFossilStatusNow();
                });
            } catch (err) {
                showFossilError(err);
            }
        }),
        vscode.commands.registerCommand('fossil.sync', async () => {
            const repoDir = requireRepo();
            if (!repoDir) {
                return;
            }
            logInfo('Syncing…');
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
                    const message = `Fossil sync finished with ${conflicts} merge conflict(s). Open Merge Conflicts in Source Control to resolve.`;
                    logInfo(message);
                    void vscode.window.showWarningMessage(message);
                } else {
                    logInfo('Sync completed.');
                    void vscode.window.showInformationMessage(
                        'Fossil sync completed.'
                    );
                }
            } catch (err) {
                logInfo('Sync failed.');
                showFossilError(err);
            }
        })
    );
}
