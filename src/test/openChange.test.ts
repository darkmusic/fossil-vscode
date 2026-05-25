//
// Unit tests for open-change command resolution.
//

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveChangeCommand } from '../openChange';
import { parseVirtualUri } from '../fossilContentProvider';

const repoDir = '/tmp/test-repo';
const filePath = path.join(repoDir, 'src', 'file.ts');
const resourceUri = vscode.Uri.file(filePath);

suite('resolveChangeCommand', () => {
    test('EDITED opens vscode.diff with fossil left URI', () => {
        const cmd = resolveChangeCommand(resourceUri, 'EDITED', repoDir, {
            openDiffOnClick: true,
        });
        assert.equal(cmd.command, 'vscode.diff');
        const left = cmd.arguments![0] as vscode.Uri;
        assert.equal(left.scheme, 'fossil');
        assert.equal(cmd.arguments![1], resourceUri);
    });

    test('CONFLICT opens working file not baseline diff', () => {
        const cmd = resolveChangeCommand(resourceUri, 'CONFLICT', repoDir, {
            openDiffOnClick: true,
        });
        assert.equal(cmd.command, 'vscode.open');
        assert.deepEqual(cmd.arguments, [resourceUri]);
    });

    test('ADDED opens vscode.diff with fossil-empty left URI', () => {
        const cmd = resolveChangeCommand(resourceUri, 'ADDED', repoDir, {
            openDiffOnClick: true,
        });
        assert.equal(cmd.command, 'vscode.diff');
        const left = cmd.arguments![0] as vscode.Uri;
        assert.equal(left.scheme, 'fossil-empty');
    });

    test('DELETED opens repository version only', () => {
        const cmd = resolveChangeCommand(resourceUri, 'DELETED', repoDir, {
            openDiffOnClick: true,
        });
        assert.equal(cmd.command, 'vscode.open');
        const left = cmd.arguments![0] as vscode.Uri;
        assert.equal(left.scheme, 'fossil');
    });

    test('MISSING opens repository version only', () => {
        const cmd = resolveChangeCommand(resourceUri, 'MISSING', repoDir, {
            openDiffOnClick: true,
        });
        assert.equal(cmd.command, 'vscode.open');
        const left = cmd.arguments![0] as vscode.Uri;
        assert.equal(left.scheme, 'fossil');
    });

    test('RENAMED uses priorPath for left URI', () => {
        const cmd = resolveChangeCommand(resourceUri, 'RENAMED', repoDir, {
            openDiffOnClick: true,
            priorPath: 'old/file.ts',
        });
        assert.equal(cmd.command, 'vscode.diff');
        const left = cmd.arguments![0] as vscode.Uri;
        const parsed = parseVirtualUri(left);
        assert.equal(parsed.relativePath, 'old/file.ts');
        assert.equal(parsed.repoDir, repoDir);
    });

    test('EXTRA opens working file only', () => {
        const cmd = resolveChangeCommand(resourceUri, 'EXTRA', repoDir, {
            openDiffOnClick: true,
        });
        assert.equal(cmd.command, 'vscode.open');
        assert.equal(cmd.arguments![0], resourceUri);
    });

    test('openDiffOnClick false opens working file', () => {
        const cmd = resolveChangeCommand(resourceUri, 'EDITED', repoDir, {
            openDiffOnClick: false,
        });
        assert.equal(cmd.command, 'vscode.open');
        assert.equal(cmd.arguments![0], resourceUri);
    });
});
