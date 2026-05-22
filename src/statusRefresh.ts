'use strict';

export interface StatusRefreshScheduler {
    schedule(): void;
    refreshNow(): Promise<void>;
    dispose(): void;
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

    function logRefreshError(err: unknown): void {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Fossil status refresh failed:', message);
    }

    /** Fire-and-forget refresh; logs rejections from watcher-driven paths. */
    function fireRefresh(): void {
        if (disposed) {
            return;
        }
        void runRefresh().catch(logRefreshError);
    }

    async function runRefresh(): Promise<void> {
        if (disposed) {
            return;
        }
        if (inFlight) {
            if (!disposed) {
                pendingRefresh = true;
            }
            return inFlight;
        }
        inFlight = refresh().finally(() => {
            inFlight = undefined;
            if (disposed) {
                pendingRefresh = false;
                return;
            }
            if (pendingRefresh) {
                pendingRefresh = false;
                fireRefresh();
            }
        });
        return inFlight;
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
            return runRefresh();
        },
        dispose(): void {
            disposed = true;
            pendingRefresh = false;
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
        },
    };
}
