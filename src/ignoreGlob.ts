'use strict';

import * as fs from 'fs';
import * as path from 'path';

export const VERSIONED_IGNORE_GLOB_PATH = path.join(
    '.fossil-settings',
    'ignore-glob'
);

/**
 * Read the checkout's versioned ignore setting. Passing this value to Fossil
 * explicitly prevents a status refresh from reusing an out-of-date setting.
 */
export async function readVersionedIgnoreGlob(
    repoDir: string
): Promise<string | undefined> {
    try {
        return await fs.promises.readFile(
            path.join(repoDir, VERSIONED_IGNORE_GLOB_PATH),
            'utf8'
        );
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return undefined;
        }
        throw err;
    }
}

export function isVersionedIgnoreGlob(
    filePath: string,
    repoDir: string
): boolean {
    if (!repoDir) {
        return false;
    }
    return (
        path.resolve(filePath) ===
        path.resolve(repoDir, VERSIONED_IGNORE_GLOB_PATH)
    );
}

export function appendIgnoreGlobOverride(
    args: string[],
    ignoreGlob: string | undefined
): string[] {
    return ignoreGlob === undefined
        ? args
        : [...args, '--ignore', ignoreGlob];
}
