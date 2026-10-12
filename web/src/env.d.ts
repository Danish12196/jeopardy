interface ImportMetaEnv {
  /** PocketBase base URL, e.g. https://api.buzzwire.danishali.dev. Defaults to same origin. */
  readonly VITE_PB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
