/// <reference path="../pb_data/types.d.ts" />

// PocketBase serves the React app from pb_public and falls back to index.html
// for unknown paths (SPA routing). Keep that fallback away from /api, so a
// mistyped API URL is a JSON 404 rather than a 200 HTML page. Real API routes
// are more specific and still win.
routerAdd("GET", "/api/{path...}", () => {
  throw new NotFoundError("Unknown API route.");
});
