'use strict';

import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'child_process';
import { getFossilExePath } from './fossilCli';
import { logError, logInfo } from './fossilLog';
import { setFossilContext } from './scmOperationState';

const UI_READY_PATTERN = /Listening on|Server URL:/i;
const UI_START_TIMEOUT_MS = 15_000;

let fossilUiProcess: ChildProcess | undefined;
let uiReadyCleanup: (() => void) | undefined;

function setUiRunningContext(running: boolean): void {
    setFossilContext('fossil.uiRunning', running);
}

function setUiStartingContext(starting: boolean): void {
    setFossilContext('fossil.uiStarting', starting);
}

function clearUiStartup(): void {
    uiReadyCleanup?.();
    uiReadyCleanup = undefined;
    setUiStartingContext(false);
}

function markUiReady(): void {
    clearUiStartup();
    setUiRunningContext(true);
    logInfo('Fossil UI ready.');
}

export function isFossilUiRunning(): boolean {
    return fossilUiProcess !== undefined && fossilUiProcess.exitCode === null;
}

function waitForUiReady(child: ChildProcess): void {
    const stderr = child.stderr;
    if (!stderr) {
        markUiReady();
        return;
    }

    let settled = false;
    const finish = (): void => {
        if (settled) {
            return;
        }
        settled = true;
        stderr.removeListener('data', onData);
        clearTimeout(timeout);
        if (fossilUiProcess === child && child.exitCode === null) {
            markUiReady();
        }
    };

    const onData = (chunk: Buffer | string): void => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        if (UI_READY_PATTERN.test(text)) {
            finish();
        }
    };

    const timeout = setTimeout(finish, UI_START_TIMEOUT_MS);
    stderr.on('data', onData);
    uiReadyCleanup = () => {
        stderr.removeListener('data', onData);
        clearTimeout(timeout);
    };
}

export function startFossilUi(repoDir: string): void {
    if (isFossilUiRunning()) {
        logInfo('Fossil UI is already running.');
        void vscode.window.showInformationMessage(
            'Fossil UI is already running.'
        );
        return;
    }

    logInfo('Starting Fossil UI…');
    setUiStartingContext(true);
    setUiRunningContext(false);

    const exe = getFossilExePath();
    const child = spawn(exe, ['ui'], {
        cwd: repoDir,
        stdio: ['ignore', 'ignore', 'pipe'],
    });
    fossilUiProcess = child;

    child.on('error', (err) => {
        fossilUiProcess = undefined;
        clearUiStartup();
        setUiRunningContext(false);
        logError(`Fossil UI failed: ${err.message}`);
        void vscode.window.showErrorMessage(
            `Failed to start Fossil UI: ${err.message}`
        );
    });

    child.on('spawn', () => {
        waitForUiReady(child);
    });

    child.on('exit', () => {
        fossilUiProcess = undefined;
        clearUiStartup();
        setUiRunningContext(false);
        logInfo('Fossil UI stopped.');
    });
}

export function stopFossilUi(): void {
    if (!isFossilUiRunning() || !fossilUiProcess) {
        logInfo('Fossil UI is not running.');
        void vscode.window.showInformationMessage(
            'Fossil UI is not running.'
        );
        return;
    }
    logInfo('Stopping Fossil UI…');
    fossilUiProcess.kill();
}

export function disposeFossilUi(): void {
    if (fossilUiProcess && fossilUiProcess.exitCode === null) {
        fossilUiProcess.kill();
    }
    fossilUiProcess = undefined;
    clearUiStartup();
    setUiRunningContext(false);
}

export function registerFossilUi(
    context: vscode.ExtensionContext,
    getRepoDir: () => string
): void {
    setUiRunningContext(false);
    setUiStartingContext(false);

    context.subscriptions.push(
        vscode.commands.registerCommand('fossil.startUi', () => {
            const repoDir = getRepoDir();
            if (!repoDir) {
                logError('Start Fossil UI: no checkout found.');
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
