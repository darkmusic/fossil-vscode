//
// Integration tests require Fossil on PATH and an opened test repository:
//   cd src/test/test_repo && fossil open TestRepo.fossil
//

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, execSync } from 'child_process';
import * as fossilSCM from '../extension';

const testRepoPath = path.join(__dirname, '..', '..', 'src', 'test', 'test_repo');
const file1Path = path.join(testRepoPath, 'File1.txt');

function isFossilAvailable(): boolean {
    try {
        execFileSync('fossil', ['version'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

function isTestRepoOpen(): boolean {
    return (
        fs.existsSync(path.join(testRepoPath, '.fslckout')) ||
        fs.existsSync(path.join(testRepoPath, '_FOSSIL_'))
    );
}

const canRun = isFossilAvailable() && isTestRepoOpen();

suite('Extension Tests', function () {
    suiteSetup(function () {
        if (!canRun) {
            console.log(
                'Skipping Fossil integration tests: fossil not on PATH or test repo not opened.'
            );
            console.log(
                'Open the test repo with: cd src/test/test_repo && fossil open TestRepo.fossil'
            );
            this.skip();
        }
    });

    setup(function () {
        fossilSCM.init(testRepoPath);
    });

    test('Retrieve status', async function () {
        await fossilSCM.getFossilStatus();
        assert.equal(
            fossilSCM.getStateCount(),
            0,
            'State count should be 0 when there are no changes.'
        );
    });

    test('Add file and retrieve status', async function () {
        execSync(`fossil add "${file1Path}"`, { cwd: testRepoPath });
        await fossilSCM.getFossilStatus();
        assert.equal(
            fossilSCM.getStateCount(),
            1,
            'State count should be 1, but was: ' + fossilSCM.getStateCount()
        );
        execSync(`fossil revert "${file1Path}"`, { cwd: testRepoPath });
    });

    test('Remove file and retrieve status', async function () {
        execSync(`fossil add "${file1Path}"`, { cwd: testRepoPath });
        execSync(`fossil rm "${file1Path}"`, { cwd: testRepoPath });
        await fossilSCM.getFossilStatus();
        assert.equal(
            fossilSCM.getStateCount(),
            1,
            'State count should be 1 for deleted file, but was: ' +
                fossilSCM.getStateCount()
        );
        execSync('fossil undo', { cwd: testRepoPath });
    });
});
