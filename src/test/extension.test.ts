//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as fossilSCM from '../extension';
import { print } from 'util';
const { execSync } = require('child_process');

// Note:fossil repository must be opened first
// e.g.:
// cd src\test\test_repo
// fossil open TestRepo.fossil
suite("Extension Tests", () => {
    test("Retrieve status", () => {
        fossilSCM.init("file://" + __dirname + "/../../src/test/test_repo");
        fossilSCM.getFossilStatus().then(() =>
            assert.equal(fossilSCM.getStateCount(), undefined, "State count should be undefined.")
        );
    });
    test("Add file and retrieve status", () => {
        fossilSCM.init("file://" + __dirname + "/../../src/test/test_repo");
        execSync("fossil add " + __dirname + "/../../src/test/test_repo/File1.txt");
        fossilSCM.getFossilStatus().then(() =>
            assert.equal(fossilSCM.getStateCount(), 1, "State count should be 1, but was: " + fossilSCM.getStateCount())
        );
    });
    test("Remove file and retrieve status", () => {
        fossilSCM.init("file://" + __dirname + "/../../src/test/test_repo");
        execSync("fossil rm " + __dirname + "/../../src/test/test_repo/File1.txt");
        fossilSCM.getFossilStatus().then(() =>
            assert.equal(fossilSCM.getStateCount(), 0, "State count should be 0, but was: " + fossilSCM.getStateCount())
        );
    });
});