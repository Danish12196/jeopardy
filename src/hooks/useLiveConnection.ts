import { useEffect, useSyncExternalStore } from "react";
import pb from "@/pb";

// One shared watcher for the realtime connection. PocketBase reconnects on its
// own (with backoff) and re-sends subscriptions, but events sent while we
// were away are lost. So every page refetches its state when:
//   - the realtime connection comes back after a drop,
//   - the browser comes back online, or
//   - the tab becomes visible again (phones sleeping, TV input switched).

type State = { connected: boolean; reloadKey: number };
let state: State = { connected: true, reloadKey: 0 };
const listeners = new Set<() => void>();
const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

let started = false;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Watch for the realtime stream coming back after a drop. (Subscribing to
  // PB_CONNECT would be neater, but it goes into the same subscription
  // request as the game topics and made those flaky in tests.)
  let watch: ReturnType<typeof setInterval> | null = null;
  const waitForReconnect = () => {
    if (watch) return;
    watch = setInterval(() => {
      if (pb.realtime.isConnected && navigator.onLine) {
        clearInterval(watch!);
        watch = null;
        emit({ connected: true, reloadKey: state.reloadKey + 1 });
      }
    }, 500);
  };

  const prev = pb.realtime.onDisconnect;
  pb.realtime.onDisconnect = (subs) => {
    // Only a drop with live subscriptions is a problem worth showing.
    if (subs.length) {
      emit({ connected: false });
      waitForReconnect();
    }
    prev?.(subs);
  };

  window.addEventListener("offline", () => { emit({ connected: false }); waitForReconnect(); });
  window.addEventListener("online", () => emit({ reloadKey: state.reloadKey + 1 }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") emit({ reloadKey: state.reloadKey + 1 });
  });
}

/** `connected` drives the "Reconnecting" badge; bump-only `reloadKey` tells pages to refetch. */
export function useLiveConnection(): State {
  useEffect(start, []);
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => state,
    () => state
  );
}
