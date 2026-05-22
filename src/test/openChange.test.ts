//
// Unit tests for open-change command resolution and rename map parsing.
//

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveChangeCommand } from '../openChange';
import {
    toFossilUri,
    toFossilEmptyUri,
    parseVirtualUri,
} from '../fossilContentProvider';
import { buildRenameMapFromJson } from '../renameInfo';
import { normalizeRelativePath } from '../paths';

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

suite('fossilContentProvider URIs', () => {
    test('toFossilUri round-trips via parseVirtualUri', () => {
        const uri = toFossilUri('src/a.txt', repoDir);
        const parsed = parseVirtualUri(uri);
        assert.equal(parsed.relativePath, 'src/a.txt');
        assert.equal(parsed.repoDir, repoDir);
    });

    test('toFossilEmptyUri uses fossil-empty scheme', () => {
        const uri = toFossilEmptyUri('new.txt', repoDir);
        assert.equal(uri.scheme, 'fossil-empty');
    });
});

suite('normalizeRelativePath', () => {
    test('converts backslashes to forward slashes', () => {
        assert.equal(
            normalizeRelativePath('src\\dir\\file.ts'),
            'src/dir/file.ts'
        );
    });
});

suite('buildRenameMapFromJson', () => {
    test('extracts priorName for renamed files', () => {
        const json = JSON.stringify({
            payload: {
                files: [
                    {
                        state: 'renamed',
                        name: 'dir\\new.txt',
                        priorName: 'dir\\old.txt',
                    },
                    { state: 'edited', name: 'other.txt' },
                ],
            },
        });
        const map = buildRenameMapFromJson(json);
        assert.equal(map.get('dir/new.txt'), 'dir/old.txt');
        assert.equal(map.size, 1);
    });
});
