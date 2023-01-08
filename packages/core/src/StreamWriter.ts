import { Buffer } from 'node:buffer';
import { Writable } from 'node:stream';
import { UUID } from '@sockety/uuid';
import { WritableBuffer } from './WritableBuffer';
import { FileIndexBits, PacketResponseBits, PacketStreamBits, PacketTypeBits } from './constants';
import { createNumberBytesGetter } from './createNumberBytesGetter';
import { createNumberBytesMapper } from './createNumberBytesMapper';
import { StreamWriterInstruction } from './StreamWriterInstruction';
import { StreamWriterPacket } from './StreamWriterPacket';
import { StreamWriterStandalonePacket } from './StreamWriterStandalonePacket';
import { noop } from './noop';

type SendCallback = (error: Error | null | undefined) => void;

const getFileIndexBytes = createNumberBytesGetter('file index', [ 1, 2, 3, 6 ]);
const getFileIndexFlag = createNumberBytesMapper('file index', {
  1: FileIndexBits.Uint8,
  2: FileIndexBits.Uint16,
  3: FileIndexBits.Uint24,
});

export interface StreamWriterOptions {
  maxChannels?: number; // default: 4_096
  immediateFlushBytes?: number; // default: 65_000
  maxInlineUtf8Bytes?: number; // default: 60_000
  maxInlineBufferBytes?: number; // default: 30_000
}

const fileEndInstruction = (flags: number, index: number, indexByteLength: number) => ($: WritableBuffer) => {
  $.writeUint8(PacketTypeBits.FileEnd | flags);
  if (indexByteLength !== 0) {
    $.writeUint(index, indexByteLength);
  }
};
const streamEndInstruction = ($: WritableBuffer) => $.writeUint8(PacketTypeBits.StreamEnd);
const heartbeatInstruction = ($: WritableBuffer) => $.writeUint8(PacketTypeBits.Heartbeat);
const goAwayInstruction = ($: WritableBuffer) => $.writeUint8(PacketTypeBits.GoAway);
const abortInstruction = ($: WritableBuffer) => $.writeUint8(PacketTypeBits.GoAway);
const uint8Instruction = (value: number) => ($: WritableBuffer) => $.writeUint8(value);
const uint16Instruction = (value: number) => ($: WritableBuffer) => $.writeUint16(value);
const uint24Instruction = (value: number) => ($: WritableBuffer) => $.writeUint24(value);
const uint32Instruction = (value: number) => ($: WritableBuffer) => $.writeUint32(value);
const uint48Instruction = (value: number) => ($: WritableBuffer) => $.writeUint48(value);
const uintInstruction = (value: number, byteLength: number) => {
  if (byteLength === 1) {
    return uint8Instruction(value);
  } else if (byteLength === 2) {
    return uint16Instruction(value);
  } else if (byteLength === 3) {
    return uint24Instruction(value);
  } else if (byteLength === 4) {
    return uint32Instruction(value);
  } else if (byteLength === 6) {
    return uint48Instruction(value);
  } else {
    throw new Error('Only 1-4 and 6 bytes are supported.');
  }
};
const uuidInstruction = (id: UUID) => ($: WritableBuffer) => $.writeUuid(id);
const utf8InlineInstruction = (text: string) => ($: WritableBuffer) => $.writeUtf8Inline(text);
const utf8WriteInstruction = (text: string) => ($: WritableBuffer) => $.writeUtf8(text);
const switchChannelLowInstruction = (channel: number) => ($: WritableBuffer) => (
  $.writeUint8(PacketTypeBits.ChannelSwitchLow | channel)
);
const switchChannelHighInstruction = (channel: number) => ($: WritableBuffer) => {
  $.writeUint8(PacketTypeBits.ChannelSwitch | (channel >> 8));
  $.writeUint8(channel & 0x00ff);
};
const fastReplyLowInstruction = (id: UUID, type: number) => ($: WritableBuffer) => {
  $.writeUint8(PacketTypeBits.FastReplyLow | type);
  $.writeUuid(id);
};
const fastReplyHighInstruction = (id: UUID, type: number) => ($: WritableBuffer) => {
  $.writeUint8(PacketTypeBits.FastReply | (type >> 8));
  $.writeUint8(type & 0x00ff);
  $.writeUuid(id);
};
const bufferInlineInstruction = (buffer: Buffer) => ($: WritableBuffer) => $.writeBufferInline(buffer);
const bufferWriteInstruction = (buffer: Buffer) => ($: WritableBuffer) => $.writeBuffer(buffer);

