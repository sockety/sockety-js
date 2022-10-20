import { Buffer } from 'node:buffer';
import { Writable } from 'node:stream';
import { UUID } from '@sockety/uuid';
import { PacketResponseBits, PacketSizeBits, PacketStreamBits, PacketTypeBits } from './constants';
import { BufferedWritable } from './BufferedWritable';

const noop = () => {};

export const PRODUCER_END = Symbol();

const createCallback = (listeners: ((error: Error | null | undefined) => void)[]) => (error: Error | null | undefined) => {
  listeners.forEach((listener) => listener(error));
};

// TODO: Support drain
// TODO: Make auto ACK? On server/client level?
export class SocketWriter {
  readonly #buffer: BufferedWritable;

  readonly #maxChannels: number;
  readonly #reservedChannels: Record<number, boolean> = { 0: false };
  readonly #streamingChannels: Record<number, boolean> = { 0: false };
  readonly #waitingForIdle: ((channelId: number, release: () => void) => void)[] = [];
  #currentChannelId = 0;

  public constructor(writable: Writable, maxChannels: number = 4095) {
    maxChannels = 100;
    if (maxChannels < 1 || maxChannels > 4095) {
      throw new Error('Number of max concurrent channels must be between 1 and 4095');
    }
    this.#buffer = new BufferedWritable(writable, {
      poolSize: 16_384,
      // poolSize: 0,
      reservedOversizeBytes: 20,
      // noZeroFillUtilizedBuffer: true,
    });
    this.#maxChannels = maxChannels;
  }

  // TODO: Consider DrainListener on this level
  public drained(fn: (immediate: boolean) => void): void {
    this.#buffer.drained(fn);
  }

  public shouldInlineBuffer(bufferLength: number): boolean {
    return this.#buffer.shouldInlineBuffer(bufferLength);
  }

  public shouldInlineUtf8(byteLength: number): boolean {
    return this.#buffer.shouldInlineBuffer(byteLength);
  }

  public notifyLength(length: number): void {
    this.#buffer.arrangeSize(length);
  }

  addListener(listener?: (error: Error | null | undefined) => void) {
    this.#buffer.addCallback(listener);
  }

  public write(buffer: Buffer, callback?: (error: Error | null | undefined) => void): boolean {
    return this.#buffer.write(buffer, callback);
  }

  public ensureChannel(channelId: number): void {
    if (this.#currentChannelId !== channelId) {
      this.#currentChannelId = channelId;
      if (channelId <= 0x0f) {
        this.#buffer.writeUint8(PacketTypeBits.ChannelSwitchLow | channelId);
      } else if (channelId <= 0x0fff) {
        // TODO: Replace with writeUint16?
        this.#buffer.arrangeSize(2);
        this.#buffer.unsafeWriteUint8(PacketTypeBits.ChannelSwitch | (channelId >> 8));
        this.#buffer.unsafeWriteUint8(channelId & 0x00ff);
      } else {
        throw new Error(`Maximum channel ID is 4095.`);
      }
    }
  }

  public writeUint8(uint8: number): void {
    this.#buffer.writeUint8(uint8);
  }

  public writeUint16(uint16: number): void {
    this.#buffer.writeUint16(uint16);
  }

  public writeUint24(uint24: number): void {
    this.#buffer.writeUint24(uint24);
  }

  public writeUint48(uint48: number): void {
    this.#buffer.writeUint48(uint48);
  }

  public writeUtf8(utf8: string, callback?: (error: Error | null | undefined) => void): boolean {
    return this.#buffer.writeUtf8(utf8, callback);
  }

  public writeUuid(uuid: UUID): void {
    return this.#buffer.writeUuid(uuid);
  }

  public writeHeartbeat(callback?: (error: Error | null | undefined) => void): void {
    this.#buffer.writeUint8(PacketTypeBits.Heartbeat, callback);
  }

  public writeGoAway(callback?: (error: Error | null | undefined) => void): void {
    this.#buffer.writeUint8(PacketTypeBits.GoAway, callback);
  }

  public writeAbort(callback?: (error: Error | null | undefined) => void): void {
    this.#buffer.writeUint8(PacketTypeBits.Abort, callback);
  }

  public writeAck(uuid: UUID, callback?: (error: Error | null | undefined) => void): void {
    this.#buffer.arrangeSize(17);
    this.#buffer.unsafeWriteUint8(PacketTypeBits.Ack);
    this.#buffer.unsafeWriteUuid(uuid, callback);
  }

  public writeRevoke(uuid: UUID, callback?: (error: Error | null | undefined) => void): void {
    this.#buffer.arrangeSize(17);
    this.#buffer.unsafeWriteUint8(PacketTypeBits.Revoke);
    this.#buffer.unsafeWriteUuid(uuid, callback);
  }

  #writePacketSignature(type: PacketTypeBits, length: number, bits = 0): void {
    if (length <= 0xff) {
      this.#buffer.arrangeSize(2);
      this.#buffer.unsafeWriteUint8(type | PacketSizeBits.Uint8 | bits);
      this.#buffer.unsafeWriteUint8(length);
    } else if (length <= 0xffff) {
      this.#buffer.arrangeSize(3);
      this.#buffer.unsafeWriteUint8(type | PacketSizeBits.Uint16 | bits);
      this.#buffer.unsafeWriteUint16(length);
    } else if (length <= 0xffffff) {
      this.#buffer.arrangeSize(4);
      this.#buffer.unsafeWriteUint8(type | PacketSizeBits.Uint24 | bits);
      this.#buffer.unsafeWriteUint24(length);
    } else if (length <= 0xffffffff) {
      this.#buffer.arrangeSize(5);
      this.#buffer.unsafeWriteUint8(type | PacketSizeBits.Uint32 | bits);
      this.#buffer.unsafeWriteUint32(length);
    } else {
      throw new Error(`Maximum frame size is ${0xffffffff} bytes.`);
    }
  }

  writeMessageSignature(length: number, hasStream: boolean, expectsResponse: boolean, callback?: (error: Error | null | undefined) => void): void {
    this.#writePacketSignature(PacketTypeBits.Message, length, (
      (hasStream ? PacketStreamBits.Yes : PacketStreamBits.No) |
      (expectsResponse ? PacketResponseBits.Yes : PacketResponseBits.No)
    ));
    this.addListener(callback);
  }

  writeStreamSignature(length: number, callback?: (error: Error | null | undefined) => void): void {
    this.#writePacketSignature(PacketTypeBits.Stream, length);
    this.addListener(callback);
  }

  writeContinueSignature(length: number, callback?: (error: Error | null | undefined) => void): void {
    this.#writePacketSignature(PacketTypeBits.Continue, length);
    this.addListener(callback);
  }

  // public writeContinue(channelId: number, buffer: Buffer, callback: (error: Error | null | undefined) => void): void {
  //   this.#write(channelId, this.#buildContinueSignature(buffer.length), noop);
  //   this.#write(channelId, buffer, callback);
  // }
  //
  // public writeStream(channelId: number, buffer: Buffer, callback: (error: Error | null | undefined) => void): void {
  //   this.#write(channelId, this.#buildStreamSignature(buffer.length), noop);
  //   this.#write(channelId, buffer, callback);
  // }
  //
  public writeStreamEnd(channelId: number, callback?: (error: Error | null | undefined) => void): void {
    this.#streamingChannels[channelId] = false;
    this.ensureChannel(channelId);
    this.#buffer.writeUint8(PacketTypeBits.StreamEnd, callback);
  }

  #releaseChannelId(channelId: number): void {
    if (this.#waitingForIdle.length === 0) {
      this.#reservedChannels[channelId] = false;
      return;
    }
    const nextOne = this.#waitingForIdle.shift()!;
    process.nextTick(() => nextOne(channelId, () => this.#releaseChannelId(channelId)));
  }

  public reserveChannel(callback: (channelId: number, release: () => void) => void): void {
    const currentChannelId = this.#currentChannelId;
    const maxChannels = this.#maxChannels;
    const reservedChannels = this.#reservedChannels;

    // Find idle channel
    for (let i = 0; i < maxChannels; i++) {
      const nextChannelId = (currentChannelId + i) % maxChannels;
      if (!reservedChannels[nextChannelId]) {
        this.#reservedChannels[nextChannelId] = true;
        callback(nextChannelId, () => this.#releaseChannelId(nextChannelId));
        return;
      }
    }

    // Wait for idle channel
    // TODO: Add option (AbortController?) to stop waiting for idle channel?
    this.#waitingForIdle.push(callback);
  }
}
