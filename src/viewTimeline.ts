'use strict';

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getRepoDir } from './repoContext';
import {
    getFossilExePath,
    timelinePathFromUri,
} from './timelineData';

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
        void vscode.window.showErrorMessage('No Fossil checkout is open.');
        return;
    }

    let relativePath: string;
    try {
        relativePath = timelinePathFromUri(resourceUri, repoDir);
    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : 'Invalid file for timeline';
        void vscode.window.showErrorMessage(message);
        return;
    }

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

    try {
        const result = await execFileAsync(
            fossilExe,
            ['timeline', '-p', relativePath],
            {
                cwd: repoDir,
                maxBuffer: 10 * 1024 * 1024,
            }
        );
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
        void vscode.window.showErrorMessage(
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
