'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { normalizeRelativePath } from './paths';

const execFileAsync = promisify(execFile);

export const DEFAULT_TIMELINE_LIMIT = 50;
const TIMELINE_BATCH_SIZE = 50;

export interface TimelineFileChange {
    name: string;
    state?: string;
}

export interface TimelineCheckinEntry {
    type: string;
    uuid: string;
    timestamp: number;
    user?: string;
    comment?: string;
    tags?: string[];
    parents?: string[];
    files?: TimelineFileChange[];
}

interface JsonTimelinePayload {
    limit?: number;
    timeline?: TimelineCheckinEntry[];
}

interface JsonTimelineResponse {
    payload?: JsonTimelinePayload;
    resultText?: string;
}

export function timelinePathFromUri(
    resourceUri: vscode.Uri,
    repoDir: string
): string {
    if (!repoDir) {
        throw new Error('No Fossil checkout is open.');
    }
    if (resourceUri.scheme !== 'file') {
        throw new Error('Timeline is only available for workspace files.');
    }
    const relative = normalizeRelativePath(
        path.relative(repoDir, resourceUri.fsPath)
    );
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('File is outside the Fossil checkout.');
    }
    return relative;
}

export function isUriUnderRepo(
    resourceUri: vscode.Uri,
    repoDir: string
): boolean {
    if (!repoDir || resourceUri.scheme !== 'file') {
        return false;
    }
    try {
        timelinePathFromUri(resourceUri, repoDir);
        return true;
    } catch {
        return false;
    }
}

/** True when a check-in's file list includes PATH (file or directory prefix). */
export function commitTouchesPath(
    entry: TimelineCheckinEntry,
    relativePath: string
): boolean {
    const files = entry.files;
    if (!files?.length) {
        return false;
    }
    const normPath = normalizeRelativePath(relativePath.replace(/\/$/, ''));
    return files.some((f) => {
        const name = normalizeRelativePath(f.name);
        return name === normPath || name.startsWith(normPath + '/');
    });
}

export function shortCheckinId(uuid: string): string {
    return uuid.length > 10 ? uuid.slice(0, 10) : uuid;
}

export function primaryParentUuid(
    entry: TimelineCheckinEntry
): string | undefined {
    return entry.parents?.[0];
}

/** True when this check-in newly added the path (no parent file version). */
export function fileAddedInCheckin(
    entry: TimelineCheckinEntry,
    relativePath: string
): boolean {
    const normPath = normalizeRelativePath(relativePath);
    return (
        entry.files?.some(
            (f) =>
                normalizeRelativePath(f.name) === normPath &&
                f.state === 'added'
        ) ?? false
    );
}

export function getFossilExePath(): string {
    return vscode.workspace
        .getConfiguration('fossilScm')
        .get<string>('fossilExePath', 'fossil');
}

async function fetchCheckinTimelineBatch(
    fossilExePath: string,
    repoDir: string,
    limit: number,
    rawOffset: number,
    includeFiles: boolean
): Promise<TimelineCheckinEntry[]> {
    const args = [
        'json',
        'timeline',
        'checkin',
        '-n',
        String(limit),
    ];
    if (includeFiles) {
        args.push('-f');
    }
    if (rawOffset > 0) {
        args.push('--offset', String(rawOffset));
    }

    const result = await execFileAsync(fossilExePath, args, {
        cwd: repoDir,
        maxBuffer: 10 * 1024 * 1024,
    });

    const json = JSON.parse(result.stdout) as JsonTimelineResponse;
    return json.payload?.timeline ?? [];
}

export interface FetchCheckinTimelineResult {
    entries: TimelineCheckinEntry[];
    hasMore: boolean;
}

/**
 * Check-ins affecting a single path. Uses `fossil json timeline checkin -f` and
 * filters client-side because `-p` is not applied by the JSON timeline API.
 */
export async function fetchCheckinTimelineForPath(
    fossilExePath: string,
    repoDir: string,
    relativePath: string,
    limit: number,
    skip = 0,
    token?: vscode.CancellationToken
): Promise<FetchCheckinTimelineResult | undefined> {
    if (token?.isCancellationRequested) {
        return undefined;
    }

    const filtered: TimelineCheckinEntry[] = [];
    let rawOffset = 0;
    let skipped = 0;
    let hasMore = false;

    outer: while (true) {
        if (token?.isCancellationRequested) {
            return undefined;
        }

        const batch = await fetchCheckinTimelineBatch(
            fossilExePath,
            repoDir,
            TIMELINE_BATCH_SIZE,
            rawOffset,
            true
        );

        if (token?.isCancellationRequested) {
            return undefined;
        }

        if (batch.length === 0) {
            break;
        }

        for (const entry of batch) {
            if (!commitTouchesPath(entry, relativePath)) {
                continue;
            }
            if (skipped < skip) {
                skipped++;
                continue;
            }
            if (filtered.length < limit) {
                filtered.push(entry);
            } else {
                hasMore = true;
                break outer;
            }
        }

        rawOffset += batch.length;
        if (batch.length < TIMELINE_BATCH_SIZE) {
            break;
        }
    }

    return { entries: filtered, hasMore };
}

export function mapCheckinsToTimelineItems(
    entries: TimelineCheckinEntry[],
    fileUri: vscode.Uri,
    relativePath: string
): vscode.TimelineItem[] {
    return entries.map((entry) => {
        const label =
            entry.comment?.trim() || shortCheckinId(entry.uuid);
        const tags =
            entry.tags && entry.tags.length > 0
                ? ` [${entry.tags.join(', ')}]`
                : '';
        const description = entry.user
            ? `${entry.user}${tags}`
            : tags.trim() || undefined;

        const item = new vscode.TimelineItem(
            label,
            entry.timestamp * 1000
        );
        item.id = entry.uuid;
        item.description = description;
        item.iconPath = new vscode.ThemeIcon('history');
        item.contextValue = 'fossilCommit';
        const parentUuid = primaryParentUuid(entry);
        item.command = {
            command: 'fossil.timeline.openDiff',
            title: 'Open Diff',
            arguments: [
                fileUri,
                entry.uuid,
                parentUuid,
                fileAddedInCheckin(entry, relativePath),
            ],
        };
        return item;
    });
}
