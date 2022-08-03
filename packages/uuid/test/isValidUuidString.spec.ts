import { isValidUuidString } from '../src/isValidUuidString';

describe('uuid', () => {
  describe('isValidUuidString', () => {
    it('should disallow types different than string', () => {
      // @ts-ignore: checking invalid types
      expect(isValidUuidString([ 10, 30 ])).toBe(false);
      // @ts-ignore: checking invalid types
      expect(isValidUuidString({})).toBe(false);
      // @ts-ignore: checking invalid types
      expect(isValidUuidString({ a: 'b' })).toBe(false);
      // @ts-ignore: checking invalid types
      expect(isValidUuidString(33)).toBe(false);
      // @ts-ignore: checking invalid types
      expect(isValidUuidString(null)).toBe(false);
      // @ts-ignore: checking invalid types
      expect(isValidUuidString(undefined)).toBe(false);
      // @ts-ignore: checking invalid types
      expect(isValidUuidString(true)).toBe(false);
      // @ts-ignore: checking invalid types
      expect(isValidUuidString(false)).toBe(false);
    });

    it('should fail completely invalid strings', () => {
      expect(isValidUuidString('aaaa')).toBe(false);
      expect(isValidUuidString('aaaa-bbbb')).toBe(false);
      expect(isValidUuidString('aaaa-bbbb-cccc')).toBe(false);
      expect(isValidUuidString('aaaa-bbbb-cccc-dddd')).toBe(false);
      expect(isValidUuidString('nothing there')).toBe(false);
    });

    it('should check for UUID v4 recognition bits', () => {
      expect(isValidUuidString('aada7be3-4d11-4224-a720-8e703b8d12d8')).toBe(true);
      expect(isValidUuidString('aada7be3-4d11-4224-c720-8e703b8d12d8')).toBe(false);
      expect(isValidUuidString('aada7be3-4d11-4224-7720-8e703b8d12d8')).toBe(false);
      expect(isValidUuidString('aada7be3-4d11-3224-7720-8e703b8d12d8')).toBe(false);
      expect(isValidUuidString('aada7be3-4d11-3224-a720-8e703b8d12d8')).toBe(false);
    });

    it('should disallow invalid HEX characters', () => {
      expect(isValidUuidString('gada7be3-4d11-4224-a720-8e703b8d12d8')).toBe(false);
    });

    it('should have valid UUID v4 format', () => {
      expect(isValidUuidString('aada7be3-4d11-4224-a720-8e703b8d12d8')).toBe(true);
    });

    it('should work with upper-case letters', () => {
      expect(isValidUuidString('AADA7BE3-4D11-4224-A720-8E703B8D12D8')).toBe(true);
      expect(isValidUuidString('AADA7BE3-4D11-4224-C720-8E703B8D12D8')).toBe(false);
      expect(isValidUuidString('AADA7BE3-4D11-4224-7720-8E703B8D12D8')).toBe(false);
      expect(isValidUuidString('AADA7BE3-4D11-3224-7720-8E703B8D12D8')).toBe(false);
      expect(isValidUuidString('AADA7BE3-4D11-3224-A720-8E703B8D12D8')).toBe(false);
    });

    it('should work with mixed lower-case and upper-case letters', () => {
      expect(isValidUuidString('AADA7BE3-4D11-4224-a720-8E703B8D12D8')).toBe(true);
      expect(isValidUuidString('AADA7BE3-4D11-4224-c720-8E703B8D12D8')).toBe(false);
      expect(isValidUuidString('AADA7BE3-4D11-4224-7720-8E703B8D12D8')).toBe(false);
      expect(isValidUuidString('AADA7BE3-4D11-3224-7720-8E703B8D12D8')).toBe(false);
      expect(isValidUuidString('AADA7BE3-4D11-3224-a720-8E703B8D12D8')).toBe(false);
    });
  });
});
