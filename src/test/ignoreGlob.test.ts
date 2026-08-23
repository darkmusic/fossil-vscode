import * as assert from 'assert';
import * as path from 'path';
import {
    appendIgnoreGlobOverride,
    isVersionedIgnoreGlob,
} from '../ignoreGlob';

suite('ignoreGlob', () => {
    test('passes the current versioned ignore setting to Fossil', () => {
        const args = appendIgnoreGlobOverride(
            ['status', '--differ', '--dotfiles', '--hash'],
            '*.log\nbuild/*\n'
        );

        assert.deepEqual(args, [
            'status',
            '--differ',
            '--dotfiles',
            '--hash',
            '--ignore',
            '*.log\nbuild/*\n',
        ]);
    });

    test('does not override Fossil settings when no versioned file exists', () => {
        const original = ['status', '--differ', '--dotfiles', '--hash'];
        assert.strictEqual(
            appendIgnoreGlobOverride(original, undefined),
            original
        );
    });

    test('recognizes only the checkout versioned ignore file', () => {
        const repoDir = path.join(path.sep, 'workspace', 'repo');
        assert.equal(
            isVersionedIgnoreGlob(
                path.join(repoDir, '.fossil-settings', 'ignore-glob'),
                repoDir
            ),
            true
        );
        assert.equal(
            isVersionedIgnoreGlob(
                path.join(repoDir, '.fossil-settings', 'clean-glob'),
                repoDir
            ),
            false
        );
    });
});
