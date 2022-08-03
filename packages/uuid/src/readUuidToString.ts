import { hexBytes } from './internal/hexBytes';

/**
 * Build UUID's string representation directly from buffer.
 */
export function readUuidToString(buffer: Uint8Array | number[], offset = 0): string {
  if (typeof buffer[offset + 15] === 'undefined') {
    throw new Error('Out of bounds: can not read UUID.');
  }
  return hexBytes[buffer[offset]] + hexBytes[buffer[offset + 1]] +
    hexBytes[buffer[offset + 2]] + hexBytes[buffer[offset + 3]] + '-' +
    hexBytes[buffer[offset + 4]] + hexBytes[buffer[offset + 5]] + '-' +
    hexBytes[buffer[offset + 6]] + hexBytes[buffer[offset + 7]] + '-' +
    hexBytes[buffer[offset + 8]] + hexBytes[buffer[offset + 9]] + '-' +
    hexBytes[buffer[offset + 10]] + hexBytes[buffer[offset + 11]] +
    hexBytes[buffer[offset + 12]] + hexBytes[buffer[offset + 13]] +
    hexBytes[buffer[offset + 14]] + hexBytes[buffer[offset + 15]];
}
