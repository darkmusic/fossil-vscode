'use strict';

import { normalizeRelativePath } from './paths';
import { runFossil } from './fossilCli';

interface JsonStatusFile {
    name?: string;
    priorName?: string;
    state?: string;
}

interface JsonStatusPayload {
    files?: JsonStatusFile[];
}

interface JsonStatusResponse {
    payload?: JsonStatusPayload;
}

/** Map from new relative path to prior relative path for renamed files. */
export async function fetchRenameMap(
    fossilExePath: string,
    repoDir: string
): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
        const result = await runFossil(
            ['json', 'status'],
            repoDir,
            fossilExePath
        );
        const json = JSON.parse(result.stdout) as JsonStatusResponse;
        const files = json.payload?.files ?? [];
        for (const file of files) {
            if (
                file.state === 'renamed' &&
                file.name &&
                file.priorName
            ) {
                map.set(
                    normalizeRelativePath(file.name),
                    normalizeRelativePath(file.priorName)
                );
            }
        }
    } catch {
        // JSON status unavailable; caller uses empty map and may fall back per file.
    }
    return map;
}

export function buildRenameMapFromJson(stdout: string): Map<string, string> {
    const map = new Map<string, string>();
    const json = JSON.parse(stdout) as JsonStatusResponse;
    const files = json.payload?.files ?? [];
    for (const file of files) {
        if (file.state === 'renamed' && file.name && file.priorName) {
            map.set(
                normalizeRelativePath(file.name),
                normalizeRelativePath(file.priorName)
            );
        }
    }
    return map;
}
