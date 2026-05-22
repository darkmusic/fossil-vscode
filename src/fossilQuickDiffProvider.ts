'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { toFossilUri, toFossilEmptyUri } from './fossilContentProvider';
import { normalizeRelativePath } from './paths';

export interface FileStatusEntry {
    type: string;
    priorPath?: string;
}

export class FossilQuickDiffProvider implements vscode.QuickDiffProvider {
    readonly label = 'Fossil';

    constructor(
        private readonly repoDir: string,
        private readonly getStatusByPath: () => Map<
            string,
            FileStatusEntry
        >
    ) {}

    provideOriginalResource(uri: vscode.Uri): vscode.Uri | undefined {
        if (uri.scheme !== 'file') {
            return undefined;
        }

        const normalizedRepo = path.resolve(this.repoDir);
        const normalizedFile = path.resolve(uri.fsPath);
        if (
            normalizedFile !== normalizedRepo &&
            !normalizedFile.startsWith(normalizedRepo + path.sep)
        ) {
            return undefined;
        }

        const relativePath = normalizeRelativePath(
            path.relative(this.repoDir, uri.fsPath)
        );
        const entry = this.getStatusByPath().get(relativePath);
        if (!entry) {
            return undefined;
        }

        switch (entry.type) {
            case 'UNMANAGE':
            case 'EXTRA':
            case 'DELETED':
                return undefined;
            case 'ADDED':
                return toFossilEmptyUri(relativePath, this.repoDir, 'quickdiff');
            case 'RENAMED': {
                const prior = entry.priorPath ?? relativePath;
                return toFossilUri(prior, this.repoDir, undefined, 'quickdiff');
            }
            case 'EDITED':
            case 'CONFLICT':
                return toFossilUri(relativePath, this.repoDir, undefined, 'quickdiff');
            default:
                return undefined;
        }
    }
}
