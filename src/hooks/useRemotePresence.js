import { useEffect, useState } from 'react';
import { fetchPresence } from '../utils/api.js';

const POLL_MS = 5000;

export function useRemotePresence() {
  const [presence, setPresence] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchPresence();
        if (!cancelled) setPresence(data);
      } catch {
        // ignore transient errors
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return presence;
}

export function isPlayerOnlineRemote(presence, player) {
  return Boolean(presence?.[player]?.online);
}
