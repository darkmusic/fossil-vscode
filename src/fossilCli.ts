'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { normalizeRelativePath } from './paths';
import { logCommand, logError, logInfo } from './fossilLog';

const execFileAsync = promisify(execFile);

export class FossilCommandError extends Error {
    constructor(
        message: string,
        readonly stderr: string
    ) {
        super(message);
        this.name = 'FossilCommandError';
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
    const started = Date.now();
    try {
        const result = await execFileAsync(exe, args, {
            cwd,
            maxBuffer: 10 * 1024 * 1024,
        });
        const stderr = result.stderr ?? '';
        const elapsed = Date.now() - started;
        logInfo(`Completed in ${elapsed}ms`);
        if (stderr.trim()) {
            logInfo(stderr.trim());
        }
        return {
            stdout: result.stdout,
            stderr,
        };
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
