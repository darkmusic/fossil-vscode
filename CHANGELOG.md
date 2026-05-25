# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)  
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-05-25

First release published to the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=darkmusic.fossil-scm). Same extension as [1.0.0](#100---2026-05-25); install from the Marketplace or [GitHub Releases](https://github.com/darkmusic/fossil-vscode/releases).

### Fixed

- **`publish:marketplace` npm script** (`vsce publish`) so the **Create Release** workflow can publish the tagged VSIX to the Marketplace. The `v1.0.0` release failed because this script was missing.

## [1.0.0] - 2026-05-25

Pre–Marketplace release (GitHub Release with VSIX only). Marketplace publish was attempted from CI but did not run successfully; use **1.0.1** or later for Marketplace installs.

### Added

- **Source Control groups:** **In Checkout** (tracked changes) and **Not in Checkout** (unmanaged `EXTRA` / `UNMANAGE`) instead of a single **Changes** list.
- **Missing** Source Control group for locally deleted tracked files (`fossil status --missing`), with **MISSING** status mapping, **Mark as Deleted** (`fossil rm`), and **Revert** to restore from the repository.
- **Commit guard** when missing files are present, with an explanation before `fossil commit` runs.
- **Commit in progress:** SCM progress indicator, disabled commit message input, and spinning commit toolbar icon while `fossil commit` runs.
- **Fossil UI starting:** Spinner on the Start button while `fossil ui` boots; Stop appears when the server is ready.
- **Fossil Log** output channel (`View → Output → Fossil Log`) with timestamped operational logging for Fossil CLI commands, SCM actions, timeline operations, Fossil UI, and errors.
- **Nested Fossil checkout discovery** under a Git (or other) workspace root, with **active editor–aware binding** when multiple checkouts exist (the checkout that contains the open file is preferred).
- **Extension icon** (`resources/icons/icon.png`).
- **Create Release** workflow step intended to publish the tagged VSIX to the Visual Studio Marketplace (`VSCE_PAT`); completed in **1.0.1** once `publish:marketplace` was added.

### Changed

- Status refresh runs `fossil status --differ` and `fossil status --missing` in parallel.
- Click-to-open diff (`fossilScm.openDiffOnClick`) and the **View Timeline (output)** context menu apply to both **In Checkout** and **Not in Checkout** (formerly only the single **Changes** group).
- Fossil SCM re-initializes and refreshes when the active editor moves between files in different nested checkouts.
- README updated for the new SCM groups, **Fossil Log**, missing-file workflow, Cursor compatibility, and consolidated screenshots (`doc/main.png`, `doc/timeline.png`).
- Integration tests reset the bundled test checkout after the suite so local `git` working trees are not left dirty.

### Fixed

- Timeline provider registration failures no longer prevent extension activation; timeline features are skipped with a **Fossil Log** message when the API is unavailable (for example in some Cursor builds).

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

[1.0.1]: https://github.com/darkmusic/fossil-vscode/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/darkmusic/fossil-vscode/compare/v0.0.1...v1.0.0
[0.0.1]: https://github.com/darkmusic/fossil-vscode/releases/tag/v0.0.1
