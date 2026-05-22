'use strict';

export interface StatusRefreshScheduler {
    schedule(): void;
    refreshNow(): Promise<void>;
    dispose(): void;
}

interface RefreshWaiter {
    resolve: () => void;
    reject: (err: unknown) => void;
}

/**
 * Debounced status refresh for FS watcher events, with in-flight coalescing.
 */
export function createStatusRefreshScheduler(
    refresh: () => Promise<void>,
    debounceMs = 300
): StatusRefreshScheduler {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: Promise<void> | undefined;
    let pendingRefresh = false;
    let disposed = false;
    let waiters: RefreshWaiter[] = [];

    function logRefreshError(err: unknown): void {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Fossil status refresh failed:', message);
    }

    function resolveWaiters(): void {
        const batch = waiters;
        waiters = [];
        for (const waiter of batch) {
            waiter.resolve();
        }
    }

    function rejectWaiters(err: unknown): void {
        const batch = waiters;
        waiters = [];
        for (const waiter of batch) {
            waiter.reject(err);
        }
    }

    function requestFollowUp(): void {
        if (!disposed) {
            pendingRefresh = true;
        }
    }

    async function kickRefresh(): Promise<void> {
        if (disposed || inFlight) {
            return;
        }

        try {
            do {
                pendingRefresh = false;
                inFlight = refresh();
                await inFlight;
            } while (pendingRefresh && !disposed);
            resolveWaiters();
        } catch (err) {
            rejectWaiters(err);
            throw err;
        } finally {
            inFlight = undefined;
        }
    }

    /** Fire-and-forget refresh; logs rejections from watcher-driven paths. */
    function fireRefresh(): void {
        if (disposed) {
            return;
        }
        if (inFlight) {
            requestFollowUp();
            return;
        }
        void kickRefresh().catch(logRefreshError);
    }

    function joinRefresh(): Promise<void> {
        if (disposed) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            waiters.push({ resolve, reject });
            if (inFlight) {
                requestFollowUp();
            } else {
                // Errors propagate to waiters via rejectWaiters; avoid duplicate logging.
                void kickRefresh().catch(() => {});
            }
        });
    }

    return {
        schedule(): void {
            if (disposed) {
                return;
            }
            if (timer !== undefined) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                timer = undefined;
                fireRefresh();
            }, debounceMs);
        },
        refreshNow(): Promise<void> {
            if (disposed) {
                return Promise.resolve();
            }
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
            return joinRefresh();
        },
        dispose(): void {
            disposed = true;
            pendingRefresh = false;
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
            resolveWaiters();
        },
    };
}
