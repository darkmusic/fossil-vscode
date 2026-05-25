'use strict';

import * as vscode from 'vscode';

const OUTPUT_CHANNEL_NAME = 'Fossil Log';

let outputChannel: vscode.OutputChannel | undefined;

export function getFossilLogChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }
    return outputChannel;
}

export function formatLogLine(message: string, date = new Date()): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}] ${message}`;
}

export function logInfo(message: string): void {
    getFossilLogChannel().appendLine(formatLogLine(message));
}

export function logError(message: string): void {
    getFossilLogChannel().appendLine(formatLogLine(message));
}

export function logCommand(exe: string, args: string[], cwd: string): void {
    const quotedArgs = args.map((arg) =>
        /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
    );
    logInfo(`${exe} ${quotedArgs.join(' ')} (cwd: ${cwd})`);
}

export function registerFossilLog(context: vscode.ExtensionContext): void {
    context.subscriptions.push(getFossilLogChannel());
}
