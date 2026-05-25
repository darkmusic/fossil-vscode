'use strict';

/** Fossil status types for files not yet in the checkout (unmanaged). */
export function isUnmanagedStatus(type: string): boolean {
    return type === 'UNMANAGE' || type === 'EXTRA';
}
