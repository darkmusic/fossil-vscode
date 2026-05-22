'use strict';

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { normalizeRelativePath } from './paths';

const execFileAsync = promisify(execFile);

const FOSSIL_SCHEME = 'fossil';
const FOSSIL_EMPTY_SCHEME = 'fossil-empty';

const fossilChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

export function getFossilContentChangeEvent(): vscode.Event<vscode.Uri> {
    return fossilChangeEmitter.event;
}

export function notifyFossilContentChanged(): void {
    const notified = new Set<string>();
    for (const doc of vscode.workspace.textDocuments) {
        if (doc.uri.scheme !== FOSSIL_SCHEME) {
            continue;
        }
        const key = doc.uri.toString();
        if (notified.has(key)) {
            continue;
        }
        notified.add(key);
        fossilChangeEmitter.fire(doc.uri);
    }
}

function buildVirtualUri(
    scheme: string,
    relativePath: string,
    repoDir: string
): vscode.Uri {
    const normalized = normalizeRelativePath(relativePath);
    return vscode.Uri.from({
        scheme,
        path: '/' + normalized,
        query: `root=${encodeURIComponent(repoDir)}`,
    });
}

export function toFossilUri(relativePath: string, repoDir: string): vscode.Uri {
    return buildVirtualUri(FOSSIL_SCHEME, relativePath, repoDir);
}

export function toFossilEmptyUri(
    relativePath: string,
    repoDir: string
): vscode.Uri {
    return buildVirtualUri(FOSSIL_EMPTY_SCHEME, relativePath, repoDir);
}

export function parseVirtualUri(uri: vscode.Uri): {
    relativePath: string;
    repoDir: string;
} {
    const repoDir = new URLSearchParams(uri.query).get('root') ?? '';
    const relativePath = uri.path.startsWith('/')
        ? uri.path.slice(1)
        : uri.path;
    return { relativePath, repoDir };
}

function getFossilExePath(): string {
    return vscode.workspace
        .getConfiguration('fossilScm')
        .get<string>('fossilExePath', 'fossil');
}

export async function runFossilCat(
    relativePath: string,
    repoDir: string,
    fossilExePath?: string
): Promise<string> {
    const exe = fossilExePath ?? getFossilExePath();
    const result = await execFileAsync(exe, ['cat', relativePath], {
        cwd: repoDir,
    });
    return result.stdout;
}

class FossilBaselineProvider implements vscode.TextDocumentContentProvider {
    onDidChange = fossilChangeEmitter.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const { relativePath, repoDir } = parseVirtualUri(uri);
        if (!repoDir || !relativePath) {
            return '';
        }
        try {
            return await runFossilCat(relativePath, repoDir);
        } catch (err: unknown) {
            const execErr = err as { stderr?: string; message?: string };
            const message =
                execErr.stderr?.trim() ||
                execErr.message ||
                `fossil cat failed for ${relativePath}`;
            void vscode.window.showErrorMessage(message);
            return '';
        }
    }
}

class FossilEmptyProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(_uri: vscode.Uri): string {
        return '';
    }
}

export function registerFossilContentProvider(
    context: vscode.ExtensionContext
): void {
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            FOSSIL_SCHEME,
            new FossilBaselineProvider()
        ),
        vscode.workspace.registerTextDocumentContentProvider(
            FOSSIL_EMPTY_SCHEME,
            new FossilEmptyProvider()
        )
    );
}
