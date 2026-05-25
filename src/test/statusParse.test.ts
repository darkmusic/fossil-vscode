import * as assert from 'assert';
import { parseStatusLine, parseStatusOutput } from '../statusParse';

suite('statusParse', () => {
    test('parseStatusLine parses MISSING', () => {
        const parsed = parseStatusLine('MISSING    src/foo.txt');
        assert.ok(parsed);
        assert.equal(parsed.type, 'MISSING');
        assert.equal(parsed.relativePath, 'src/foo.txt');
    });

    test('parseStatusOutput ignores header lines', () => {
        const stdout = [
            'repository: /tmp/repo.fossil',
            'MISSING    File1.txt',
            'EDITED     other.txt',
        ].join('\n');
        const entries = parseStatusOutput(stdout);
        assert.equal(entries.length, 2);
        assert.equal(entries[0].type, 'MISSING');
        assert.equal(entries[1].type, 'EDITED');
    });
});
