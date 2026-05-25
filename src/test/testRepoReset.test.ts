import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { FILE1_BASELINE, resetTestRepo } from './testRepoReset';

const testRepoPath = path.join(__dirname, '..', '..', 'src', 'test', 'test_repo');

function canReset(): boolean {
    try {
        execFileSync('fossil', ['version'], { stdio: 'pipe' });
        return (
            fs.existsSync(path.join(testRepoPath, '.fslckout')) ||
            fs.existsSync(path.join(testRepoPath, '_FOSSIL_'))
        );
    } catch {
        return false;
    }
}

suite('testRepoReset', () => {
    suiteSetup(function () {
        if (!canReset()) {
            this.skip();
        }
    });

    test('resetTestRepo leaves clean status and File1.txt on disk', function () {
        const file1Path = path.join(testRepoPath, 'File1.txt');
        fs.unlinkSync(file1Path);
        resetTestRepo(testRepoPath);
        assert.ok(fs.existsSync(file1Path));
        assert.equal(fs.readFileSync(file1Path, 'utf8'), FILE1_BASELINE);
        const status = execFileSync('fossil', ['status'], {
            cwd: testRepoPath,
            encoding: 'utf8',
        });
        assert.ok(!/^(EDITED|DELETED|ADDED|MISSING|EXTRA|UNMANAGE|RENAMED|CONFLICT)\s/m.test(status));
    });
});
