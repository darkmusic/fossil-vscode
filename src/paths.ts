'use strict';

/** Forward-slash form for map keys and Fossil CLI paths (portable across platforms). */
export function normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/');
}
