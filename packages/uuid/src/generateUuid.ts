import { Buffer } from 'node:buffer';
import { randomFillSync } from 'node:crypto';
import { UUID } from './UUID';

// Configure
const BATCH_SIZE = 256;

// Prepare buffer for caching random bytes
const batchBuffer = Buffer.allocUnsafe(BATCH_SIZE * 16);
let batchOffset = BATCH_SIZE;

export function generateUuid() {
  // Rebuild buffer when it's already used
  if (batchOffset === BATCH_SIZE) {
    randomFillSync(batchBuffer, 0, BATCH_SIZE * 16);
    batchOffset = 0;
  }

  // Build new UUID instance and register next index
  return new UUID(batchBuffer, batchOffset++ * 16);
}
