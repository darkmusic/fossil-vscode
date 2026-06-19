# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)  
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.0.9](https://github.com/darkmusic/fossil-vscode/compare/v1.0.8...v1.0.9) - 2026-06-18

### Fixed

- Transitive npm dependency security advisories (Dependabot updates for `form-data`, `js-yaml`, and `markdown-it`).
- **`undici`** updated from 7.25.0 to 7.28.0 (transitive dev dependency) to address high-severity advisories [GHSA-vmh5-mc38-953g](https://github.com/advisories/GHSA-vmh5-mc38-953g) (TLS certificate validation bypass via dropped `requestTls` in SOCKS5 `ProxyAgent`) and [GHSA-pr7r-676h-xcf6](https://github.com/advisories/GHSA-pr7r-676h-xcf6) (cross-user information disclosure via shared cache whitespace bypass). Affected range: 7.0.0–7.27.2.

## [1.0.8](https://github.com/darkmusic/fossil-vscode/compare/v1.0.7...v1.0.8) - 2026-06-13

### Added

- **Open VSX publishing:** Create Release and **Release Retry** workflows publish the tagged VSIX to [Open VSX](https://open-vsx.org/) (requires `OPEN_VSX_PAT` in repository secrets). Added `publish:open-vsx` npm script and README instructions for VSCodium / Open VSX installs.

## [1.0.7](https://github.com/darkmusic/fossil-vscode/compare/v1.0.6...v1.0.7) - 2026-06-13

### Changed

- **Create Release workflow:** GitHub Release is created as a draft with the VSIX attached atomically (`gh release create … --draft`), registry publish runs in a single job, and immutable releases missing the VSIX asset fail with a clear error instead of attempting a broken upload.

## [1.0.6](https://github.com/darkmusic/fossil-vscode/compare/v1.0.5...v1.0.6) - 2026-06-13

### Fixed

- **Create Release workflow:** Verify exactly one VSIX after build, resolve the VSIX path explicitly before GitHub upload, confirm the asset exists after upload, and set `GH_REPO` so `gh release upload` targets the correct repository.

## [1.0.5](https://github.com/darkmusic/fossil-vscode/compare/v1.0.4...v1.0.5) - 2026-06-12

### Changed

- Updated dev dependencies (`esbuild`, `shell-quote`, `tmp`).

## [1.0.4](https://github.com/darkmusic/fossil-vscode/compare/v1.0.3...v1.0.4) - 2026-05-31

### Added

- **`fossilScm.crlfHandling` setting** (`accept`, `convert`, or `abort`) for Fossil’s CR/LF line-ending prompts when adding or committing files.
- **Release Retry** workflow (`release-retry.yml`) to retry Marketplace publish and GitHub Release steps after timeouts or transient failures.

### Changed

- Fossil CLI invocations use `spawn` with stdin piping so CR/LF prompts are answered automatically instead of blocking the extension.
- **Create Release workflow** split into separate build, GitHub Release, and Marketplace jobs for clearer error handling and retries.

### Fixed

- Extension no longer freezes when Fossil prompts about CR/LF line endings during add or commit operations.
- Integration test runner falls back to `codium` when the `code` CLI is unavailable.

## [1.0.3](https://github.com/darkmusic/fossil-vscode/compare/v1.0.2...v1.0.3) - 2026-05-25

### Fixed

- **Not in Checkout:** Unmanaged files whose names begin with `.` (for example `.cursorignore`) now appear in the **Not in Checkout** group. Status refresh passes Fossil’s `--dotfiles` flag to `fossil status --differ`, which is required for those paths to be listed.

## [1.0.2](https://github.com/darkmusic/fossil-vscode/compare/v1.0.1...v1.0.2) - 2026-05-25

First release successfully published to the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=darkmusic.fossil-scm). Same extension as [1.0.1](#101---2026-05-25); use this version for Marketplace installs.

### Fixed

- **Marketplace publish** passes `--allow-proposed-apis timeline` in `publish:marketplace` so `vsce publish` accepts the extension’s Timeline integration (`enabledApiProposals: ["timeline"]`). The immutable `v1.0.1` tag’s release workflow failed with: *Extensions using unallowed proposed API (enabledApiProposals: [timeline]) can't be published to the Marketplace.*

## [1.0.1](https://github.com/darkmusic/fossil-vscode/compare/v1.0.0...v1.0.1) - 2026-05-25

GitHub Release with VSIX only; Marketplace publish did not complete. Same extension as [1.0.0](#100---2026-05-25). Install from [GitHub Releases](https://github.com/darkmusic/fossil-vscode/releases) for this version, or use **1.0.2** or later from the Marketplace.

### Fixed

- `**publish:marketplace` npm script** (`vsce publish`) so the **Create Release** workflow can publish the tagged VSIX to the Marketplace. The immutable `v1.0.0` tag’s release failed because this script was missing.

## [1.0.0](https://github.com/darkmusic/fossil-vscode/compare/v0.0.1...v1.0.0) - 2026-05-25

Pre–Marketplace release (GitHub Release with VSIX only). Marketplace publish was attempted from CI but did not run successfully; use **1.0.2** or later for Marketplace installs.

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

## [0.0.1](https://github.com/darkmusic/fossil-vscode/releases/tag/v0.0.1) - 2026-05-22

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

