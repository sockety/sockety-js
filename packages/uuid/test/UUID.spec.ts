import { UUID } from '../src/UUID';
import { Buffer } from 'node:buffer';

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
      expect(() => new UUID(buffer.subarray(3, 18)).toString()).toThrow();
    });

    it('should fail when buffer is too short for selected offset', () => {
      expect(() => new UUID(buffer.subarray(3), 3)).toThrow();
    });

    it('should correctly create new buffer', () => {
      expect(new UUID(buffer, 3).toBuffer()).toEqual(buffer.subarray(3));
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

    it('should detect equality correctly', () => {
      const a = new UUID(buffer);
      const b = new UUID(Buffer.concat([ buffer ]));
      const c = new UUID(Buffer.concat([ buffer.subarray(0, 15), Buffer.from([ 0x33 ]) ]));
      expect(a.equals(a)).toBe(true);
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
      expect(b.equals(a)).toBe(true);
      expect(b.equals(b)).toBe(true);
      expect(b.equals(c)).toBe(false);
      expect(c.equals(a)).toBe(false);
      expect(c.equals(b)).toBe(false);
      expect(c.equals(c)).toBe(true);
    });
  });
});
