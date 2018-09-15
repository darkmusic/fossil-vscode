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
const { execSync } = require('child_process');

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {
    test("Retrieve status", () => {
        // Note:fossil repository must be opened first
        // e.g.:
        // cd src\test\test_repo
        // fossil open TestRepo.fossil
        fossilSCM.init(__dirname + "\\..\\..\\src\\test\\test_repo");
        fossilSCM.getFossilStatus();
    })
});