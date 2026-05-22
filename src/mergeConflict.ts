'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface MergeSidecarPaths {
    baseline: string;
    original: string;
    merge: string;
}

/** Fossil merge temp files: path-baseline, path-original, path-merge */
export function findMergeSidecars(
    workingFilePath: string
): MergeSidecarPaths | undefined {
    const baseline = `${workingFilePath}-baseline`;
    const original = `${workingFilePath}-original`;
    const merge = `${workingFilePath}-merge`;
    if (
        fs.existsSync(baseline) &&
        fs.existsSync(original) &&
        fs.existsSync(merge)
    ) {
        return { baseline, original, merge };
    }
    return undefined;
}

/**
 * Attempts to open a file with merge conflicts in VS Code's merge editor.
 * Uses the internal `_open.mergeEditor` command (not part of stable API).
 * Returns false if sidecars are not found or if the merge editor command fails.
 *
 * @param workingUri The working file with unresolved merge conflicts
 * @returns true if successfully opened in merge editor, false otherwise
 */
export async function openInMergeEditor(
    workingUri: vscode.Uri
): Promise<boolean> {
    const sidecars = findMergeSidecars(workingUri.fsPath);
    if (!sidecars) {
        return false;
    }
    const baseName = path.basename(workingUri.fsPath);
    try {
        // Note: _open.mergeEditor is an internal VS Code command.
        // If this fails on newer VS Code versions, check the changelog
        // or consider alternative merge conflict resolution approaches.
        await vscode.commands.executeCommand('_open.mergeEditor', {
            base: vscode.Uri.file(sidecars.baseline),
            input1: {
                uri: vscode.Uri.file(sidecars.original),
                title: 'Local',
            },
            input2: {
                uri: vscode.Uri.file(sidecars.merge),
                title: 'Merged in',
            },
            output: {
                uri: workingUri,
                title: baseName,
            },
        });
        return true;
    } catch (err) {
        // Log the error for debugging purposes
        const message =
            err instanceof Error ? err.message : String(err);
        console.warn(
            `Failed to open merge editor (internal API may have changed): ${message}`
        );
        return false;
    }
}
