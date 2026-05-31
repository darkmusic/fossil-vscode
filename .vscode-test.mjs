// .vscode-test.mjs
import { defineConfig } from '@vscode/test-cli';
import { execSync } from 'child_process';

function findVscodeCli() {
    const envPath = process.env.CODE_EXECUTABLE_PATH;
    if (envPath) return envPath;
    for (const exe of ['code', 'codium']) {
        try {
            execSync(`which "${exe}" 2>/dev/null`, { stdio: 'pipe' });
            return exe;
        } catch {
            // try next
        }
    }
    return 'code';
}

export default defineConfig({
    files: 'out/test/**/*.test.js',
    // CI: let @vscode/test-electron download stable VS Code (no CLI on runner).
    // Local: use system `code`, or `codium` if `code` not found.
    ...(process.env.CI
        ? {}
        : {
              useInstallation: {
                  fromPath: findVscodeCli(),
              },
          }),
});
