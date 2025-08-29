/// <reference types="vite/client" />

declare global {
  interface Window {
    __ENV?: Record<string, string>
  }
}

export {}
