import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
    findFossilCheckoutsUnder,
    isFossilCheckoutDir,
    selectFossilCheckout,
} from '../fossilCheckoutDiscovery';

const repoRoot = path.join(__dirname, '..', '..');
const testCheckout = path.join(repoRoot, 'src', 'test', 'test_repo');

suite('fossilCheckoutDiscovery', () => {
    test('isFossilCheckoutDir detects test_repo checkout', function () {
        assert.ok(isFossilCheckoutDir(testCheckout));
        assert.ok(!isFossilCheckoutDir(repoRoot));
    });

    test('findFossilCheckoutsUnder finds nested checkout under git root', function () {
        if (!fs.existsSync(path.join(testCheckout, '.fslckout'))) {
            this.skip();
        }
        const checkouts = findFossilCheckoutsUnder(repoRoot);
        assert.ok(
            checkouts.some((c) => path.resolve(c) === path.resolve(testCheckout)),
            `expected ${testCheckout} in ${checkouts.join(', ')}`
        );
    });

    test('selectFossilCheckout prefers checkout containing active file', function () {
        const fileInTestRepo = path.join(testCheckout, 'File1.txt');
        const selected = selectFossilCheckout(
            [path.resolve(repoRoot), path.resolve(testCheckout)],
            fileInTestRepo
        );
        assert.equal(path.resolve(selected!), path.resolve(testCheckout));
    });
});
