import PocketBase from "pocketbase";

// PocketBase serves this app in production (and Vite proxies /api in dev),
// so the API is always on the same origin as the page.
export const pb = new PocketBase("/");
