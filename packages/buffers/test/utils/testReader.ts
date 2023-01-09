import { Buffer } from 'node:buffer';
import { BufferReader } from '../../src/BufferReader';

/* eslint-disable no-underscore-dangle */

export interface TestReaderOptions<T> {
  input: Buffer;
  output: Partial<T>;
  outputContinuous?: Partial<{ [K in keyof T]: T[K][] }>;
  outputCustom?: (result: Record<(keyof T) | '_end', jest.Mock>, repetitions: number) => void;

  build: ($: BufferReader) => BufferReader<T>;
}

function isEqual(obj1: any, obj2: any): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

function expectOnlyToHaveBeenCalledWith(mock: jest.Mock, value: any[][]): void {
  const calls = mock.mock.calls.slice();
  for (const args of value) {
    expect(mock).toHaveBeenCalledWith(...args);
    expect(calls).toContainEqual(args);
    calls.splice(calls.findIndex((x) => isEqual(x, args)), 1);
  }
  expect(calls.length).toBe(0);
}

function copyBuffer(buffer: Buffer, repeat = 1): Buffer {
  return Buffer.concat(new Array(repeat).fill(buffer));
}

function createReadHelper<T extends Record<string, any>>(fn: (x: BufferReader) => BufferReader<T>) {
  type SpiesMap = Record<(keyof T) | '_end', jest.Mock>;
  const chain = fn(new BufferReader());
  const variables: (keyof T)[] = Object.keys(chain.getVariables());
  const createCallbacks = (): SpiesMap => {
    const result: any = { _end: jest.fn() };
    for (const name of variables) {
      result[name] = jest.fn();
    }
    return result;
  };
  const callbacks = createCallbacks();
  const { readOne, readMany } = chain.end()(callbacks);
  return {
    direct: chain.end()({}),
    one: (...args: Parameters<typeof readOne>) => ({ ...callbacks, _index: readOne(...args) }),
    many: (...args: Parameters<typeof readMany>) => {
      readMany(...args);
      return { ...callbacks };
    },
    resetSpies: () => {
      for (const key of Object.keys(callbacks)) {
        callbacks[key].mockClear();
      }
    },
  };
}

// TODO: Test generated code as well
export function testReader(name: string, options: TestReaderOptions<any>, itImpl = it): void {
  function validateOutput(
    result: ReturnType<ReturnType<typeof createReadHelper>['one']> | ReturnType<ReturnType<typeof createReadHelper>['many']>,
    repetitions: number,
  ) {
    options.outputCustom?.(result, repetitions);
    expect(result._end).toHaveBeenCalledTimes(repetitions);
    for (const [ k, v ] of Object.entries(options.output)) {
      expect(result[k]).toHaveBeenCalledTimes(repetitions);
      expect(result[k]).toHaveBeenCalledWith(v);
    }
    for (const [ k, v ] of Object.entries(options.outputContinuous || {})) {
      expect(result[k]).toHaveBeenCalledTimes(v!.length * repetitions);
      expectOnlyToHaveBeenCalledWith(result[k], new Array(repetitions).fill(v!.map((x) => [ x ])).flat());
    }
  }

  // read.one

  itImpl(`${name}: read.one: all at once`, () => {
    const read = createReadHelper(options.build);
    const result = read.one(copyBuffer(options.input));
    expect(result._index).toBe(options.input.length);
    validateOutput(result, 1);
  });

  itImpl(`${name}: read.one: all twice, one after another`, () => {
    const read = createReadHelper(options.build);
    for (let i = 0; i < 2; i++) {
      const result = read.one(copyBuffer(options.input));
      expect(result._index).toBe(options.input.length);
      validateOutput(result, 1);
      read.resetSpies();
    }
  });

  if (options.input.length > 1) {
    itImpl(`${name}: read.one: 2 chunks`, () => {
      const read = createReadHelper(options.build);
      const buffer = copyBuffer(options.input);
      const chunkSize = Math.floor(buffer.length / 2);

      let result = read.one(buffer.subarray(0, chunkSize));
      expect(result._index).toBe(chunkSize);
      result = read.one(buffer.subarray(chunkSize));
      expect(result._index).toBe(buffer.length - chunkSize);

      validateOutput(result, 1);
    });

    itImpl(`${name}: read.one: byte after byte`, () => {
      const read = createReadHelper(options.build);
      const buffer = copyBuffer(options.input);
      let result = read.one(Buffer.allocUnsafe(0));
      for (let index = 0; index < buffer.length; index++) {
        result = read.one(buffer.subarray(index, index + 1));
        expect(result._index).toBe(1);
      }
      validateOutput(result, 1);
    });
  }

  // read.many

  itImpl(`${name}: read.many: all at once`, () => {
    const read = createReadHelper(options.build);
    const result = read.many(copyBuffer(options.input));
    validateOutput(result, 1);
  });

  itImpl(`${name}: read.many: all twice at once`, () => {
    const read = createReadHelper(options.build);
    const result = read.many(copyBuffer(options.input, 2));
    validateOutput(result, 2);
  });

  itImpl(`${name}: read.one: all twice, one after another`, () => {
    const read = createReadHelper(options.build);
    for (let i = 0; i < 2; i++) {
      const result = read.many(copyBuffer(options.input));
      validateOutput(result, 1);
      read.resetSpies();
    }
  });

  if (options.input.length > 1) {
    itImpl(`${name}: read.many: 2 chunks each 2 copies`, () => {
      const read = createReadHelper(options.build);
      const buffer = copyBuffer(options.input, 2);
      const chunkSize = Math.floor(buffer.length / 4);

      read.many(buffer.subarray(0, chunkSize));
      read.many(buffer.subarray(chunkSize, 2 * chunkSize));
      read.many(buffer.subarray(2 * chunkSize, 3 * chunkSize));
      const result = read.many(buffer.subarray(3 * chunkSize));

      validateOutput(result, 2);
    });

    itImpl(`${name}: read.many: byte after byte of 2 copies`, () => {
      const read = createReadHelper(options.build);
      const buffer = copyBuffer(options.input, 2);
      let result = read.many(Buffer.allocUnsafe(0));
      for (let index = 0; index < buffer.length; index++) {
        result = read.many(buffer.subarray(index, index + 1));
      }
      validateOutput(result, 2);
    });
  }
}

export function ftestReader(name: string, options: TestReaderOptions<any>): void {
  return testReader(name, options, fit);
}
