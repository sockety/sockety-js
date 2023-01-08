/**
 * This noop function is used everywhere,
 * so when it's passed down, it may be checked by `===` to ignore the operation.
 *
 * It's using global property, so no matter how many @sockety/core sources will be used,
 * it will still have same identity.
 */

function getGlobal() {
  if (typeof global !== 'undefined') {
    return global;
  }
  // @ts-ignore:
  if (typeof window !== 'undefined') {
    // @ts-ignore:
    return window;
  }
  return {}; // It will not have optimizations, but it shouldn't happen
}

const NoopSymbol = Symbol('global noop function instance');

const glob = getGlobal();
glob[NoopSymbol] = glob[NoopSymbol] || (() => {});
export const noop = glob[NoopSymbol];
