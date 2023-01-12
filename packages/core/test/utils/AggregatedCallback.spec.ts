import { setTimeout as timeout } from 'node:timers/promises';
import { AggregatedCallback } from '../../src/utils/AggregatedCallback';

const nextTick = () => new Promise((resolve) => {
  process.nextTick(resolve);
});

describe('utils', () => {
  describe('AggregatedCallback', () => {
    it('should not call any of callbacks when it is not finished', async () => {
      const x = new AggregatedCallback();
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      x.add(fn1);
      x.add(fn2);
      await timeout(100);
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
    });

    it('should call all callbacks when it is finished (success)', async () => {
      const x = new AggregatedCallback();
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      x.add(fn1);
      x.add(fn2);
      x.callback(null);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn1).toHaveBeenCalledWith(null);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledWith(null);
    });

    it('should call all callbacks when it is finished (failure)', async () => {
      const x = new AggregatedCallback();
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      x.add(fn1);
      x.add(fn2);
      x.callback(new Error('test-error'));
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn1).toHaveBeenCalledWith(new Error('test-error'));
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledWith(new Error('test-error'));
    });

    it('should immediately call added callback when it\'s already finished (success)', async () => {
      const x = new AggregatedCallback();
      const fn1 = jest.fn();
      x.callback(null);
      x.add(fn1);
      await nextTick();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn1).toHaveBeenCalledWith(null);
    });

    it('should immediately call added callback when it\'s already finished (failure)', async () => {
      const x = new AggregatedCallback();
      const fn1 = jest.fn();
      x.callback(new Error('test-error'));
      x.add(fn1);
      await nextTick();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn1).toHaveBeenCalledWith(new Error('test-error'));
    });

    it('should ignore add(undefined)', () => {
      expect(() => new AggregatedCallback().add(undefined)).not.toThrow();
    });

    it('should create immediately finished AggregatedCallback with .done static (success)', async () => {
      const x = AggregatedCallback.done(null);
      const fn1 = jest.fn();
      x.add(fn1);
      await nextTick();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn1).toHaveBeenCalledWith(null);
    });

    it('should create immediately finished AggregatedCallback with .done static (failure)', async () => {
      const x = AggregatedCallback.done(new Error('test-error'));
      const fn1 = jest.fn();
      x.add(fn1);
      await nextTick();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn1).toHaveBeenCalledWith(new Error('test-error'));
    });
  });
});
