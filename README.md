# fossil-scm README

This is a plugin for [Fossil SCM](https://www.fossil-scm.org).  It is still under development.  It has not yet been released to the VSCode Marketplace.

The icons being used for the file statuses are from the [Microsoft VSCode Git Extension](https://github.com/Microsoft/vscode/tree/master/extensions/git).

## Features

Currently, it only supports a basic file listing, which is based on the command `fossil status`.

![Screenshot](doc/screenshot1.png)

## Requirements

- You will need to install [Fossil SCM](https://www.fossil-scm.org).
- [Visual Studio Code](https://code.visualstudio.com/) 1.30.2+ must be installed.

## Installation

This extension has not yet been released, but can be tested using the [Extension Development Host](https://code.visualstudio.com/docs/extension`s/testing-extensions).
You can also copy the entire source folder to your extensions folder for testing (e.g. C:\Users\myUserName\\.vscode\extensions)

## Configuration

You must configure the location to **fossil.exe** (or **fossil** on Linux) using the setting **fossilScm.fossilExePath** in *settings.json*.

## Known Issues

See [Issues](https://github.com/darkmusic/fossil-vscode/issues).

## Contributing

Contributions are welcome.

## License

See [LICENSE](LICENSE).
