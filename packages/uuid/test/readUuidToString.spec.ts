import { readUuidToString } from '../src/readUuidToString';

describe('uuid', () => {
  describe('readUuidToString', () => {
    const buffer = Buffer.from([
      0xde, 0xee, 0x31,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x4f, 0xff,
      0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    it('should build proper string', () => {
      expect(readUuidToString(buffer.subarray(3))).toBe('ffffffff-ffff-4fff-8000-000000000000');
    });

    it('should build proper string from selected offset', () => {
      expect(readUuidToString(buffer, 3)).toBe('ffffffff-ffff-4fff-8000-000000000000');
    });

    it('should fail when buffer is too short', () => {
      expect(() => readUuidToString(buffer.subarray(3, 18))).toThrowError();
    });

    it('should fail when buffer is too short for selected offset', () => {
      expect(() => readUuidToString(buffer.subarray(3), 1)).toThrowError();
    });
  });
});
