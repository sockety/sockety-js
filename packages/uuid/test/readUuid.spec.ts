import { readUuid } from '../src/readUuid';
import { UUID } from '../src/UUID';

describe('uuid', () => {
  describe('readUuid', () => {
    const buffer = Buffer.from([
      0xde, 0xee, 0x31,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x4f, 0xff,
      0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    it('should return UUID instance', () => {
      expect(readUuid(buffer.subarray(3))).toBeInstanceOf(UUID);
    });

    it('should build proper string (ignoring if it is valid UUID)', () => {
      expect(readUuid(buffer.subarray(3)).toString()).toBe('ffffffff-ffff-4fff-8000-000000000000');
    });

    it('should build proper string from selected offset (ignoring if it is valid UUID)', () => {
      expect(readUuid(buffer, 3).toString()).toBe('ffffffff-ffff-4fff-8000-000000000000');
    });

    it('should fail when buffer is too short', () => {
      expect(() => readUuid(buffer.subarray(3, 18)).toString()).toThrowError();
    });

    it('should fail when buffer is too short for selected offset', () => {
      expect(() => readUuid(buffer.subarray(3), 3)).toThrowError();
    });
  });
});
