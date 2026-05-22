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
        _token: vscode.CancellationToken
    ): Promise<vscode.Timeline | undefined> {
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
            const { entries, hasMore } = await fetchCheckinTimelineForPath(
                getFossilExePath(),
                repoDir,
                relativePath,
                limit,
                parsedSkip
            );
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

export function registerTimelineCommands(
    context: vscode.ExtensionContext
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'fossil.timeline.openDiff',
            async (
                fileUri: vscode.Uri,
                checkinUuid: string,
                parentUuid?: string,
                fileWasAdded?: boolean
            ) => {
                const repoDir = getRepoDir();
                if (!repoDir || !checkinUuid) {
                    return;
                }

                const relativePath = timelinePathFromUri(fileUri, repoDir);
                const basename = path.basename(relativePath);
                const right = toFossilUri(
                    relativePath,
                    repoDir,
                    checkinUuid,
                    'timeline'
                );
                const left =
                    parentUuid && !fileWasAdded
                        ? toFossilUri(
                              relativePath,
                              repoDir,
                              parentUuid,
                              'timeline'
                          )
                        : toFossilEmptyUri(relativePath, repoDir, 'timeline');

                const title =
                    parentUuid && !fileWasAdded
                        ? `${basename} (${shortCheckinId(parentUuid)}) ↔ ${basename} (${shortCheckinId(checkinUuid)})`
                        : `${basename} (${shortCheckinId(checkinUuid)})`;

                await vscode.commands.executeCommand(
                    'vscode.diff',
                    left,
                    right,
                    title
                );
            }
        ),
        vscode.commands.registerCommand(
            'fossil.timeline.copyHash',
            async (checkinUuid: string) => {
                if (!checkinUuid) {
                    return;
                }
                await vscode.env.clipboard.writeText(checkinUuid);
            }
        )
    );
}
