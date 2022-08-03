import { isValidUuidBuffer } from '../src/isValidUuidBuffer';

describe('uuid', () => {
  describe('isValidUuidBuffer', () => {
    const buffer = Buffer.from([
      0xde, 0xee, 0x31,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x4f, 0xff,
      0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    it('should detect invalid when the buffer is too small', () => {
      expect(isValidUuidBuffer(buffer.subarray(3, 18))).toBe(false);
    });

    it('should detect invalid when the buffer is too small on selected offset', () => {
      expect(isValidUuidBuffer(buffer.subarray(0, 18), 3)).toBe(false);
    });

    it('should detect invalid when the version byte is too low', () => {
      const test = Buffer.from(buffer.subarray(3));
      test[6] = 0x3f;
      expect(isValidUuidBuffer(test)).toBe(false);
    });

    it('should detect invalid when the version byte is too high', () => {
      const test = Buffer.from(buffer.subarray(3));
      test[6] = 0x50;
      expect(isValidUuidBuffer(test)).toBe(false);
    });

    it('should detect invalid when the control byte is too low', () => {
      const test = Buffer.from(buffer.subarray(3));
      test[8] = 0x7f;
      expect(isValidUuidBuffer(test)).toBe(false);
    });

    it('should detect invalid when the control byte is too high', () => {
      const test = Buffer.from(buffer.subarray(3));
      test[8] = 0xc0;
      expect(isValidUuidBuffer(test)).toBe(false);
    });

    it('should allow correct UUIDs', () => {
      expect(isValidUuidBuffer(buffer.subarray(3))).toBe(true);
      expect(isValidUuidBuffer(buffer, 3)).toBe(true);
    });
  });
});
