//
// Unit tests for rename map parsing from fossil json status.
//

import * as assert from 'assert';
import { buildRenameMapFromJson } from '../renameInfo';

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
