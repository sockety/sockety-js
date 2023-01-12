import { EventEmitter } from 'node:events';
import { DrainListener } from '../../src/utils/DrainListener';

class WritableMock extends EventEmitter {
  #needsDrain = false;

  public mockNeedsDrain(needsDrain: boolean): void {
    this.#needsDrain = needsDrain;
  }

  public notifyDrain() {
    this.emit('drain');
  }

  public get writableNeedDrain(): boolean {
    return this.#needsDrain;
  }
}

function createMock(): { listener: DrainListener, mock: WritableMock } {
  const mock = new WritableMock();
  const listener = new DrainListener(mock as any);
  return { mock, listener };
}

describe('utils', () => {
  describe('DrainListener', () => {
    it('should not run the callback immediately', () => {
      const { mock, listener } = createMock();
      const fn = jest.fn();
      listener.listen(fn);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should run a callback after the writable is drained', () => {
      const { mock, listener } = createMock();
      const fn = jest.fn();
      listener.listen(fn);
      mock.notifyDrain();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should run all callbacks if the writable is always drained', () => {
      const { mock, listener } = createMock();
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      listener.listen(fn1);
      listener.listen(fn2);
      mock.notifyDrain();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should run callbacks until the writable needs drain', () => {
      const { mock, listener } = createMock();
      const fn1 = jest.fn().mockImplementation(() => mock.mockNeedsDrain(true));
      const fn2 = jest.fn();
      listener.listen(fn1);
      listener.listen(fn2);
      mock.notifyDrain();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(0);
    });

    it('should not rerun previously ran callbacks', () => {
      const { mock, listener } = createMock();
      const fn1 = jest.fn().mockImplementation(() => mock.mockNeedsDrain(true));
      const fn2 = jest.fn();
      listener.listen(fn1);
      listener.listen(fn2);
      mock.notifyDrain();
      mock.notifyDrain();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should apply the "drain" event listener', () => {
      const { mock } = createMock();
      expect(mock.listenerCount('drain')).toBe(1);
    });

    it('should correctly destroy the listener', () => {
      const { mock, listener } = createMock();
      listener.destroy();
      expect(mock.listenerCount('drain')).toBe(0);
    });
  });
});