// TODO: "Abort" could delete whole packet
export class StreamWriter {
  readonly #buffer: WritableBuffer;
  readonly #maxChannels: number;
  readonly #immediateFlushBytes: number;
  readonly #maxInlineUtf8Bytes: number;
  readonly #maxInlineBufferBytes: number;

  readonly #streamingChannels: Record<number, boolean> = {};
  readonly #reservedChannels: Record<number, boolean> = {};
  readonly #waitingForIdle: ((channel: number, release: () => void) => void)[] = [];

  #scheduled = false;
  #queuedBytes = 0;

  #firstPacket: StreamWriterInstruction | StreamWriterStandalonePacket | undefined;
  #lastPacket: StreamWriterInstruction | StreamWriterStandalonePacket | undefined;
  #currentPacket: StreamWriterPacket | undefined = undefined;
  #currentPacketType: PacketTypeBits = 0;
  #currentPacketFileIndex = 0;

  #currentChannel = 0;

  public constructor(writable: Writable, options: StreamWriterOptions = {}) {
    // Save information about maximum number of channels
    this.#maxChannels = options?.maxChannels ?? 4096;
    if (this.#maxChannels < 1 || this.#maxChannels > 4096) {
      throw new Error('Number of max concurrent channels must be between 1 and 4096');
    }

    // Save other options
    this.#immediateFlushBytes = options?.immediateFlushBytes ?? 65_000;
    this.#maxInlineUtf8Bytes = options?.maxInlineUtf8Bytes ?? 60_000;
    this.#maxInlineBufferBytes = options?.maxInlineBufferBytes ?? 30_000;

    // Prepare bucket for information about streaming/reserved channels
    this.#streamingChannels = {};
    this.#reservedChannels = {};

    // Build buffered writable (?)
    this.#buffer = new WritableBuffer(writable);
  }

  #schedule(): void {
    if (this.#scheduled) {
      return;
    }
    this.#scheduled = true;
    process.nextTick(this.#commit);
  }

  readonly #commit = () => {
    this.#scheduled = false;
    this.#endPacket();

    this.#buffer.arrangeSize(this.#queuedBytes);

