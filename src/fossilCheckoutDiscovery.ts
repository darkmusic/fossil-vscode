'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const FOSSIL_MARKERS = ['.fslckout', '_FOSSIL_'] as const;

/** Directory names skipped when searching for nested Fossil checkouts. */
const IGNORED_DIR_NAMES = new Set([
    '.git',
    'node_modules',
    'dist',
    'out',
    '.vscode-test',
    '.cursor',
]);

export function isFossilCheckoutDir(dir: string): boolean {
    return FOSSIL_MARKERS.some((marker) =>
        fs.existsSync(path.join(dir, marker))
    );
}

/**
 * Collect Fossil checkout roots under `root` (not including parents above `root`).
 */
export function findFossilCheckoutsUnder(
    root: string,
    maxDepth = 12
): string[] {
    const found: string[] = [];

    function walk(dir: string, depth: number): void {
        if (depth > maxDepth) {
            return;
        }
        if (isFossilCheckoutDir(dir)) {
            found.push(path.resolve(dir));
            return;
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            if (IGNORED_DIR_NAMES.has(entry.name)) {
                continue;
            }
            walk(path.join(dir, entry.name), depth + 1);
        }
    }

    walk(path.resolve(root), 0);
    return found;
}

function checkoutContainingFile(
    checkouts: string[],
    filePath: string
): string | undefined {
    const normalized = path.resolve(filePath);
    const matches = checkouts.filter(
        (checkout) =>
            normalized === checkout ||
            normalized.startsWith(checkout + path.sep)
    );
    if (matches.length === 0) {
        return undefined;
    }
    matches.sort((a, b) => b.length - a.length);
    return matches[0];
}

/**
 * Pick one checkout from candidates, preferring the checkout that contains the
 * active editor file, then the only checkout, then the shallowest path.
 */
export function selectFossilCheckout(
    checkouts: string[],
    activeFilePath?: string
): string | undefined {
    if (checkouts.length === 0) {
        return undefined;
    }
    if (activeFilePath) {
        const match = checkoutContainingFile(checkouts, activeFilePath);
        if (match) {
            return match;
        }
    }
    if (checkouts.length === 1) {
        return checkouts[0];
    }
    const sorted = [...checkouts].sort((a, b) => a.length - b.length);
    return sorted[0];
}

/**
 * Find Fossil checkout directory for the current workspace. Unlike checking only
 * workspace folder roots, this also discovers nested checkouts (e.g. Fossil
 * under a Git repo root).
 */
export function findFossilWorkspaceDir(
    workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
    activeFilePath?: string
): string | undefined {
    const allCheckouts: string[] = [];

    for (const folder of workspaceFolders ?? []) {
        const root = folder.uri.fsPath;
        if (isFossilCheckoutDir(root)) {
            allCheckouts.push(path.resolve(root));
        }
        for (const nested of findFossilCheckoutsUnder(root)) {
            if (!allCheckouts.includes(nested)) {
                allCheckouts.push(nested);
            }
        }
    }

    return selectFossilCheckout(allCheckouts, activeFilePath);
}
