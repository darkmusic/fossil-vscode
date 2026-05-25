'use strict';

export interface ParsedStatusLine {
    type: string;
    relativePath: string;
}

/** Fossil status lines: "<TYPE>  <path>" (padding varies by type). */
const STATUS_LINE =
    /^(DELETED|EDITED|ADDED|UNMANAGE|EXTRA|RENAMED|CONFLICT|MISSING)\s+(.+)$/;

export function parseStatusLine(line: string): ParsedStatusLine | null {
    const match = STATUS_LINE.exec(line);
    if (!match) {
        return null;
    }
    return { type: match[1], relativePath: match[2].trim() };
}

export function parseStatusOutput(stdout: string): ParsedStatusLine[] {
    const entries: ParsedStatusLine[] = [];
    for (const line of stdout.split('\n')) {
        const parsed = parseStatusLine(line);
        if (parsed) {
            entries.push(parsed);
        }
    }
    return entries;
}
