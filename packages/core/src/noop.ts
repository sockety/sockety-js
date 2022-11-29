/**
 * This noop function is used everywhere,
 * so when it's passed down, it may be checked by `===` to ignore the operation.
 *
 * It's using global property, so no matter how many @sockety/core sources will be used,
 * it will still have same identity.
 */
// @ts-ignore:
const glob = typeof global === 'undefined' ? typeof window === 'undefined' ? {} : window : global;
const NoopSymbol = Symbol();

export const noop = glob[NoopSymbol] = glob[NoopSymbol] || (() => {});
