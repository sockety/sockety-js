import { Buffer } from 'node:buffer';
import { generateUuid } from '@sockety/uuid';
import { BufferReader } from '../src/BufferReader';
import { testReader } from './utils/testReader';

function sanitizeHex(hex: string): string {
  return hex.replace(/\s+/g, '');
}

function buildBuffer(hex: string): Buffer {
  return Buffer.from(sanitizeHex(hex), 'hex');
}

function buildBufferLE(hex: string): Buffer {
  hex = sanitizeHex(hex);
  let reversedHex = '';
  for (let i = hex.length - 2; i >= 0; i -= 2) {
    reversedHex += hex.substring(i, i + 2);
  }
  return Buffer.from(reversedHex, 'hex');
}

describe('buffers', () => {
  describe('BufferReader', () => {
    describe('Numbers', () => {
      testReader('should correctly read biguint64le', {
        build: ($) => $.biguint64le('value'),
        input: buildBufferLE('ff ed cb a9 87 65 43 21'),
        output: { value: 0xff_ed_cb_a9_87_65_43_21n },
      });

      testReader('should correctly read biguint56le', {
        build: ($) => $.biguint56le('value'),
        input: buildBufferLE('ff ed cb a9 87 65 43'),
        output: { value: 0xff_ed_cb_a9_87_65_43n },
      });

      testReader('should correctly read uint48le', {
        build: ($) => $.uint48le('value'),
        input: buildBufferLE('ff ed cb a9 87 65'),
        output: { value: 0xff_ed_cb_a9_87_65 },
      });

      testReader('should correctly read uint40le', {
        build: ($) => $.uint40le('value'),
        input: buildBufferLE('ff ed cb a9 87'),
        output: { value: 0xff_ed_cb_a9_87 },
      });

      testReader('should correctly read uint32le', {
        build: ($) => $.uint32le('value'),
        input: buildBufferLE('ff ed cb a9'),
        output: { value: 0xff_ed_cb_a9 },
      });

      testReader('should correctly read uint24le', {
        build: ($) => $.uint24le('value'),
        input: buildBufferLE('ff ed cb'),
        output: { value: 0xff_ed_cb },
      });

      testReader('should correctly read uint16le', {
        build: ($) => $.uint16le('value'),
        input: buildBufferLE('ff ed'),
        output: { value: 0xff_ed },
      });

      testReader('should correctly read uint8', {
        build: ($) => $.uint8('value'),
        input: buildBufferLE('ff'),
        output: { value: 0xff },
      });
    });

    describe('Arrays', () => {
      testReader('should correctly read static array[uint8]', {
        build: ($) => $.array('value', 3, ($$) => $$.uint8('x')),
        input: buildBuffer('ff ed cb'),
        output: { value: [ { x: 0xff }, { x: 0xed }, { x: 0xcb } ] },
      });

      testReader('should correctly read static array[uint8,uint16]', {
        build: ($) => $.array('value', 3, ($$) => $$.uint8('x').uint16le('y')),
        input: buildBuffer('ff ed cb a9 87 65 43 21 00'),
        output: {
          value: [
            { x: 0xff, y: 0xcb_ed },
            { x: 0xa9, y: 0x65_87 },
            { x: 0x43, y: 0x00_21 },
          ],
        },
      });

      testReader('should correctly read static array[uint8]: continuous', {
        build: ($) => $.array('value', 3, ($$) => $$.uint8('x'), true),
        input: buildBuffer('ff ed cb'),
        output: {},
        outputContinuous: { value: [ { x: 0xff }, { x: 0xed }, { x: 0xcb } ] },
      });

      testReader('should correctly read static array[uint8,uint16]: continuous', {
        build: ($) => $.array('value', 3, ($$) => $$.uint8('x').uint16le('y'), true),
        input: buildBuffer('ff ed cb a9 87 65 43 21 00'),
        output: {},
        outputContinuous: {
          value: [
            { x: 0xff, y: 0xcb_ed },
            { x: 0xa9, y: 0x65_87 },
            { x: 0x43, y: 0x00_21 },
          ],
        },
      });
    });

    describe('Dynamic arrays', () => {
      testReader('should correctly read dynamic array[uint8]', {
        build: ($) => $.uint8('asize').arrayDynamic('value', 'asize', ($$) => $$.uint8('x'), false),
        input: buildBuffer('03 ff ed cb'),
        output: {
          asize: 3,
          value: [ { x: 0xff }, { x: 0xed }, { x: 0xcb } ],
        },
      });

      testReader('should correctly read dynamic array[uint8,uint16]', {
        build: ($) => $.uint8('asize').arrayDynamic('value', 'asize', ($$) => $$.uint8('x').uint16le('y'), false),
        input: buildBuffer('03 ff ed cb a9 87 65 43 21 00'),
        output: {
          asize: 3,
          value: [
            { x: 0xff, y: 0xcb_ed },
            { x: 0xa9, y: 0x65_87 },
            { x: 0x43, y: 0x00_21 },
          ],
        },
      });

      testReader('should correctly read dynamic array[uint8]: continuous', {
        build: ($) => $.uint8('asize').arrayDynamic('value', 'asize', ($$) => $$.uint8('x'), true),
        input: buildBuffer('03 ff ed cb'),
        output: { asize: 3 },
        outputContinuous: { value: [ { x: 0xff }, { x: 0xed }, { x: 0xcb } ] },
      });

      testReader('should correctly read dynamic array[uint8,uint16]: continuous', {
        build: ($) => $.uint8('asize').arrayDynamic('value', 'asize', ($$) => $$.uint8('x').uint16le('y'), true),
        input: buildBuffer('03 ff ed cb a9 87 65 43 21 00'),
        output: { asize: 3 },
        outputContinuous: {
          value: [
            { x: 0xff, y: 0xcb_ed },
            { x: 0xa9, y: 0x65_87 },
            { x: 0x43, y: 0x00_21 },
          ],
        },
      });
    });

    describe('UUIDs', () => {
      const uuid = generateUuid();

      testReader('should correctly read UUIDs', {
        build: ($) => $.uuid('value'),
        input: uuid.toBuffer(),
        output: { value: uuid },
      });

      testReader('should correctly read UUIDs as strings', {
        build: ($) => $.uuidString('value'),
        input: uuid.toBuffer(),
        output: { value: uuid.toString() },
      });
    });

    describe('Raw buffers', () => {
      const buf = Buffer.from([ 0xff, 0x22, 0x11, 0x04, 0x32, 0x43, 0xee ]);

      testReader('should correctly read static raw buffers', {
        build: ($) => $.raw('value', buf.length),
        input: buf,
        output: { value: buf },
      });

      testReader('should correctly read static raw buffers: continuous', {
        build: ($) => $.raw('value', buf.length, true),
        input: buf,
        output: {},
        outputCustom(result, repetitions) {
          const input = Buffer.concat(new Array(repetitions).fill(buf));
          const output = Buffer.concat(result.value.mock.calls.map((x) => x[0]));
          expect(input).toEqual(output);
        },
      });
    });

    describe('Dynamic raw buffers', () => {
      const buf = Buffer.from([ 0xff, 0x22, 0x11, 0x04, 0x32, 0x43, 0xee ]);

      testReader('should correctly read dynamic raw buffers', {
        build: ($) => $.uint8('asize').rawDynamic('value', 'asize'),
        input: Buffer.concat([ Buffer.from([ buf.length ]), buf ]),
        output: { asize: buf.length, value: buf },
      });

      testReader('should correctly read dynamic raw buffers: continuous', {
        build: ($) => $.uint8('asize').rawDynamic('value', 'asize', true),
        input: Buffer.concat([ Buffer.from([ buf.length ]), buf ]),
        output: { asize: 7 },
        outputCustom(result, repetitions) {
          const input = Buffer.concat(new Array(repetitions).fill(buf));
          const output = Buffer.concat(result.value.mock.calls.map((x) => x[0]));
          expect(input).toEqual(output);
        },
      });
    });

    describe('UTF-8', () => {
      testReader('should correctly read static UTF-8', {
        build: ($) => $.utf8('value', 18),
        input: Buffer.from('buffer ♥ parsing'),
        output: { value: 'buffer ♥ parsing' },
      });

      testReader('should correctly read dynamic UTF8', {
        build: ($) => $.uint8('asize').utf8Dynamic('value', 'asize'),
        input: Buffer.concat([ Buffer.from([ 18 ]), Buffer.from('buffer ♥ parsing') ]),
        output: { asize: 18, value: 'buffer ♥ parsing' },
      });
    });

    // Constants are tested along with other types, to ensure no infinite loops.
    // Otherwise, read.many will be able to always catch the constant.
    describe('Constants', () => {
      testReader('should correctly read constant', {
        build: ($) => $.uint8('xyz').constant('value', 'def'),
        input: Buffer.from([ 0x00 ]),
        output: {
          value: 'def',
        },
      });

      const constantObj = {
        x: 10,
        a: 'string',
        nested: { abc: true },
      };
      testReader('should copy the object constant', {
        build: ($) => $.uint8('xyz').constant('value', constantObj),
        input: Buffer.from([ 0x00 ]),
        output: {},
        outputCustom(result, repetitions) {
          expect(result.value).toHaveBeenCalledTimes(repetitions);
          for (const [ arg ] of result.value.mock.calls) {
            expect(arg).toEqual(constantObj);
            expect(arg).not.toBe(constantObj);
          }
        },
      });
    });

    describe('Dynamic pass down without allocation', () => {
      const buf = Buffer.from([ 0xff, 0x22, 0x11, 0x04, 0x32, 0x43, 0xee ]);

      testReader('should correctly pass dynamic buffer', {
        build: ($) => $.uint8('asize').passDynamic('value', 'asize'),
        input: Buffer.concat([ Buffer.from([ buf.length ]), buf ]),
        output: { asize: 7 },
        outputCustom(result, repetitions) {
          const input = Buffer.concat(new Array(repetitions).fill(buf));
          const output = Buffer.concat(
            result.value.mock.calls.map(([ buffer, start, end ]) => buffer.subarray(start, end)),
          );
          expect(input).toEqual(output);
        },
      });
    });

    describe('Conditionals', () => {
      testReader('should correctly select variant', {
        build: ($) => $.uint8('xyz')
          .when('xyz', 10, ($$) => $$.uint8('value1'))
          .when('xyz', 20, ($$) => $$.uint8('value2'))
          .when('xyz', 30, ($$) => $$.uint8('value3')),
        input: Buffer.from([ 20, 43 ]),
        output: {},
        outputCustom(result, repetitions) {
          expect(result.value1).not.toHaveBeenCalled();
          expect(result.value2).toHaveBeenCalledTimes(repetitions);
          expect(result.value3).not.toHaveBeenCalled();
        },
      });
    });

    describe('Early end', () => {
      testReader('should early end ignoring the rest', {
        build: ($) => $.uint8('value').earlyEnd().uint8('other'),
        input: Buffer.from([ 123 ]),
        output: { value: 123 },
        outputCustom(result) {
          expect(result.other).not.toHaveBeenCalled();
        },
      });

      testReader('should early end inside of conditional', {
        build: ($) => $
          .uint8('value')
          .when('value', 123, ($$) => $$.earlyEnd().uint8('other'))
          .uint8('next'),
        input: Buffer.from([ 123 ]),
        output: { value: 123 },
        outputCustom(result) {
          expect(result.other).not.toHaveBeenCalled();
          expect(result.next).not.toHaveBeenCalled();
        },
      });
    });

    describe('Flags', () => {
      testReader('should handle bitwise flags (truthy)', {
        build: ($) => $.uint8('xxx').flag('value', 'xxx', 0b0010000),
        input: Buffer.from([ 0b0011000 ]),
        output: { value: true },
      });

      testReader('should handle bitwise flags (falsy)', {
        build: ($) => $.uint8('xxx').flag('value', 'xxx', 0b0100000),
        input: Buffer.from([ 0b0011000 ]),
        output: { value: false },
      });
    });

    describe('Mask', () => {
      testReader('should handle mask (full match)', {
        build: ($) => $.uint8('xxx').mask('value', 'xxx', 0b001111),
        input: Buffer.from([ 0b011111 ]),
        output: { value: 0b001111 },
      });

      testReader('should handle mask (partial match)', {
        build: ($) => $.uint8('xxx').mask('value', 'xxx', 0b001111),
        input: Buffer.from([ 0b010011 ]),
        output: { value: 0b000011 },
      });

      testReader('should handle mask (no match)', {
        build: ($) => $.uint8('xxx').mask('value', 'xxx', 0b001111),
        input: Buffer.from([ 0b110000 ]),
        output: { value: 0b000000 },
      });
    });

    describe('Custom computation', () => {
      testReader('should handle custom computation', {
        build: ($) => $.uint8('xxx').compute('value', ($$) => `return ${$$.read('xxx')} * 10`),
        input: Buffer.from([ 123 ]),
        output: { value: 1230 },
      });
    });
  });
});
