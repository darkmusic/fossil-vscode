'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { getRepoDir } from './repoContext';
import {
    DEFAULT_TIMELINE_LIMIT,
    fetchCheckinTimelineForPath,
    getFossilExePath,
    isUriUnderRepo,
    mapCheckinsToTimelineItems,
    shortCheckinId,
    timelinePathFromUri,
} from './timelineData';
import { toFossilUri, toFossilEmptyUri } from './fossilContentProvider';

const timelineChangeEmitter =
    new vscode.EventEmitter<vscode.TimelineChangeEvent | undefined>();

class FossilTimelineProvider implements vscode.TimelineProvider {
    readonly id = 'fossil';
    readonly label = 'Fossil';
    readonly onDidChange = timelineChangeEmitter.event;

    async provideTimeline(
        uri: vscode.Uri,
        options: vscode.TimelineOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.Timeline | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const repoDir = getRepoDir();
        if (!repoDir || !isUriUnderRepo(uri, repoDir)) {
            return { items: [] };
        }

        let relativePath: string;
        try {
            relativePath = timelinePathFromUri(uri, repoDir);
        } catch {
            return { items: [] };
        }

        if (token.isCancellationRequested) {
            return undefined;
        }

        const limit =
            typeof options.limit === 'number'
                ? options.limit
                : DEFAULT_TIMELINE_LIMIT;
        const skip = options.cursor
            ? parseInt(options.cursor, 10)
            : 0;
        const parsedSkip =
            !Number.isNaN(skip) && skip > 0 ? skip : 0;

        try {
            const result = await fetchCheckinTimelineForPath(
                getFossilExePath(),
                repoDir,
                relativePath,
                limit,
                parsedSkip,
                token
            );

            if (token.isCancellationRequested || result === undefined) {
                return undefined;
            }

            const { entries, hasMore } = result;
            const items = mapCheckinsToTimelineItems(
                entries,
                uri,
                relativePath
            );
            const nextCursor = hasMore
                ? String(parsedSkip + entries.length)
                : undefined;
            return {
                items,
                paging:
                    nextCursor !== undefined
                        ? { cursor: nextCursor }
                        : undefined,
            };
        } catch (err: unknown) {
            const execErr = err as { stderr?: string; message?: string };
            console.log(
                'Fossil timeline provider:',
                execErr.stderr ?? execErr.message
            );
            return { items: [] };
        }
    }
}

export function notifyFossilTimelineChanged(): void {
    timelineChangeEmitter.fire(undefined);
}

export function registerFossilTimelineProvider(
    context: vscode.ExtensionContext
): void {
    const provider = new FossilTimelineProvider();
    context.subscriptions.push(
        vscode.workspace.registerTimelineProvider('file', provider)
    );
}

interface TimelineOpenDiffArgs {
    fileUri: vscode.Uri;
    checkinUuid: string;
    parentUuid?: string;
    fileWasAdded: boolean;
}

/** Args from item click (command.arguments) or timeline context menu (item + uri). */
function resolveTimelineOpenDiffArgs(
    arg0: vscode.Uri | vscode.TimelineItem,
    arg1?: string | vscode.Uri,
    arg2?: string,
    arg3?: boolean
): TimelineOpenDiffArgs | undefined {
    if (arg0 instanceof vscode.Uri && typeof arg1 === 'string') {
        return {
            fileUri: arg0,
            checkinUuid: arg1,
            parentUuid: arg2,
            fileWasAdded: arg3 === true,
        };
    }
    if (!arg0 || typeof arg0 !== 'object' || !('id' in arg0)) {
        return undefined;
    }
    const item = arg0 as vscode.TimelineItem;
    const fileUri = arg1 instanceof vscode.Uri ? arg1 : undefined;
    if (!fileUri || !item.id) {
        return undefined;
    }
    const cmdArgs = item.command?.arguments;
    if (
        cmdArgs &&
        cmdArgs.length >= 2 &&
        cmdArgs[0] instanceof vscode.Uri &&
        typeof cmdArgs[1] === 'string'
    ) {
        return {
            fileUri: cmdArgs[0],
            checkinUuid: cmdArgs[1],
            parentUuid:
                typeof cmdArgs[2] === 'string' ? cmdArgs[2] : undefined,
            fileWasAdded: cmdArgs[3] === true,
        };
    }
    return {
        fileUri,
        checkinUuid: item.id,
        fileWasAdded: false,
    };
}

async function runTimelineOpenDiff(
    args: TimelineOpenDiffArgs
): Promise<void> {
    const repoDir = getRepoDir();
    if (!repoDir) {
        void vscode.window.showErrorMessage('No Fossil checkout is open.');
        return;
    }

    const { fileUri, checkinUuid, parentUuid, fileWasAdded } = args;
    let relativePath: string;
    try {
        relativePath = timelinePathFromUri(fileUri, repoDir);
    } catch (err: unknown) {
        const message =
            err instanceof Error
                ? err.message
                : 'Invalid file for timeline diff';
        void vscode.window.showErrorMessage(message);
        return;
    }

    const basename = path.basename(relativePath);
    const right = toFossilUri(relativePath, repoDir, checkinUuid, 'timeline');
    const left =
        parentUuid && !fileWasAdded
            ? toFossilUri(relativePath, repoDir, parentUuid, 'timeline')
            : toFossilEmptyUri(relativePath, repoDir, 'timeline');

    const title =
        parentUuid && !fileWasAdded
            ? `${basename} (${shortCheckinId(parentUuid)}) ↔ ${basename} (${shortCheckinId(checkinUuid)})`
            : `${basename} (${shortCheckinId(checkinUuid)})`;

    await vscode.commands.executeCommand('vscode.diff', left, right, title);
}

function resolveCheckinUuid(
    arg: string | vscode.TimelineItem
): string | undefined {
    if (typeof arg === 'string') {
        return arg;
    }
    return arg.id;
}

export function registerTimelineCommands(
    context: vscode.ExtensionContext
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'fossil.timeline.openDiff',
            async (
                arg0: vscode.Uri | vscode.TimelineItem,
                arg1?: string | vscode.Uri,
                arg2?: string,
                arg3?: boolean
            ) => {
                const resolved = resolveTimelineOpenDiffArgs(
                    arg0,
                    arg1,
                    arg2,
                    arg3
                );
                if (!resolved) {
                    return;
                }
                await runTimelineOpenDiff(resolved);
            }
        ),
        vscode.commands.registerCommand(
            'fossil.timeline.copyHash',
            async (arg: string | vscode.TimelineItem) => {
                const checkinUuid = resolveCheckinUuid(arg);
                if (!checkinUuid) {
                    return;
                }
                await vscode.env.clipboard.writeText(checkinUuid);
            }
        )
    );
}
