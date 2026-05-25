'use strict';

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getRepoDir } from './repoContext';
import {
    getFossilExePath,
    timelinePathFromUri,
} from './timelineData';
import { logCommand, logError, logInfo } from './fossilLog';

const execFileAsync = promisify(execFile);

const OUTPUT_CHANNEL_NAME = 'Fossil Timeline';

let outputChannel: vscode.OutputChannel | undefined;

export function getTimelineOutputChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }
    return outputChannel;
}

export function resolveViewTimelineUri(
    arg?: vscode.Uri | vscode.SourceControlResourceState
): vscode.Uri | undefined {
    if (arg instanceof vscode.Uri) {
        return arg;
    }
    if (arg && 'resourceUri' in arg) {
        return arg.resourceUri;
    }
    const active = vscode.window.activeTextEditor?.document.uri;
    if (active?.scheme === 'file') {
        return active;
    }
    return undefined;
}

export async function showTimelineOutputForUri(
    resourceUri: vscode.Uri
): Promise<void> {
    const repoDir = getRepoDir();
    if (!repoDir) {
        logError('View timeline: no checkout open.');
        void vscode.window.showErrorMessage('No Fossil checkout is open.');
        return;
    }

    let relativePath: string;
    try {
        relativePath = timelinePathFromUri(resourceUri, repoDir);
    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : 'Invalid file for timeline';
        logError(`View timeline: ${message}`);
        void vscode.window.showErrorMessage(message);
        return;
    }

    logInfo(`View timeline (output): ${relativePath}`);
    await runTextTimeline(relativePath);
}

async function runTextTimeline(relativePath: string): Promise<void> {
    const repoDir = getRepoDir();
    if (!repoDir) {
        void vscode.window.showErrorMessage('No Fossil checkout is open.');
        return;
    }

    const channel = getTimelineOutputChannel();
    const fossilExe = getFossilExePath();
    const header = `Timeline: ${relativePath}`;
    const args = ['timeline', '-p', relativePath];
    logCommand(fossilExe, args, repoDir);

    try {
        const result = await execFileAsync(fossilExe, args, {
            cwd: repoDir,
            maxBuffer: 10 * 1024 * 1024,
        });
        logInfo(`Timeline output ready for ${relativePath}.`);
        let body = result.stdout;
        if (result.stderr?.trim()) {
            body += (body.length > 0 ? '\n' : '') + result.stderr;
        }
        channel.replace(`${header}\n\n${body}`);
        channel.show(true);
    } catch (err: unknown) {
        const execErr = err as { stderr?: string; message?: string };
        const detail =
            execErr.stderr?.trim() ||
            execErr.message ||
            'fossil timeline failed';
        logError(`Timeline failed for ${relativePath}: ${detail}`);
        channel.replace(`${header}\n\n${detail}`);
        channel.show(true);
        void vscode.window
            .showErrorMessage(
                'Fossil timeline failed. See the Fossil Timeline output for details.',
                'Show Output'
            )
            .then((choice) => {
                if (choice === 'Show Output') {
                    channel.show(true);
                }
            });
    }
}

async function runViewTimeline(
    arg?: vscode.Uri | vscode.SourceControlResourceState,
    openTimelineView = false
): Promise<void> {
    const resourceUri = resolveViewTimelineUri(arg);
    if (!resourceUri) {
        logInfo('View timeline: no file selected.');
        void vscode.window.showWarningMessage(
            'Select or open a file to view its timeline.'
        );
        return;
    }

    await showTimelineOutputForUri(resourceUri);

    if (openTimelineView && resourceUri.scheme === 'file') {
        await vscode.commands.executeCommand(
            'files.openTimeline',
            resourceUri
        );
    }
}

export function registerViewTimelineCommand(
    context: vscode.ExtensionContext
): void {
    const channel = getTimelineOutputChannel();
    context.subscriptions.push(channel);

    context.subscriptions.push(
        vscode.commands.registerCommand('fossil.viewTimeline', (arg) =>
            runViewTimeline(arg, false)
        ),
        vscode.commands.registerCommand(
            'fossil.viewTimeline.explorer',
            (uri?: vscode.Uri) => runViewTimeline(uri, true)
        )
    );
}
