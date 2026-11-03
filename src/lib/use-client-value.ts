'use client';

import { useSyncExternalStore } from 'react';

const never = () => () => {};

/**
 * A value only the browser knows (storage, the URL, the viewport). The server render gets `serverValue`, the
 * browser reads the real one as soon as it hydrates, with no mismatch and no "set state in an effect". `read`
 * must return a primitive (or the same reference while nothing changed): React compares snapshots on every render.
 */
export function useClientValue<T>(read: () => T, serverValue: T, subscribe: (onChange: () => void) => () => void = never) {
  return useSyncExternalStore(subscribe, read, () => serverValue);
}
