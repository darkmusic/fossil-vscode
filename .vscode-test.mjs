// .vscode-test.mjs
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    files: 'out/test/**/*.test.js',
    // CI: let @vscode/test-electron download stable VS Code (no CLI on runner).
    // Local: use system `code` unless CODE_EXECUTABLE_PATH overrides.
    ...(process.env.CI
        ? {}
        : {
              useInstallation: {
                  fromPath: process.env.CODE_EXECUTABLE_PATH ?? 'code',
              },
          }),
});
