'use strict';

import * as vscode from 'vscode';
import { workspace, scm, Uri } from 'vscode';
import { execSync } from 'child_process';
const path = require('path');
const { exec } = require('child_process');
var extensionPath = "";

function createResourceUri(relativePath: string): vscode.Uri {
  const absolutePath = path.join(vscode.workspace.rootPath, relativePath);
  return vscode.Uri.file(absolutePath);
}

const fossilSCM = vscode.scm.createSourceControl('fossil', "Fossil", Uri.parse(vscode.workspace.rootPath));
const workingTree = fossilSCM.createResourceGroup('workingTree', "Changes");
workingTree.hideWhenEmpty = true;

enum Operation {
  Add = 'added',
  Delete = 'deleted',
  Modify = 'modified'
}

enum ThemeType {
  Light = 'light',
  Dark = 'dark'
}

function getIconPath(operation: Operation, themeType: ThemeType): string {
  return path.join(extensionPath, "resources/icons/" + themeType + "/status-" + operation + ".svg");
}

export function getFossilStatus() {
  let rootPath = vscode.workspace.rootPath;
  if (rootPath == undefined) {
    return;
  }

  let result = exec(`cd ${rootPath} && fossil status`, (err, stdout, stderr) => {
    if (err) {
      console.log('Could not execute command.');
      console.log(`stderr: ${stderr}`);
    }
    
    let lines = stdout.split("\n");
    let l = lines.length;
    var states = [];

    lines.forEach(line => {
      if (line.length > 0) {
        if (line.startsWith("DELETED")) {
          var fileUri = line.substr(8).trim();
          var delState = {
            resourceUri: createResourceUri(fileUri),
            decorations: {
              strikeThrough: true,
              tooltip: "Deleted",
              faded: true,
              dark: {
                iconPath: getIconPath(Operation.Delete, ThemeType.Dark)
              },
              light: {
                iconPath: getIconPath(Operation.Delete, ThemeType.Light)
              }
            }
          }
          states.push(delState);
        }
        else if (line.startsWith("EDITED")) {
          var fileUri = line.substr(8).trim();
          var editState = {
            resourceUri: createResourceUri(fileUri),
            decorations: {
              tooltip: "Modified",
              dark: {
                iconPath: getIconPath(Operation.Modify, ThemeType.Dark)
              },
              light: {
                iconPath: getIconPath(Operation.Modify, ThemeType.Light)
              }
            }
          }
          states.push(editState);
        }
        else if (line.startsWith("ADDED")) {
          var fileUri = line.substr(6).trim();
          var addState = {
            resourceUri: createResourceUri(fileUri),
            decorations: {
              tooltip: "Added",
              dark: {
                iconPath: getIconPath(Operation.Add, ThemeType.Dark)
              },
              light: {
                iconPath: getIconPath(Operation.Add, ThemeType.Light)
              }
            }
          }
          states.push(addState);
        }
      }
    });

    workingTree.resourceStates = states;
    fossilSCM.count = states.length;
  });
  
  
}

export function activate(context: vscode.ExtensionContext) {
    console.log('fossil-scm extension activated.');
    extensionPath = context.extensionPath;

    const fsWatcher = workspace.createFileSystemWatcher("**");
    fsWatcher.onDidChange(() => { getFossilStatus(); });
    fsWatcher.onDidCreate(() => { getFossilStatus(); });
    fsWatcher.onDidDelete(() => { getFossilStatus(); });

    let disposable = vscode.commands.registerCommand('extension.fossilSCM', () => {
        getFossilStatus();
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(fsWatcher);
}

export function deactivate() {
}