/**
 * Check if passed buffer contains valid UUID v4 at provided offset.
 */
export function isValidUuidBuffer(buffer: Buffer, offset = 0): boolean {
  const versionByte = buffer[offset + 6];
  const controlByte = buffer[offset + 8];
  return (
    typeof buffer[offset + 15] !== 'undefined' &&
    versionByte > 0x3f && versionByte < 0x50 &&
    controlByte > 0x7f && controlByte < 0xc0
  );
}
