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

/** Distinguishes virtual documents so diff/quick-diff editors do not share one model. */
export type FossilUriContext = 'quickdiff' | 'scm' | 'timeline';

function buildVirtualUri(
    scheme: string,
    relativePath: string,
    repoDir: string,
    rev?: string,
    ctx?: FossilUriContext
): vscode.Uri {
    const normalized = normalizeRelativePath(relativePath);
    const params = new URLSearchParams();
    params.set('root', repoDir);
    if (rev) {
        params.set('rev', rev);
    }
    if (ctx) {
        params.set('ctx', ctx);
    }
    return vscode.Uri.from({
        scheme,
        path: '/' + normalized,
        query: params.toString(),
    });
}

export function toFossilUri(
    relativePath: string,
    repoDir: string,
    rev?: string,
    ctx: FossilUriContext = 'scm'
): vscode.Uri {
    return buildVirtualUri(FOSSIL_SCHEME, relativePath, repoDir, rev, ctx);
}

export function toFossilEmptyUri(
    relativePath: string,
    repoDir: string,
    ctx: FossilUriContext = 'scm'
): vscode.Uri {
    return buildVirtualUri(FOSSIL_EMPTY_SCHEME, relativePath, repoDir, undefined, ctx);
}

export function parseVirtualUri(uri: vscode.Uri): {
    relativePath: string;
    repoDir: string;
    rev?: string;
    ctx?: string;
} {
    const params = new URLSearchParams(uri.query);
    const repoDir = params.get('root') ?? '';
    const rev = params.get('rev') ?? undefined;
    const ctx = params.get('ctx') ?? undefined;
    const relativePath = uri.path.startsWith('/')
        ? uri.path.slice(1)
        : uri.path;
    return { relativePath, repoDir, rev, ctx };
}

function getFossilExePath(): string {
    return vscode.workspace
        .getConfiguration('fossilScm')
        .get<string>('fossilExePath', 'fossil');
}

export async function runFossilCat(
    relativePath: string,
    repoDir: string,
    fossilExePath?: string,
    rev?: string
): Promise<string> {
    const exe = fossilExePath ?? getFossilExePath();
    const args = rev
        ? ['cat', '-r', rev, relativePath]
        : ['cat', relativePath];
    const result = await execFileAsync(exe, args, {
        cwd: repoDir,
    });
    return result.stdout;
}

class FossilBaselineProvider implements vscode.TextDocumentContentProvider {
    onDidChange = fossilChangeEmitter.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const { relativePath, repoDir, rev } = parseVirtualUri(uri);
        if (!repoDir || !relativePath) {
            return '';
        }
        try {
            return await runFossilCat(relativePath, repoDir, undefined, rev);
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
