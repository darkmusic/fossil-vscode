//
// Integration tests require Fossil on PATH and an opened test repository:
//   cd src/test/test_repo && fossil open TestRepo.fossil
//

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, execSync } from 'child_process';
import * as fossilSCM from '../extension';
import { runFossilCat } from '../fossilContentProvider';
import { runFossil } from '../fossilCli';
import { FILE1_BASELINE, resetTestRepo } from './testRepoReset';

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
        resetTestRepo(testRepoPath);
    });

    setup(function () {
        resetTestRepo(testRepoPath);
        fossilSCM.init(testRepoPath);
    });

    teardown(function () {
        resetTestRepo(testRepoPath);
    });

    suiteTeardown(function () {
        if (canRun) {
            resetTestRepo(testRepoPath);
        }
    });

    test('runFossilCat returns file content from repository', async function () {
        const content = await runFossilCat('File1.txt', testRepoPath);
        assert.ok(typeof content === 'string');
    });

    test('Retrieve status', async function () {
        await fossilSCM.getFossilStatus();
        assert.equal(
            fossilSCM.getStateCount(),
            0,
            'State count should be 0 when there are no changes.'
        );
    });

    test('Unmanaged file appears in status', async function () {
        const untrackedPath = path.join(testRepoPath, 'untracked-test.txt');
        fs.writeFileSync(untrackedPath, 'new file\n');
        try {
            await fossilSCM.getFossilStatus();
            assert.equal(
                fossilSCM.getStateCount(),
                1,
                'State count should be 1 for unmanaged file, but was: ' +
                    fossilSCM.getStateCount()
            );
        } finally {
            fs.unlinkSync(untrackedPath);
        }
    });

    test('Add file and retrieve status', async function () {
        const newPath = path.join(testRepoPath, 'add-status-test.txt');
        fs.writeFileSync(newPath, 'new\n');
        try {
            execSync(`fossil add "${newPath}"`, { cwd: testRepoPath });
            await fossilSCM.getFossilStatus();
            assert.equal(
                fossilSCM.getStateCount(),
                1,
                'State count should be 1, but was: ' + fossilSCM.getStateCount()
            );
            execSync(`fossil revert "${newPath}"`, { cwd: testRepoPath });
        } finally {
            if (fs.existsSync(newPath)) {
                fs.unlinkSync(newPath);
            }
        }
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
    });

    test('fossil add via CLI shows ADDED in status', async function () {
        const untrackedPath = path.join(testRepoPath, 'add-cli-test.txt');
        fs.writeFileSync(untrackedPath, 'add me\n');
        try {
            await fossilSCM.getFossilStatus();
            assert.equal(fossilSCM.getStateCount(), 1);
            await runFossil(['add', untrackedPath], testRepoPath);
            await fossilSCM.getFossilStatus();
            assert.equal(
                fossilSCM.getStateCount(),
                1,
                'ADDED file should appear in status'
            );
            await runFossil(['add', '--reset', untrackedPath], testRepoPath);
            await fossilSCM.getFossilStatus();
            assert.equal(
                fossilSCM.getStateCount(),
                1,
                'reset add should return file to EXTRA/unmanaged'
            );
        } finally {
            if (fs.existsSync(untrackedPath)) {
                fs.unlinkSync(untrackedPath);
            }
        }
    });

    test('locally deleted file appears as MISSING', async function () {
        fs.unlinkSync(file1Path);
        await fossilSCM.getFossilStatus();
        const counts = fossilSCM.getStatusGroupCounts();
        assert.equal(
            counts.missing,
            1,
            'locally deleted tracked file should appear under Missing'
        );
        assert.equal(counts.tracked, 0);
        await runFossil(['rm', file1Path], testRepoPath);
        await fossilSCM.getFossilStatus();
        const afterRm = fossilSCM.getStatusGroupCounts();
        assert.equal(afterRm.missing, 0);
        assert.equal(afterRm.tracked, 1);
    });

    test('fossil revert restores edited file', async function () {
        const original = fs.readFileSync(file1Path, 'utf8');
        assert.equal(original, FILE1_BASELINE);
        fs.writeFileSync(file1Path, original + '\nedited\n');
        await fossilSCM.getFossilStatus();
        assert.ok(
            fossilSCM.getStateCount() >= 1,
            'edited file should appear in status'
        );
        await runFossil(['revert', file1Path], testRepoPath);
        await fossilSCM.getFossilStatus();
        assert.equal(
            fs.readFileSync(file1Path, 'utf8'),
            original,
            'revert should restore file content'
        );
    });
});
