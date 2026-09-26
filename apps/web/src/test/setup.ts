import '@testing-library/jest-dom/vitest';

// jsdom não implementa ResizeObserver; componentes radix-ui (Checkbox, Select) usam para medir o tamanho.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverPolyfill as unknown as typeof ResizeObserver;
