import '@testing-library/jest-dom/vitest'
// Polyfill ResizeObserver for jsdom
class MockResizeObserver {
  callback: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) { this.callback = cb }
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom env
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver


