'use client';

import { useEffect } from 'react';
import type { RoomId } from '@/config/rooms';
import { post } from './api';

/**
 * The owner link is `/<room>#owner=<key>`: the key sits in the fragment so it never reaches server logs.
 * Trades it for an owner cookie, then reloads as the owner.
 */
export function useClaimOwner(room: RoomId) {
  useEffect(() => {
    const key = new URLSearchParams(window.location.hash.slice(1)).get('owner');
    if (!key) return;
    history.replaceState(null, '', window.location.pathname);
    post('/api/rooms/claim', { room, key }).then((res) => res.ok && window.location.reload());
  }, [room]);
}
