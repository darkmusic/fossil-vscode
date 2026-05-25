import * as assert from 'assert';
import { formatLogLine } from '../fossilLog';

suite('fossilLog', () => {
    test('formatLogLine prefixes message with timestamp', () => {
        const line = formatLogLine('Hello', new Date('2026-05-25T14:30:45'));
        assert.strictEqual(line, '[14:30:45] Hello');
    });
});
