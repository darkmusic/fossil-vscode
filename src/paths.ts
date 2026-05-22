'use strict';

import * as path from 'path';

/** Forward-slash form for map keys and Fossil CLI paths (portable across platforms). */
export function normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/');
}

/** True when `absolutePath` is the checkout root or a path beneath it. */
export function isAbsolutePathInsideRepo(
    repoDir: string,
    absolutePath: string
): boolean {
    const root = path.resolve(repoDir);
    const target = path.resolve(absolutePath);
    return (
        target === root || target.startsWith(root + path.sep)
    );
}

/**
 * Resolve a repo-relative path to an absolute path inside the checkout, or
 * undefined if it escapes the checkout root (e.g. contains `..` segments).
 */
export function toAbsolutePathInsideRepo(
    repoDir: string,
    relativePath: string
): string | undefined {
    const absolute = path.resolve(repoDir, relativePath);
    return isAbsolutePathInsideRepo(repoDir, absolute)
        ? absolute
        : undefined;
}
