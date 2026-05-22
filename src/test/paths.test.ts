import * as assert from 'assert';
import * as path from 'path';
import {
    isAbsolutePathInsideRepo,
    normalizeRelativePath,
    toAbsolutePathInsideRepo,
} from '../paths';

const repoDir = path.join('/tmp', 'fossil-checkout');

suite('paths', () => {
    test('toAbsolutePathInsideRepo accepts paths under the checkout', () => {
        const inside = toAbsolutePathInsideRepo(repoDir, 'src/foo.ts');
        assert.equal(inside, path.resolve(repoDir, 'src/foo.ts'));
        assert.ok(
            isAbsolutePathInsideRepo(repoDir, inside!),
            'resolved path should be inside repo'
        );
    });

    test('normalizeRelativePath converts backslashes to forward slashes', () => {
        assert.equal(
            normalizeRelativePath('src\\dir\\file.ts'),
            'src/dir/file.ts'
        );
    });

    test('toAbsolutePathInsideRepo rejects paths that escape via ..', () => {
        assert.equal(
            toAbsolutePathInsideRepo(repoDir, '../outside.txt'),
            undefined
        );
        assert.equal(
            toAbsolutePathInsideRepo(repoDir, 'src/../../outside.txt'),
            undefined
        );
    });
});
