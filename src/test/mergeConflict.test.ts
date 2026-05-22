//
// Unit tests for Fossil merge conflict sidecar detection.
//

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { findMergeSidecars } from '../mergeConflict';

suite('mergeConflict', () => {
    test('findMergeSidecars returns paths when all sidecars exist', () => {
        const dir = fs.mkdtempSync(
            path.join(os.tmpdir(), 'fossil-sidecar-')
        );
        const working = path.join(dir, 'file.txt');
        try {
            fs.writeFileSync(working, '<<<<<<< conflict\n');
            fs.writeFileSync(`${working}-baseline`, 'base\n');
            fs.writeFileSync(`${working}-original`, 'local\n');
            fs.writeFileSync(`${working}-merge`, 'remote\n');
            const sidecars = findMergeSidecars(working);
            assert.ok(sidecars);
            assert.equal(sidecars.baseline, `${working}-baseline`);
            assert.equal(sidecars.original, `${working}-original`);
            assert.equal(sidecars.merge, `${working}-merge`);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    test('findMergeSidecars returns undefined when sidecars missing', () => {
        const dir = fs.mkdtempSync(
            path.join(os.tmpdir(), 'fossil-sidecar-missing-')
        );
        const working = path.join(dir, 'file.txt');
        try {
            fs.writeFileSync(working, 'no sidecars\n');
            assert.equal(findMergeSidecars(working), undefined);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
