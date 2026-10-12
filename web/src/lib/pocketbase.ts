import PocketBase from "pocketbase";

// VITE_PB_URL points at PocketBase when the frontend is hosted separately
// (production: Hostinger → https://pb-db.danishali.dev on the NAS). Without it the API is assumed
// to be on the same origin: the Vite dev proxy locally, or PocketBase itself
// when it serves the built app.
export const pb = new PocketBase(import.meta.env.VITE_PB_URL || "/");