    while (this.#firstPacket) {
      if (this.#buffer.needsDrain) {
        this.#buffer.drained(this.#commit);
        this.#buffer.send();
        return;
      }
      this.#firstPacket.run(this.#buffer);
      this.#queuedBytes -= this.#firstPacket.bufferedBytes;
      this.#firstPacket = this.#firstPacket.next;
    }
    this.#lastPacket = undefined;
    this.#buffer.send();
  };

  #instruction(
    instruction: (buffer: WritableBuffer) => void,
    packetBytes: number,
    bufferedBytes: number,
    sent?: SendCallback,
  ): void {
    this.#currentPacket!.add(instruction, packetBytes, bufferedBytes);
    this.#currentPacket!.callback(sent);
  }

  #appendPacket(packet: StreamWriterPacket | StreamWriterStandalonePacket): void {
    if (this.#lastPacket) {
      this.#lastPacket.pass(packet);
      this.#lastPacket = packet;
    } else {
      this.#firstPacket = packet;
      this.#lastPacket = packet;
    }
    this.#queuedBytes += packet.bufferedBytes;
  }

  #standaloneInstruction(instruction: (buffer: WritableBuffer) => void, bytes: number, sent?: SendCallback): void {
    this.#endPacket();
    const packet = new StreamWriterStandalonePacket(instruction, bytes, sent);
    this.#appendPacket(packet);
    this.#afterAdd();
  }

  public addCallback(sent: SendCallback = noop): void {
    if (sent === noop) {
      return;
    }
    if (this.#currentPacket?.bytes) {
      this.#currentPacket.callback(sent);
    } else if (this.#lastPacket) {
      this.#lastPacket.callback(sent);
    } else {
      this.#buffer.addCallback(sent);
    }
  }

  // It assumes that the previous packet is flushed
  #startPacket(packet: number): void {
    this.#currentPacket = new StreamWriterPacket(packet);
    this.#currentPacketType = packet & 0xf0;
    this.#schedule(); // Auto-flush
  }

  #afterAdd(): void {
    if (this.#queuedBytes > this.#immediateFlushBytes) {
      this.#commit();
    } else {
      this.#schedule();
    }
  }

  #endPacket(): void {
    const packet = this.#currentPacket;
    if (packet === undefined) {
      return;
    }

    this.#currentPacket = undefined;
    this.#currentPacketType = 0;

    // Ignore empty packets
    if (packet.bytes !== 0) {
      this.#appendPacket(packet);
      this.#afterAdd();
    }
  }

  // Packets

  public heartbeat(sent?: SendCallback): void {
    this.#standaloneInstruction(heartbeatInstruction, 1, sent);
  }

  public goAway(sent?: SendCallback): void {
    this.#standaloneInstruction(goAwayInstruction, 1, sent);
  }

  public abort(sent?: SendCallback): void {
    this.#standaloneInstruction(abortInstruction, 1, sent);
  }

  public channel(channel: number): void {
    if (this.#currentChannel === channel) {
      return;
    }
    this.#currentChannel = channel;
    if (channel < 0) {
      throw new Error('Minimum channel ID is 0.');
    } else if (channel <= 0x0f) {
      this.#standaloneInstruction(switchChannelLowInstruction(channel), 1);
    } else if (channel <= 0x0fff) {
      this.#standaloneInstruction(switchChannelHighInstruction(channel), 2);
    } else {
      throw new Error('Maximum channel ID is 4095.');
    }
  }

  public fastReply(id: UUID, code: number, sent?: SendCallback): void {
    if (code < 0) {
      throw new Error('Invalid short response code.');
    } else if (code <= 0x0f) {
      this.#standaloneInstruction(fastReplyLowInstruction(id, code), 17, sent);
    } else if (code <= 0x0fff) {
      this.#standaloneInstruction(fastReplyHighInstruction(id, code), 18, sent);
    } else {
      throw new Error('Invalid short response code.');
    }
  }

  public startMessage(expectsResponse: boolean, hasStream: boolean): void {
    const type = PacketTypeBits.Message | (
      (hasStream ? PacketStreamBits.Yes : PacketStreamBits.No) |
      (expectsResponse ? PacketResponseBits.Yes : PacketResponseBits.No)
    );
    this.#endPacket();
    this.#startPacket(type);
  }

  public continueMessage(): void {
    if (
      this.#currentPacketType === PacketTypeBits.Message ||
      this.#currentPacketType === PacketTypeBits.Continue ||
      this.#currentPacketType === PacketTypeBits.Response
    ) {
      return;
    }
    this.#endPacket();
    this.#startPacket(PacketTypeBits.Continue);
  }

  public startResponse(expectsResponse: boolean, hasStream: boolean): void {
    const type = PacketTypeBits.Response | (
      (hasStream ? PacketStreamBits.Yes : PacketStreamBits.No) |
      (expectsResponse ? PacketResponseBits.Yes : PacketResponseBits.No)
    );
    this.#endPacket();
    this.#startPacket(type);
  }

  public stream(): void {
    if (this.#currentPacketType === PacketTypeBits.Stream) {
      return;
    }
    this.#endPacket();
    this.#startPacket(PacketTypeBits.Stream);
  }

  public endStream(sent?: SendCallback): void {
    this.#streamingChannels[this.#currentChannel] = false;
    this.#standaloneInstruction(streamEndInstruction, 1, sent);
  }

  public data(): void {
    if (this.#currentPacketType === PacketTypeBits.Data) {
      return;
    }
    this.#endPacket();
    this.#startPacket(PacketTypeBits.Data);
  }

  public file(index: number): void {
    if (this.#currentPacketType === PacketTypeBits.File && this.#currentPacketFileIndex === index) {
      return;
    }
    this.#endPacket();
    this.#currentPacketFileIndex = index;

    const flags = index === 0 ? FileIndexBits.First : getFileIndexFlag(index);
    const bytes = index === 0 ? 0 : getFileIndexBytes(index);
    this.#startPacket(PacketTypeBits.File | flags);
    if (index !== 0) {
      this.#instruction(uintInstruction(index, bytes), 0, bytes);
    }
  }

  public endFile(index: number, sent?: SendCallback): void {
    const flags = index === 0 ? FileIndexBits.First : getFileIndexFlag(index);
    const bytes = index === 0 ? 0 : getFileIndexBytes(index);
    this.#standaloneInstruction(fileEndInstruction(flags, index, bytes), bytes + 1, sent);
  }

  // Instructions

  public writeUuid(uuid: UUID, sent?: SendCallback): void {
    this.#instruction(uuidInstruction(uuid), 16, 16, sent);
  }

  public writeUtf8(text: string, sent?: SendCallback): void {
    const size = Buffer.byteLength(text);
    if (size > this.#maxInlineUtf8Bytes) {
      this.#instruction(utf8WriteInstruction(text), size, 0, sent);
    } else {
      this.#instruction(utf8InlineInstruction(text), size, size, sent);
    }
  }

  public writeBuffer(buffer: Buffer, sent?: SendCallback): void {
    const size = buffer.length;
    if (size > this.#maxInlineBufferBytes) {
      this.#instruction(bufferWriteInstruction(buffer), size, 0, sent);
    } else {
      this.#instruction(bufferInlineInstruction(buffer), size, size, sent);
    }
  }

  public writeUint8(uint: number, sent?: SendCallback): void {
    this.#instruction(uint8Instruction(uint), 1, 1, sent);
  }

  public writeUint16(uint: number, sent?: SendCallback): void {
    this.#instruction(uint16Instruction(uint), 2, 2, sent);
  }

  public writeUint24(uint: number, sent?: SendCallback): void {
    this.#instruction(uint24Instruction(uint), 3, 3, sent);
  }

  public writeUint32(uint: number, sent?: SendCallback): void {
    this.#instruction(uint32Instruction(uint), 4, 4, sent);
  }

  public writeUint48(uint: number, sent?: SendCallback): void {
    this.#instruction(uint48Instruction(uint), 6, 6, sent);
  }

  public writeUint(uint: number, byteLength: number, sent?: SendCallback): void {
    this.#instruction(uintInstruction(uint, byteLength), byteLength, byteLength, sent);
  }

  // Reserving channels

  #releaseChannelId(channel: number): void {
    if (this.#waitingForIdle.length === 0) {
      this.#reservedChannels[channel] = false;
      return;
    }
    const nextOne = this.#waitingForIdle.shift()!;
    process.nextTick(() => nextOne(channel, () => this.#releaseChannelId(channel)));
  }

  public reserveChannel(callback: (channel: number, release: () => void) => void): void {
    const currentChannel = this.#currentChannel;
    const maxChannels = this.#maxChannels;
    const reservedChannels = this.#reservedChannels;

    // Find idle channel
    for (let i = 0; i < maxChannels; i++) {
      const nextChannelId = (currentChannel + i) % maxChannels;
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

  public destroy(): void {
    this.#buffer.destroy();
    this.#currentPacket = undefined;
  }
}
