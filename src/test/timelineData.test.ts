//
// Unit tests for timeline path resolution and TimelineItem mapping.
//

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    timelinePathFromUri,
    commitTouchesPath,
    fileAddedInCheckin,
    mapCheckinsToTimelineItems,
    shortCheckinId,
    TimelineCheckinEntry,
} from '../timelineData';

const repoDir = '/tmp/test-repo';

suite('timelinePathFromUri', () => {
    test('returns forward-slash relative path', () => {
        const uri = vscode.Uri.file(path.join(repoDir, 'src', 'file.ts'));
        assert.equal(
            timelinePathFromUri(uri, repoDir),
            'src/file.ts'
        );
    });

    test('rejects paths outside checkout', () => {
        const uri = vscode.Uri.file('/other/file.ts');
        assert.throws(() => timelinePathFromUri(uri, repoDir));
    });

    test('rejects non-file schemes', () => {
        const uri = vscode.Uri.parse('fossil:/src/file.ts?root=%2Ftmp');
        assert.throws(() => timelinePathFromUri(uri, repoDir));
    });
});

suite('commitTouchesPath', () => {
    test('matches exact file path', () => {
        const entry: TimelineCheckinEntry = {
            type: 'checkin',
            uuid: 'abc',
            timestamp: 1,
            files: [{ name: 'src/foo.ts', state: 'modified' }],
        };
        assert.equal(commitTouchesPath(entry, 'src/foo.ts'), true);
    });

    test('matches files under directory path', () => {
        const entry: TimelineCheckinEntry = {
            type: 'checkin',
            uuid: 'abc',
            timestamp: 1,
            files: [{ name: 'src/foo.ts', state: 'added' }],
        };
        assert.equal(commitTouchesPath(entry, 'src'), true);
    });

    test('rejects commits that only touch other files', () => {
        const entry: TimelineCheckinEntry = {
            type: 'checkin',
            uuid: 'abc',
            timestamp: 1,
            files: [{ name: 'b.txt', state: 'added' }],
        };
        assert.equal(commitTouchesPath(entry, 'a.txt'), false);
    });

    test('rejects commits with no file list', () => {
        const entry: TimelineCheckinEntry = {
            type: 'checkin',
            uuid: 'abc',
            timestamp: 1,
        };
        assert.equal(commitTouchesPath(entry, 'a.txt'), false);
    });
});

suite('shortCheckinId', () => {
    test('truncates long uuid', () => {
        assert.equal(
            shortCheckinId('f38d9a74d0f116e7d1c4ab7f83b6ce228f768558'),
            'f38d9a74d0'
        );
    });
});

suite('fileAddedInCheckin', () => {
    test('detects added state for path', () => {
        assert.equal(
            fileAddedInCheckin(
                {
                    type: 'checkin',
                    uuid: 'x',
                    timestamp: 1,
                    files: [{ name: 'a.txt', state: 'added' }],
                },
                'a.txt'
            ),
            true
        );
        assert.equal(
            fileAddedInCheckin(
                {
                    type: 'checkin',
                    uuid: 'x',
                    timestamp: 1,
                    files: [{ name: 'a.txt', state: 'modified' }],
                },
                'a.txt'
            ),
            false
        );
    });
});

suite('mapCheckinsToTimelineItems', () => {
    const fileUri = vscode.Uri.file(path.join(repoDir, 'README.md'));

    test('maps comment, user, timestamp, and command', () => {
        const entries: TimelineCheckinEntry[] = [
            {
                type: 'checkin',
                uuid: 'f38d9a74d0f116e7d1c4ab7f83b6ce228f768558304f415d308e9b96723db191',
                timestamp: 1537038308,
                user: 'Thomas',
                comment: 'initial empty check-in',
                tags: ['trunk'],
            },
        ];

        const items = mapCheckinsToTimelineItems(
            entries,
            fileUri,
            'README.md'
        );
        assert.equal(items.length, 1);
        const item = items[0];
        assert.equal(item.label, 'initial empty check-in');
        assert.equal(item.timestamp, 1537038308 * 1000);
        assert.equal(item.id, entries[0].uuid);
        assert.equal(item.description, 'Thomas [trunk]');
        assert.equal(item.contextValue, 'fossilCommit');
        assert.equal(item.command?.command, 'fossil.timeline.openDiff');
        assert.deepEqual(item.command?.arguments, [
            fileUri,
            entries[0].uuid,
            undefined,
            false,
        ]);
    });

    test('passes parent uuid and added flag in command args', () => {
        const parent = 'parent-uuid-full-hash-here';
        const child = 'child-uuid-full-hash-here';
        const items = mapCheckinsToTimelineItems(
            [
                {
                    type: 'checkin',
                    uuid: child,
                    timestamp: 2000,
                    parents: [parent],
                    files: [{ name: 'README.md', state: 'modified' }],
                },
            ],
            fileUri,
            'README.md'
        );
        assert.deepEqual(items[0].command?.arguments, [
            fileUri,
            child,
            parent,
            false,
        ]);
    });

    test('uses short hash when comment is empty', () => {
        const uuid = 'abcdef0123456789';
        const items = mapCheckinsToTimelineItems(
            [
                {
                    type: 'checkin',
                    uuid,
                    timestamp: 1000,
                },
            ],
            fileUri,
            'README.md'
        );
        assert.equal(items[0].label, shortCheckinId(uuid));
    });
});
