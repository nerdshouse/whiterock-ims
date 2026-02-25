import { useEffect } from 'react';

const POLL_INTERVAL_MS = 5000;

export function usePoll(callback, deps = [], enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    callback();
    const id = setInterval(callback, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, deps);
}
