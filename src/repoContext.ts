'use strict';

let repoDir = '';

export function getRepoDir(): string {
    return repoDir;
}

export function setRepoDir(dir: string): void {
    repoDir = dir;
}
