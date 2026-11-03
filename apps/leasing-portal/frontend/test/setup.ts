// jsdom has no matchMedia; the ui lib's useIsMobile needs one. Desktop.
window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})

// React Router's data routers create a Request per navigation with the
// AbortSignal of jsdom's AbortController. Node's own Request (Node 24)
// rejects any signal that isn't Node's, so tests drop it. Browsers have one
// AbortSignal, so the app itself is not affected.
const NodeRequest = globalThis.Request
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init && { ...init, signal: undefined })
  }
}
