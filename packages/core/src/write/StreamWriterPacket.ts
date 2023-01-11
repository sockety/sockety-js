import { createNumberBytesGetter } from '../utils/createNumberBytesGetter';
import { createNumberBytesMapper } from '../utils/createNumberBytesMapper';
import { PacketSizeBits } from '../constants';
import { noop } from '../noop';
import { SendCallback } from '../ContentProducer';
import { StreamWriterInstruction } from './StreamWriterInstruction';
import { WritableBuffer } from './WritableBuffer';

type Instruction = ($: WritableBuffer) => void;

const getPacketSizeBytes = createNumberBytesGetter('packet size', [ 1, 2, 3, 4 ]);
const getPacketSizeFlag = createNumberBytesMapper('packet size', {
  1: PacketSizeBits.Uint8,
  2: PacketSizeBits.Uint16,
  3: PacketSizeBits.Uint24,
  4: PacketSizeBits.Uint32,
});

export class StreamWriterPacket implements StreamWriterInstruction {
  readonly #packet: number;
  public bytes = 0;
  #bufferedBytes = 0;
  #instruction: Instruction = noop;
  public next: StreamWriterInstruction | undefined;

  public constructor(packet: number) {
    this.#packet = packet;
  }

  get #flags(): number {
    return getPacketSizeFlag(this.bytes);
  }

  get #sizeBytes(): number {
    return getPacketSizeBytes(this.bytes);
  }

  public get bufferedBytes(): number {
    return this.#bufferedBytes + this.#sizeBytes + 1;
  }

  public add(instruction: Instruction, bytes: number, bufferedBytes: number): void {
    const prev = this.#instruction;
    this.#instruction = ($) => {
      prev($);
      instruction($);
    };
    this.bytes += bytes;
    this.#bufferedBytes += bufferedBytes;
  }

  public pass(next: StreamWriterInstruction): void {
    this.next = next;
  }

  public callback(sent: SendCallback = noop): void {
    if (sent !== noop) {
      const prev = this.#instruction;
      this.#instruction = ($) => {
        prev($);
        $.addCallback(sent);
      };
    }
  }

  public run(buffer: WritableBuffer): void {
    // Packet header
    buffer.writeUint8(this.#packet | this.#flags);
    buffer.writeUint(this.bytes, this.#sizeBytes);

    // Add all instructions
    this.#instruction(buffer);
  }
}
