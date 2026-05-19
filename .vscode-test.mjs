// .vscode-test.mjs
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    files: 'out/test/**/*.test.js',
    useInstallation: {
        fromPath: process.env.CODE_EXECUTABLE_PATH ?? 'code',
    },
});
