import { UUID } from '../src/UUID';

describe('uuid', () => {
  describe('readUuid', () => {
    const buffer = Buffer.from([
      0xde, 0xee, 0x31,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x4f, 0xff,
      0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    it('should build proper string (ignoring if it is valid UUID)', () => {
      expect(new UUID(buffer.subarray(3)).toString()).toBe('ffffffff-ffff-4fff-8000-000000000000');
    });

    it('should build proper string from selected offset (ignoring if it is valid UUID)', () => {
      expect(new UUID(buffer, 3).toString()).toBe('ffffffff-ffff-4fff-8000-000000000000');
    });

    it('should serialize to JSON', () => {
      expect(JSON.stringify(new UUID(buffer, 3))).toBe('"ffffffff-ffff-4fff-8000-000000000000"');
    });

    it('should fail when buffer is too short', () => {
      expect(() => new UUID(buffer.subarray(3, 18)).toString()).toThrowError();
    });

    it('should fail when buffer is too short for selected offset', () => {
      expect(() => new UUID(buffer.subarray(3), 3)).toThrowError();
    });

    it('should correctly write to buffer', () => {
      const result = Buffer.alloc(16);
      new UUID(buffer, 3).write(result);
      expect(result).toEqual(buffer.subarray(3));
    });

    it('should correctly write to buffer at selected offset', () => {
      const result = Buffer.alloc(20);
      new UUID(buffer, 3).write(result, 2);
      expect(result).toEqual(Buffer.concat([ Buffer.alloc(2), buffer.subarray(3), Buffer.alloc(2) ]));
    });
  });
});
