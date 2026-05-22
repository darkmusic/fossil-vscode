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

    async function runRefresh(): Promise<void> {
        if (inFlight) {
            pendingRefresh = true;
            return inFlight;
        }
        inFlight = refresh().finally(() => {
            inFlight = undefined;
            if (pendingRefresh) {
                pendingRefresh = false;
                void runRefresh();
            }
        });
        return inFlight;
    }

    return {
        schedule(): void {
            if (timer !== undefined) {
                clearTimeout(timer);
            }
            timer = setTimeout(() => {
                timer = undefined;
                void runRefresh();
            }, debounceMs);
        },
        refreshNow(): Promise<void> {
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
            return runRefresh();
        },
        dispose(): void {
            if (timer !== undefined) {
                clearTimeout(timer);
                timer = undefined;
            }
        },
    };
}
