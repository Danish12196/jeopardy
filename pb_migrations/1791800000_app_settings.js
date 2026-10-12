/// <reference path="../pb_data/types.d.ts" />

// Baseline app settings, applied once on a fresh database.
migrate(
  (app) => {
    const settings = app.settings();

    settings.meta.appName = "Buzzwire";

    // Nginx Proxy Manager sets X-Real-IP to the client address. Trusting it
    // gives PocketBase (logs, rate limits) the real client IP rather than the
    // proxy's. Only safe while the container is reachable through the proxy.
    settings.trustedProxy.headers = ["X-Real-IP"];

    // Nightly backup of pb_data at 03:00 UTC (PocketBase cron runs in UTC),
    // keeping a week's worth. Backups land in pb_data/backups.
    settings.backups.cron = "0 3 * * *";
    settings.backups.cronMaxKeep = 7;

    app.save(settings);
  },
  (app) => {
    const settings = app.settings();

    settings.meta.appName = "Acme";
    settings.trustedProxy.headers = [];
    settings.backups.cron = "";
    settings.backups.cronMaxKeep = 3;

    app.save(settings);
  },
);
