import { UUID } from './UUID';

/**
 * Create new UUID instance based on buffer contents.
 */
export function readUuid(buffer: Uint8Array | number[], offset = 0): UUID {
  return new UUID(buffer, offset);
}
