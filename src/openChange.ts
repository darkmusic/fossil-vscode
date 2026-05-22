'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    toFossilUri,
    toFossilEmptyUri,
} from './fossilContentProvider';

export type FossilChangeType =
    | 'DELETED'
    | 'EDITED'
    | 'ADDED'
    | 'UNMANAGE'
    | 'EXTRA'
    | 'RENAMED'
    | 'CONFLICT';

export interface ChangeCommandOptions {
    priorPath?: string;
    /** Override for tests; defaults to workspace configuration. */
    openDiffOnClick?: boolean;
}

function getOpenDiffOnClick(
    repoDir: string,
    override?: boolean
): boolean {
    if (override !== undefined) {
        return override;
    }
    return vscode.workspace
        .getConfiguration('fossilScm', vscode.Uri.file(repoDir))
        .get<boolean>('openDiffOnClick', true);
}

function relativePathFromUri(
    resourceUri: vscode.Uri,
    repoDir: string
): string {
    return path.relative(repoDir, resourceUri.fsPath);
}

function diffTitle(
    relativePath: string,
    priorPath?: string
): string {
    const base = path.basename(relativePath);
    if (priorPath) {
        return `${path.basename(priorPath)} → ${base} (Fossil)`;
    }
    return `${base} (Fossil)`;
}

export function resolveChangeCommand(
    resourceUri: vscode.Uri,
    changeType: string,
    repoDir: string,
    options?: ChangeCommandOptions
): vscode.Command {
    const openDiffOnClick = getOpenDiffOnClick(
        repoDir,
        options?.openDiffOnClick
    );
    const relativePath = relativePathFromUri(resourceUri, repoDir);

    if (!openDiffOnClick) {
        if (
            changeType === 'DELETED' &&
            !fs.existsSync(resourceUri.fsPath)
        ) {
            return {
                command: 'vscode.open',
                title: 'Open',
                arguments: [toFossilUri(relativePath, repoDir)],
            };
        }
        return {
            command: 'vscode.open',
            title: 'Open',
            arguments: [resourceUri],
        };
    }

    const title = diffTitle(relativePath, options?.priorPath);

    switch (changeType as FossilChangeType) {
        case 'EDITED':
        case 'CONFLICT': {
            const left = toFossilUri(relativePath, repoDir);
            return {
                command: 'vscode.diff',
                title: 'Open Change',
                arguments: [left, resourceUri, title],
            };
        }
        case 'DELETED': {
            const left = toFossilUri(relativePath, repoDir);
            return {
                command: 'vscode.open',
                title: 'Open',
                arguments: [left],
            };
        }
        case 'ADDED': {
            const left = toFossilEmptyUri(relativePath, repoDir);
            return {
                command: 'vscode.diff',
                title: 'Open Change',
                arguments: [left, resourceUri, title],
            };
        }
        case 'RENAMED': {
            const prior =
                options?.priorPath ?? relativePath;
            const left = toFossilUri(prior, repoDir);
            return {
                command: 'vscode.diff',
                title: 'Open Change',
                arguments: [left, resourceUri, title],
            };
        }
        case 'UNMANAGE':
        case 'EXTRA':
            return {
                command: 'vscode.open',
                title: 'Open',
                arguments: [resourceUri],
            };
        default:
            return {
                command: 'vscode.open',
                title: 'Open',
                arguments: [resourceUri],
            };
    }
}

export function registerOpenChangeCommand(
    context: vscode.ExtensionContext
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'fossil.openChange',
            async (
                resourceUri: vscode.Uri,
                changeType: string,
                repoDir: string,
                priorPath?: string
            ) => {
                const cmd = resolveChangeCommand(
                    resourceUri,
                    changeType,
                    repoDir,
                    { priorPath }
                );
                await vscode.commands.executeCommand(
                    cmd.command,
                    ...(cmd.arguments ?? [])
                );
            }
        )
    );
}
