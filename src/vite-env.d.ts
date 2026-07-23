/// <reference types="vite/client" />

declare module '*.css'

interface ImportMetaEnv {
  /** URL API бота (Cloudflare Worker); без него берётся прод-URL. */
  readonly VITE_BOT_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
