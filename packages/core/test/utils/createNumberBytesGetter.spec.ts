import { createNumberBytesGetter } from '../../src/utils/createNumberBytesGetter';

describe('utils', () => {
  describe('createNumberBytesGetter', () => {
    it('should correctly get proper number of bytes when there are all in range', () => {
      const get = createNumberBytesGetter('test', [ 0, 1, 2, 3, 4, 5, 6 ]);
      expect(get(0x00)).toBe(0);
      expect(get(0xf)).toBe(1);
      expect(get(0xff)).toBe(1);
      expect(get(0xfff)).toBe(2);
      expect(get(0xffff)).toBe(2);
      expect(get(0xffff0)).toBe(3);
      expect(get(0xfffff)).toBe(3);
      expect(get(0xffffff)).toBe(3);
      expect(get(0xf000000)).toBe(4);
      expect(get(0xfffffff)).toBe(4);
      expect(get(0xffffffff)).toBe(4);
    });

    it('should assign gap for number of bytes to higher number of bytes', () => {
      const get = createNumberBytesGetter('test', [ 0, 1, 2, 4, 5, 6 ]);
      expect(get(0x00)).toBe(0);
      expect(get(0xf)).toBe(1);
      expect(get(0xff)).toBe(1);
      expect(get(0xfff)).toBe(2);
      expect(get(0xffff)).toBe(2);
      expect(get(0xffff0)).toBe(4);
      expect(get(0xfffff)).toBe(4);
      expect(get(0xffffff)).toBe(4);
      expect(get(0xf000000)).toBe(4);
      expect(get(0xfffffff)).toBe(4);
      expect(get(0xffffffff)).toBe(4);
    });

    it('should throw error when the number needs more bytes than available', () => {
      const get = createNumberBytesGetter('test', [ 1, 2, 4, 5, 6 ]);
      expect(() => get(0xffffffffffff)).not.toThrow();
      expect(() => get(0xffffffffffff + 1)).toThrow('The \'test\' value is too big');
    });
  });
});
