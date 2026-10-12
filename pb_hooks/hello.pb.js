/// <reference path="../pb_data/types.d.ts" />

// Milestone 1 smoke test: proves the JS hooks are loaded and that the
// frontend can reach a custom route. Replaced by real game routes later.
routerAdd("GET", "/api/buzzwire/hello", (e) => {
  return e.json(200, {
    message: "Hello from Buzzwire",
    serverTime: new Date().toISOString(),
  });
});
