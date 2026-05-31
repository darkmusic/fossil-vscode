'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { normalizeRelativePath } from './paths';
import { logCommand, logError, logInfo } from './fossilLog';

export class FossilCommandError extends Error {
    constructor(
        message: string,
        readonly stderr: string
    ) {
        super(message);
        this.name = 'FossilCommandError';
    }
}

const CRLF_ANSWER_COUNT = 10_000;

function getCrlfInput(): string {
    const setting = vscode.workspace
        .getConfiguration('fossilScm')
        .get<string>('crlfHandling', 'accept');
    switch (setting) {
        case 'abort':
            return '';
        default: {
            const answer = setting === 'convert' ? 'c' : 'a';
            return (answer + '\n').repeat(CRLF_ANSWER_COUNT);
        }
    }
}

export function getFossilExePath(): string {
    return vscode.workspace
        .getConfiguration('fossilScm')
        .get<string>('fossilExePath', 'fossil');
}

export async function runFossil(
    args: string[],
    cwd: string,
    fossilExePath?: string
): Promise<{ stdout: string; stderr: string }> {
    const exe = fossilExePath ?? getFossilExePath();
    logCommand(exe, args, cwd);
    const crlfInput = getCrlfInput();
    const started = Date.now();

    try {
        const result = await new Promise<{ stdout: string; stderr: string }>(
            (resolve, reject) => {
                const child = spawn(exe, args, {
                    cwd,
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                let stdout = '';
                let stderr = '';
                child.stdout.setEncoding('utf8');
                child.stderr.setEncoding('utf8');
                child.stdout.on('data', (data: string) => {
                    stdout += data;
                });
                child.stderr.on('data', (data: string) => {
                    stderr += data;
                });

                child.on('error', (err) => {
                    reject(err);
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve({ stdout, stderr: stderr ?? '' });
                    } else {
                        const message =
                            stderr.trim() ||
                            `fossil exited with code ${code}`;
                        const cmdErr = new Error(
                            message
                        ) as Error & { stderr: string };
                        cmdErr.stderr = stderr;
                        reject(cmdErr);
                    }
                });

                child.stdin.write(crlfInput);
                child.stdin.end();
            }
        );

        const stderr = result.stderr ?? '';
        const elapsed = Date.now() - started;
        logInfo(`Completed in ${elapsed}ms`);
        if (stderr.trim()) {
            logInfo(stderr.trim());
        }
        return { stdout: result.stdout, stderr };
    } catch (err: unknown) {
        const execErr = err as { stderr?: string; message?: string };
        const stderr =
            (typeof execErr.stderr === 'string'
                ? execErr.stderr.trim()
                : '') ||
            execErr.message ||
            'fossil command failed';
        logError(stderr);
        throw new FossilCommandError(stderr, stderr);
    }
}

export function relativePathFromResourceUri(
    uri: vscode.Uri,
    repoDir: string
): string {
    return normalizeRelativePath(path.relative(repoDir, uri.fsPath));
}
