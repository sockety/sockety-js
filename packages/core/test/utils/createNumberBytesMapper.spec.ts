import { createNumberBytesMapper } from '../../src/utils/createNumberBytesMapper';
import { createNumberBytesGetter } from '../../src/utils/createNumberBytesGetter';

describe('utils', () => {
  describe('createNumberBytesMapper', () => {
    it('should correctly get proper number of bytes when there are all in range', () => {
      const get = createNumberBytesMapper('test', {
        0: 'value1',
        1: 'value2',
        2: 'value3',
      });
      expect(get(0x00)).toBe('value1');
      expect(get(0xf)).toBe('value2');
      expect(get(0xff)).toBe('value2');
      expect(get(0xfff)).toBe('value3');
      expect(get(0xffff)).toBe('value3');
    });

    it('should assign gap for number of bytes to higher number of bytes', () => {
      const get = createNumberBytesMapper('test', {
        2: 'value3',
        4: 'value5',
      });
      expect(get(0x00)).toBe('value3');
      expect(get(0xf)).toBe('value3');
      expect(get(0xff)).toBe('value3');
      expect(get(0xfff)).toBe('value3');
      expect(get(0xffff)).toBe('value3');
      expect(get(0xffff0)).toBe('value5');
      expect(get(0xfffff)).toBe('value5');
      expect(get(0xffffff)).toBe('value5');
      expect(get(0xf000000)).toBe('value5');
      expect(get(0xfffffff)).toBe('value5');
      expect(get(0xffffffff)).toBe('value5');
    });

    it('should throw error when the number needs more bytes than available', () => {
      const get = createNumberBytesMapper('test', {
        2: 'value3',
        4: 'value5',
        6: 'value7',
      });
      expect(() => get(0xffffffffffff)).not.toThrow();
      expect(() => get(0xffffffffffff + 1)).toThrow('The \'test\' value is too big');
    });
  });
});
