# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-05-22

First pre–Marketplace release. Summarizes development from the initial Fossil status integration through the current feature set.

### Added

- **Source Control integration** for Fossil checkouts (`.fslckout` or `_FOSSIL_` in the workspace), with automatic activation when a checkout is opened.
- **Changes** resource group driven by `fossil status --differ`, including tracked edits and untracked files not covered by ignore rules.
- **Merge Conflicts** resource group for files with unresolved Fossil merge markers, with conflict icons and inline merge support in the editor.
- Status mapping for Fossil states: Modified (EDITED), Deleted (DELETED), Added (ADDED), Unmanaged (UNMANAGE / EXTRA), Renamed (RENAMED), and Conflict (CONFLICT).
- **Debounced status refresh** on workspace file changes, with coalesced follow-up refreshes and manual **Refresh** (toolbar, **Fossil: Refresh**, or **Fossil SCM**).
- **Multi-root workspace** support: uses the folder that contains the checkout markers.
- **Multiple SCM providers** in one repository (e.g. Fossil alongside Git), with separate Fossil UI state.
- **SCM actions**: **Commit** (`fossil commit -m`), **Sync** (`fossil sync` with default remote, refresh on completion, warning when conflicts remain), **Add to checkout** (`fossil add`), **Reset add** (`fossil add --reset`), and **Revert** (`fossil revert`; not offered for unmanaged EXTRA / UNMANAGE files).
- **Open change / diff viewer**: click a file under Changes to diff against the checkout baseline via `fossil cat` (modified, added, deleted, renamed, and unmanaged cases).
- **Editor gutter quick diff** comparing the working tree to the Fossil baseline while editing tracked files.
- **Timeline** features:
  - **Fossil Timeline** output channel (`fossil timeline -p`) via context menu or **Fossil: View Timeline (Output)**.
  - Explorer context **Fossil: View Timeline** to refresh output and open the Timeline view.
  - **Timeline** panel source showing check-ins that touched the active file, with click-to-diff (parent vs check-in) and context actions **Open Diff** and **Copy Check-in ID**.
- **Merge editor** support for Fossil 3-way merge sidecars (`*-baseline`, `*-original`, `*-merge`) via **Fossil: Open in Merge Editor** (context menu on merge conflicts or Command Palette).
- **Fossil UI** integration: **Start Fossil UI** / **Stop Fossil UI** toolbar commands running `fossil ui` in a background process.
- **Configuration**:
  - `fossilScm.fossilExePath` — path to the Fossil executable (default `fossil`).
  - `fossilScm.openDiffOnClick` — open diff vs working tree when clicking Changes (default `true`).
- **Path resolution** utilities so SCM commands resolve paths safely within the checkout root.
- **Content providers** for Fossil repository URIs and timeline/diff handling.
- **esbuild** production bundle (`dist/`) and `npm run vsix` packaging script.
- **GitHub Actions** CI on push/PR to `main` (type-check, compile, Fossil integration tests), **VSIX Package** workflow, and **Create Release** workflow (tag `v<version>` publishes a release with VSIX).
- **Integration tests** using a bundled test Fossil repository (`src/test/test_repo`).
- **MIT** license and project documentation (README with screenshots, requirements, installation, and contributing guide).

### Changed

- Build pipeline modernized: TypeScript compiled and bundled with esbuild; extension entry point is `./dist/extension`.
- Dependencies and dev tooling updated for current VS Code extension APIs (`@vscode/test-electron`, VS Code engine `^1.95.0`).
- `fossil status` handling made asynchronous; status refresh scheduling refactored for fewer redundant CLI calls.
- README expanded with feature tables, configuration, screenshots, and release/CI instructions.

### Fixed

- URI handling compatibility with newer VS Code extension API changes.
- Transitive npm dependency security advisories (Dependabot updates through 2024).
- Test harness and CI setup restored after dependency and tooling upgrades.
