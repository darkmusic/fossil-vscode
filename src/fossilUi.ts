'use strict';

import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'child_process';
import { getFossilExePath } from './fossilCli';

let fossilUiProcess: ChildProcess | undefined;

function setUiRunningContext(running: boolean): void {
    void vscode.commands.executeCommand(
        'setContext',
        'fossil.uiRunning',
        running
    );
}

export function isFossilUiRunning(): boolean {
    return fossilUiProcess !== undefined && fossilUiProcess.exitCode === null;
}

export function startFossilUi(repoDir: string): void {
    if (isFossilUiRunning()) {
        void vscode.window.showInformationMessage(
            'Fossil UI is already running.'
        );
        return;
    }

    const exe = getFossilExePath();
    const child = spawn(exe, ['ui'], {
        cwd: repoDir,
        stdio: 'ignore',
    });
    fossilUiProcess = child;

    child.on('error', (err) => {
        fossilUiProcess = undefined;
        setUiRunningContext(false);
        void vscode.window.showErrorMessage(
            `Failed to start Fossil UI: ${err.message}`
        );
    });

    child.on('exit', () => {
        fossilUiProcess = undefined;
        setUiRunningContext(false);
    });

    setUiRunningContext(true);
}

export function stopFossilUi(): void {
    if (!isFossilUiRunning() || !fossilUiProcess) {
        void vscode.window.showInformationMessage(
            'Fossil UI is not running.'
        );
        return;
    }
    fossilUiProcess.kill();
}

export function disposeFossilUi(): void {
    if (fossilUiProcess && fossilUiProcess.exitCode === null) {
        fossilUiProcess.kill();
    }
    fossilUiProcess = undefined;
    setUiRunningContext(false);
}

export function registerFossilUi(
    context: vscode.ExtensionContext,
    getRepoDir: () => string
): void {
    setUiRunningContext(false);

    context.subscriptions.push(
        vscode.commands.registerCommand('fossil.startUi', () => {
            const repoDir = getRepoDir();
            if (!repoDir) {
                void vscode.window.showErrorMessage(
                    'No Fossil checkout found in the workspace.'
                );
                return;
            }
            startFossilUi(repoDir);
        }),
        vscode.commands.registerCommand('fossil.stopUi', () => {
            stopFossilUi();
        }),
        { dispose: disposeFossilUi }
    );
}
