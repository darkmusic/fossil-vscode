//
// Resets the integration test Fossil checkout to a clean baseline so local
// development and git commits are not left dirty after `npm test`.
//

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/** Matches File1.txt content committed in git (src/test/test_repo/File1.txt). */
export const FILE1_BASELINE = 'Test\n';

/** Untracked or test-only paths created by integration tests. */
export const TEST_ARTIFACT_NAMES = [
    'untracked-test.txt',
    'add-status-test.txt',
    'add-cli-test.txt',
] as const;

function runFossil(cwd: string, args: string): void {
    execSync(`fossil ${args}`, { cwd, stdio: 'pipe' });
}

function tryFossil(cwd: string, args: string): void {
    try {
        runFossil(cwd, args);
    } catch {
        // ignore
    }
}

function removeTestArtifacts(repoDir: string): void {
    for (const name of TEST_ARTIFACT_NAMES) {
        const artifactPath = path.join(repoDir, name);
        if (fs.existsSync(artifactPath)) {
            fs.unlinkSync(artifactPath);
        }
    }
}

function ensureFile1OnDisk(file1Path: string): void {
    if (!fs.existsSync(file1Path)) {
        fs.writeFileSync(file1Path, FILE1_BASELINE);
    }
}

/**
 * Revert all pending Fossil changes and restore File1.txt to the committed
 * baseline on disk and in the checkout.
 */
export function resetTestRepo(repoDir: string): void {
    const file1Path = path.join(repoDir, 'File1.txt');

    removeTestArtifacts(repoDir);
    ensureFile1OnDisk(file1Path);

    // Revert all pending checkout changes (no --all flag; bare "revert" means all).
    tryFossil(repoDir, 'revert');

    ensureFile1OnDisk(file1Path);
    tryFossil(repoDir, `revert "${file1Path}"`);

    if (fs.existsSync(file1Path)) {
        const content = fs.readFileSync(file1Path, 'utf8');
        if (content !== FILE1_BASELINE) {
            fs.writeFileSync(file1Path, FILE1_BASELINE);
            tryFossil(repoDir, `revert "${file1Path}"`);
        }
    } else {
        fs.writeFileSync(file1Path, FILE1_BASELINE);
        tryFossil(repoDir, `revert "${file1Path}"`);
    }

    // Remove extra/unmanaged files left by tests (--force for non-interactive).
    tryFossil(repoDir, 'clean --force');
    tryFossil(repoDir, 'clean -f');
}
