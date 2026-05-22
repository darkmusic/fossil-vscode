import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveChangeCommand } from '../openChange';
import { findMergeSidecars } from '../mergeConflict';
import * as fs from 'fs';
import * as os from 'os';

const repoDir = path.join(os.tmpdir(), 'fossil-openchange-test');

suite('openChange', () => {
    test('CONFLICT opens working file not baseline diff', () => {
        const filePath = path.join(repoDir, 'conflicted.txt');
        const uri = vscode.Uri.file(filePath);
        const cmd = resolveChangeCommand(uri, 'CONFLICT', repoDir, {
            openDiffOnClick: true,
        });
        assert.equal(cmd.command, 'vscode.open');
        assert.deepEqual(cmd.arguments, [uri]);
    });

    test('EDITED still opens diff when openDiffOnClick is true', () => {
        const filePath = path.join(repoDir, 'edited.txt');
        const uri = vscode.Uri.file(filePath);
        const cmd = resolveChangeCommand(uri, 'EDITED', repoDir, {
            openDiffOnClick: true,
        });
        assert.equal(cmd.command, 'vscode.diff');
        assert.equal(cmd.arguments?.length, 3);
    });
});

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
