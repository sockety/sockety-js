import { generateUuid } from '../src/generateUuid';
import { UUID } from '../src/UUID';
import { hasUniqueStringGeneration } from './helpers/hasUniqueStringGeneration';

describe('uuid', () => {
  describe('generateUuid', () => {
    it('should return UUID instance', () => {
      expect(generateUuid()).toBeInstanceOf(UUID);
    });

    it('should return unique UUID instance', () => {
      expect(generateUuid()).not.toBe(generateUuid());
      expect(generateUuid().toString()).not.toBe(generateUuid().toString());
    });

    it('should generate unique UUID', () => {
      expect(hasUniqueStringGeneration(() => generateUuid().toString(), 1e5)).toBe(true);
    });
  });
});
