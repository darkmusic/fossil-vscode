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
});
