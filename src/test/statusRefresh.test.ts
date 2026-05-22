import * as assert from 'assert';
import { createStatusRefreshScheduler } from '../statusRefresh';

suite('statusRefresh', () => {
    test('debounces rapid schedule calls', async function () {
        this.timeout(5000);
        let callCount = 0;
        const scheduler = createStatusRefreshScheduler(async () => {
            callCount++;
        }, 100);

        scheduler.schedule();
        scheduler.schedule();
        scheduler.schedule();

        await new Promise((r) => setTimeout(r, 250));
        assert.equal(callCount, 1, 'expected a single debounced refresh');

        scheduler.dispose();
    });

    test('refreshNow runs immediately and clears pending debounce', async function () {
        let callCount = 0;
        const scheduler = createStatusRefreshScheduler(async () => {
            callCount++;
        }, 500);

        scheduler.schedule();
        await scheduler.refreshNow();
        assert.equal(callCount, 1);

        await new Promise((r) => setTimeout(r, 600));
        assert.equal(
            callCount,
            1,
            'debounced refresh should not run after refreshNow'
        );

        scheduler.dispose();
    });

    test('refreshNow awaits coalesced follow-up refresh', async function () {
        this.timeout(5000);
        let callCount = 0;
        let resolveFirst: () => void;
        const firstDone = new Promise<void>((r) => {
            resolveFirst = r;
        });

        const scheduler = createStatusRefreshScheduler(async () => {
            callCount++;
            if (callCount === 1) {
                await firstDone;
            }
        });

        const first = scheduler.refreshNow();
        const second = scheduler.refreshNow();
        assert.equal(callCount, 1);

        resolveFirst!();
        await first;
        assert.equal(
            callCount,
            2,
            'refreshNow should not resolve until follow-up refresh completes'
        );
        await second;
        scheduler.dispose();
    });

    test('coalesces overlapping refreshNow calls', async function () {
        let callCount = 0;
        let resolveFirst: () => void;
        const firstDone = new Promise<void>((r) => {
            resolveFirst = r;
        });

        const scheduler = createStatusRefreshScheduler(async () => {
            callCount++;
            if (callCount === 1) {
                await firstDone;
            }
        });

        const p1 = scheduler.refreshNow();
        const p2 = scheduler.refreshNow();
        resolveFirst!();
        await Promise.all([p1, p2]);

        assert.equal(
            callCount,
            2,
            'second refreshNow while in flight should run once more'
        );

        scheduler.dispose();
    });

    test('refreshNow rejects without console logging', async function () {
        const errors: unknown[] = [];
        const originalError = console.error;
        console.error = (...args: unknown[]) => {
            errors.push(args);
        };
        try {
            const scheduler = createStatusRefreshScheduler(async () => {
                throw new Error('status failed');
            });
            await assert.rejects(
                () => scheduler.refreshNow(),
                (err: Error) => err.message === 'status failed'
            );
            assert.equal(
                errors.length,
                0,
                'refreshNow failures should not be console.error logged'
            );
            scheduler.dispose();
        } finally {
            console.error = originalError;
        }
    });

    test('scheduled refresh logs rejection without unhandled rejection', async function () {
        this.timeout(5000);
        const errors: unknown[] = [];
        const originalError = console.error;
        console.error = (...args: unknown[]) => {
            errors.push(args);
        };
        try {
            const scheduler = createStatusRefreshScheduler(async () => {
                throw new Error('status failed');
            }, 50);
            scheduler.schedule();
            await new Promise((r) => setTimeout(r, 150));
            assert.ok(
                errors.some((entry) => {
                    const args = entry as unknown[];
                    return String(args[0]).includes(
                        'Fossil status refresh failed'
                    );
                }),
                'expected refresh failure to be logged'
            );
            scheduler.dispose();
        } finally {
            console.error = originalError;
        }
    });

    test('dispose prevents pending coalesced refresh', async function () {
        this.timeout(5000);
        let callCount = 0;
        let resolveFirst: () => void;
        const firstDone = new Promise<void>((r) => {
            resolveFirst = r;
        });

        const scheduler = createStatusRefreshScheduler(async () => {
            callCount++;
            if (callCount === 1) {
                await firstDone;
            }
        });

        const inFlight = scheduler.refreshNow();
        void scheduler.refreshNow();
        scheduler.dispose();
        resolveFirst!();
        await inFlight;
        await new Promise((r) => setTimeout(r, 100));

        assert.equal(
            callCount,
            1,
            'coalesced refresh should not run after dispose'
        );
    });

    test('dispose prevents scheduled refresh', async function () {
        this.timeout(5000);
        let callCount = 0;
        const scheduler = createStatusRefreshScheduler(async () => {
            callCount++;
        }, 100);

        scheduler.schedule();
        scheduler.dispose();
        await new Promise((r) => setTimeout(r, 250));

        assert.equal(callCount, 0, 'debounced refresh should not run after dispose');
    });
});
