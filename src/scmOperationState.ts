'use strict';

import * as vscode from 'vscode';
import { logInfo } from './fossilLog';

export function setFossilContext(key: string, value: boolean): void {
    void vscode.commands.executeCommand('setContext', key, value);
}

export function clearScmOperationContexts(): void {
    setFossilContext('fossil.commitInProgress', false);
    setFossilContext('fossil.uiStarting', false);
}

let commitInProgress = false;

export function isCommitInProgress(): boolean {
    return commitInProgress;
}

export async function withCommitInProgress(
    scm: vscode.SourceControl | undefined,
    fn: () => Promise<void>
): Promise<void> {
    if (commitInProgress) {
        return;
    }
    commitInProgress = true;
    setFossilContext('fossil.commitInProgress', true);
    const previousEnabled = scm?.inputBox.enabled ?? true;
    if (scm) {
        scm.inputBox.enabled = false;
    }
    logInfo('Committing…');
    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.SourceControl,
                title: 'Committing',
                cancellable: false,
            },
            fn
        );
        logInfo('Commit completed.');
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logInfo(`Commit failed: ${message}`);
        throw err;
    } finally {
        commitInProgress = false;
        setFossilContext('fossil.commitInProgress', false);
        if (scm) {
            scm.inputBox.enabled = previousEnabled;
        }
    }
}
