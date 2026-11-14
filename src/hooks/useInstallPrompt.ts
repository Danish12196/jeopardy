import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void> };

/** Captures the browser's PWA install prompt so we can offer our own button. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return {
    canInstall: event !== null,
    install: async () => {
      if (!event) return;
      await event.prompt();
      setEvent(null);
    },
  };
}
