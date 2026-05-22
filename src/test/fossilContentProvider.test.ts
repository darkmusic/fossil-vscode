//
// Unit tests for fossil virtual document URIs.
//

import * as assert from 'assert';
import {
    toFossilUri,
    toFossilEmptyUri,
    parseVirtualUri,
} from '../fossilContentProvider';

const repoDir = '/tmp/test-repo';

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

    test('scm and quickdiff contexts produce distinct URIs', () => {
        const scm = toFossilUri('src/a.txt', repoDir, undefined, 'scm');
        const quickdiff = toFossilUri(
            'src/a.txt',
            repoDir,
            undefined,
            'quickdiff'
        );
        assert.notEqual(scm.toString(), quickdiff.toString());
    });
});
