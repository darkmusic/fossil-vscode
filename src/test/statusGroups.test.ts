import * as assert from 'assert';
import { isUnmanagedStatus } from '../statusGroups';

suite('statusGroups', () => {
    test('isUnmanagedStatus identifies UNMANAGE and EXTRA', () => {
        assert.strictEqual(isUnmanagedStatus('UNMANAGE'), true);
        assert.strictEqual(isUnmanagedStatus('EXTRA'), true);
    });

    test('isUnmanagedStatus rejects tracked change types', () => {
        assert.strictEqual(isUnmanagedStatus('EDITED'), false);
        assert.strictEqual(isUnmanagedStatus('DELETED'), false);
        assert.strictEqual(isUnmanagedStatus('ADDED'), false);
        assert.strictEqual(isUnmanagedStatus('RENAMED'), false);
        assert.strictEqual(isUnmanagedStatus('CONFLICT'), false);
    });
});
