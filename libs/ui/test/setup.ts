// jsdom has no matchMedia; useIsMobile needs one. Desktop by default.
let mobile = false

export const setMobile = (value: boolean) => {
  mobile = value
}

window.matchMedia = (query: string) => ({
  matches: mobile,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})
