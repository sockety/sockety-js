import { Buffer } from 'node:buffer';
import { Writable } from 'node:stream';
import { UUID } from '@sockety/uuid';
import { BufferedWritable } from './BufferedWritable';
import { FileIndexBits, PacketResponseBits, PacketSizeBits, PacketStreamBits, PacketTypeBits } from './constants';
import { createNumberBytesGetter } from './createNumberBytesGetter';
import { createNumberBytesMapper } from './createNumberBytesMapper';

const noop = () => {};

type SendCallback = (error: Error | null | undefined) => void;
type WriteCallback = () => void;

const getFileIndexBytes = createNumberBytesGetter('file index', [ 1, 2, 3, 6 ]);
const getFileIndexFlag = createNumberBytesMapper('file index', {
  // TODO: Consider 0 -> None, as there is empty slot anyway?
  1: FileIndexBits.Uint8,
  2: FileIndexBits.Uint16,
  3: FileIndexBits.Uint24,
});

const getPacketSizeBytes = createNumberBytesGetter('packet size', [ 1, 2, 3, 4 ]);
const getPacketSizeFlag = createNumberBytesMapper('packet size', {
  1: PacketSizeBits.Uint8,
  2: PacketSizeBits.Uint16,
  3: PacketSizeBits.Uint24,
  4: PacketSizeBits.Uint32,
});

class StreamWriterInstruction {
  public next: StreamWriterInstruction | undefined;
  public run: (buffer: BufferedWritable) => void;
  public sent: SendCallback | undefined;
  public written: WriteCallback | undefined;

  public constructor(run: (buffer: BufferedWritable) => void, sent: SendCallback | undefined, written: WriteCallback | undefined) {
    this.run = run;
    this.sent = sent;
    this.written = written;
  }
}

export interface StreamWriterOptions {
  maxChannels?: number; // default: 4_095
  poolSize?: number; // default: 16_384
  poolReservedOversizeBytes?: number; // default: 20
}

const fileEndInstruction = (flags: number, index: number, indexByteLength: number) => ($: BufferedWritable) => {
  $.unsafeWriteUint8(PacketTypeBits.FileEnd | flags);
  $.unsafeWriteUint(index, indexByteLength);
};
const streamEndInstruction = ($: BufferedWritable) => $.unsafeWriteUint8(PacketTypeBits.StreamEnd);
const heartbeatInstruction = ($: BufferedWritable) => $.unsafeWriteUint8(PacketTypeBits.Heartbeat);
const goAwayInstruction = ($: BufferedWritable) => $.unsafeWriteUint8(PacketTypeBits.GoAway);
const abortInstruction = ($: BufferedWritable) => $.unsafeWriteUint8(PacketTypeBits.GoAway);
const uint8Instruction = (value: number) => ($: BufferedWritable) => $.unsafeWriteUint8(value);
const uint16Instruction = (value: number) => ($: BufferedWritable) => $.unsafeWriteUint16(value);
const uint24Instruction = (value: number) => ($: BufferedWritable) => $.unsafeWriteUint24(value);
const uint32Instruction = (value: number) => ($: BufferedWritable) => $.unsafeWriteUint32(value);
const uint48Instruction = (value: number) => ($: BufferedWritable) => $.unsafeWriteUint48(value);
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
const uuidInstruction = (id: UUID) => ($: BufferedWritable) => $.unsafeWriteUuid(id);
const utf8Instruction = (text: string) => ($: BufferedWritable) => $.unsafeWriteUtf8(text);
const switchChannelLowInstruction = (channel: number) => ($: BufferedWritable) =>  $.unsafeWriteUint8(PacketTypeBits.ChannelSwitchLow | channel);
const switchChannelHighInstruction = (channel: number) => ($: BufferedWritable) =>  {
  $.unsafeWriteUint8(PacketTypeBits.ChannelSwitch | (channel >> 8));
  $.unsafeWriteUint8(channel & 0x00ff);
};
const ackInstruction = (id: UUID) => ($: BufferedWritable) => {
  $.unsafeWriteUint8(PacketTypeBits.Ack);
  $.unsafeWriteUuid(id);
};
const revokeInstruction = (id: UUID) => ($: BufferedWritable) => {
  $.unsafeWriteUint8(PacketTypeBits.Revoke);
  $.unsafeWriteUuid(id);
};
const bufferInlineInstruction = (buffer: Buffer) => ($: BufferedWritable) => $.unsafeInlineBuffer(buffer);
const bufferWriteInstruction = (buffer: Buffer) => ($: BufferedWritable) => $.unsafeWriteBuffer(buffer);

// TODO: It doesn't have to use BufferedWritable,
//       it could have a pre-allocated buffer without all additional stuff.
export class StreamWriter {
  readonly #buffer: BufferedWritable;
  readonly #maxChannels: number;

  readonly #streamingChannels: boolean[]; // TODO: Consider Record<number, boolean>?
  readonly #reservedChannels: boolean[]; // TODO: Consider Record<number, boolean>?
  readonly #waitingForIdle: ((channel: number, release: () => void) => void)[] = [];

  #currentPacket: number | null = null;
  #currentPacketBytes = 0;
  #currentChannel = 0;

  #packetFileIndex = 0;

  #firstInstruction: StreamWriterInstruction | undefined = undefined;
  #lastInstruction: StreamWriterInstruction | undefined = undefined;
  #instructionsPacketPlaceholder: StreamWriterInstruction | undefined = undefined;
  #instructionsMaxBytes = 0;
  #instructionsCount = 0;

  #scheduled = false;

  public constructor(writable: Writable, options: StreamWriterOptions = {}) {
    // Save information about maximum number of channels
    this.#maxChannels = options?.maxChannels ?? 4095;
    if (this.#maxChannels < 1 || this.#maxChannels > 4095) {
      throw new Error('Number of max concurrent channels must be between 1 and 4095');
    }

    // Prepare bucket for information about streaming/reserved channels
    this.#streamingChannels = new Array(this.#maxChannels).fill(false);
    this.#reservedChannels = new Array(this.#maxChannels).fill(false);

    // Build buffered writable (?)
    const poolSize = options.poolSize ?? 16_384;
    const reservedOversizeBytes = options.poolReservedOversizeBytes ?? 20;
    this.#buffer = new BufferedWritable(writable, {
      poolSize,
      reservedOversizeBytes,
    });
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

    // TODO: Do it better?
    this.#buffer.arrangeSize(this.#instructionsMaxBytes);

    let instruction = this.#firstInstruction;
    this.#firstInstruction = undefined;

    // TODO: Handle errors?
    // TODO: Wait for drain? and recalculate max bytes for sent instructions?
    while (instruction) {
      if (this.#buffer.needsDrain) {
        this.#firstInstruction = instruction;
        this.#buffer.drained(this.#commit);
        this.#buffer.sendImmediately();
        return;
      }
      instruction.run(this.#buffer);
      instruction.written?.();
      this.#buffer.addCallback(instruction.sent);
      instruction = instruction.next;
      this.#instructionsCount--;
    }
    this.#instructionsCount = 0;
    this.#instructionsMaxBytes = 0;
    this.#lastInstruction = undefined;

    this.#buffer.sendImmediately(); // FIXME
  };

  #isPacket(type: number): boolean {
    return (this.#currentPacket! & type) === type;
  }

  // TODO: Split it when it's over some size
  #instruction(instruction: (buffer: BufferedWritable) => void, maxByteLength: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#instructionsCount++;
    this.#instructionsMaxBytes += maxByteLength;
    if (this.#currentPacket !== null) {
      this.#currentPacketBytes += maxByteLength;
    }

    // TODO: benchmark POJO instead
    const item = new StreamWriterInstruction(instruction, sent, written);
    if (this.#lastInstruction) {
      this.#lastInstruction = this.#lastInstruction.next = item;
    } else {
      this.#firstInstruction = this.#lastInstruction = item;
    }

    // TODO: Consider that
    if (this.#currentPacket === null && (this.#instructionsMaxBytes > 65_000 || this.#instructionsCount > 500)) {
      this.#commit();
    } else {
      this.#schedule();
    }
  }

  #callback(sent?: SendCallback, written?: WriteCallback): void {
    if (sent || written) {
      this.#instruction(noop, 0, sent, written);
    }
  }

  addCallback(sent?: SendCallback, written?: WriteCallback): void {
    this.#callback(sent, written);
  }

  // It assumes that the previous packet is flushed
  #startPacket(packet: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#currentPacket = packet;
    this.#currentPacketBytes = 0;
    const item = this.#instructionsPacketPlaceholder = new StreamWriterInstruction(noop, sent, written);
    if (this.#lastInstruction) {
      this.#lastInstruction = this.#lastInstruction.next = item;
    } else {
      this.#firstInstruction = this.#lastInstruction = item;
    }
    this.#instructionsMaxBytes += 5;
  }

  // TODO: Consider auto-flush on #startPacket
  #endPacket(): void {
    const packet = this.#currentPacket;
    if (packet == null) {
      return;
    }
    const packetBytes = this.#currentPacketBytes;

    // Ignore empty packets
    if (packetBytes === 0) {
      if (this.#isPacket(PacketTypeBits.File)) {
        // FIXME: Hacky way to remove file index
        this.#instructionsPacketPlaceholder!.next!.run = noop;
        // TODO: It's not removing max bytes for index
      }

      this.#currentPacket = null;
      this.#instructionsMaxBytes -= 5;
      return;
    }

    const flags = getPacketSizeFlag(packetBytes);
    const bytes = getPacketSizeBytes(packetBytes);
    this.#instructionsMaxBytes -= 4 - bytes;
    // TODO: Consider function builders
    this.#instructionsPacketPlaceholder!.run = ($) => {
      $.unsafeWriteUint8(packet | flags);
      $.unsafeWriteUint(packetBytes, bytes);
    };
    this.#currentPacket = null;

    // TODO: Consider that
    // FIXME: Flush if the list is big
    // if (this.#instructionsMaxBytes > 65_000) {
    if (this.#instructionsMaxBytes > 65_000 || this.#instructionsCount > 500) {
      this.#commit();
    }
  }

  // TODO: Think if "immediate" information is required
  public drained(fn: (immediate: boolean) => void): void {
    this.#buffer.drained(fn);
  }

  // Packets

  public heartbeat(sent?: SendCallback, written?: WriteCallback): void {
    this.#endPacket();
    this.#instruction(heartbeatInstruction, 1, sent, written);
  }

  public goAway(sent?: SendCallback, written?: WriteCallback): void {
    this.#endPacket();
    this.#instruction(goAwayInstruction, 1, sent, written);
  }

  public abort(sent?: SendCallback, written?: WriteCallback): void {
    this.#endPacket();
    this.#instruction(abortInstruction, 1, sent, written);
  }

  public channel(channel: number, sent?: SendCallback, written?: WriteCallback): void {
    if (this.#currentChannel === channel) {
      this.#callback(sent, written);
      return;
    }
    this.#endPacket();
    this.#currentChannel = channel;
    if (channel <= 0x0f) {
      this.#instruction(switchChannelLowInstruction(channel), 1, sent, written);
    } else if (channel <= 0x0fff) {
      this.#instruction(switchChannelHighInstruction(channel), 2, sent, written);
    } else {
      throw new Error(`Maximum channel ID is 4095.`);
    }
  }

  public ack(id: UUID, sent?: SendCallback, written?: WriteCallback): void {
    this.#endPacket();
    this.#instruction(ackInstruction(id), 17, sent, written);
  }

  public revoke(id: UUID, sent?: SendCallback, written?: WriteCallback): void {
    this.#endPacket();
    this.#instruction(revokeInstruction(id), 17, sent, written);
  }

  // TODO: Consider disallowing when the previous message is not finished yet (?)
  public startMessage(expectsResponse: boolean, hasStream: boolean, sent?: SendCallback, written?: WriteCallback): void {
    const type = PacketTypeBits.Message | (
      (hasStream ? PacketStreamBits.Yes : PacketStreamBits.No) |
      (expectsResponse ? PacketResponseBits.Yes : PacketResponseBits.No)
    );
    this.#endPacket();
    this.#startPacket(type, sent, written);
  }

  public continueMessage(sent?: SendCallback, written?: WriteCallback): void {
    if (this.#isPacket(PacketTypeBits.Message) || this.#isPacket(PacketTypeBits.Continue) || this.#isPacket(PacketTypeBits.Response)) {
      this.#callback(sent, written);
      return;
    }
    this.#endPacket();
    this.#startPacket(PacketTypeBits.Continue);
  }

  // public startResponse(expectsResponse: boolean, hasStream: boolean, sent?: SendCallback, written?: WriteCallback): void {
  //
  // }
  //
  // public continueResponse(sent?: SendCallback, written?: WriteCallback): void {
  //
  // }

  public stream(sent?: SendCallback, written?: WriteCallback): void {
    if (this.#isPacket(PacketTypeBits.Stream)) {
      this.#callback(sent, written);
      return;
    }
    this.#endPacket();
    this.#startPacket(PacketTypeBits.Stream, sent, written);
  }

  public endStream(sent?: SendCallback, written?: WriteCallback): void {
    this.#streamingChannels[this.#currentChannel] = false;
    this.#endPacket();
    this.#instruction(streamEndInstruction, 1, sent, written);
  }

  public data(sent?: SendCallback, written?: WriteCallback): void {
    if (this.#isPacket(PacketTypeBits.Data)) {
      this.#callback(sent, written);
      return;
    }
    this.#endPacket();
    this.#startPacket(PacketTypeBits.Data, sent, written);
  }

  public file(index: number, sent?: SendCallback, written?: WriteCallback): void {
    if (this.#isPacket(PacketTypeBits.File) && this.#packetFileIndex === index) {
      this.#callback(sent, written);
      return;
    }
    this.#endPacket();
    this.#packetFileIndex = index;

    const flags = getFileIndexFlag(index);
    const bytes = getFileIndexBytes(index);
    this.#startPacket(PacketTypeBits.File | flags, sent, written);
    // TODO: Include that in start packet instruction somehow
    this.#instruction(uintInstruction(index, bytes), bytes, sent, written);
    this.#currentPacketBytes--; // FIXME: Hacky way
  }

  public endFile(index: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#endPacket();

    const flags = getFileIndexFlag(index);
    const bytes = getFileIndexBytes(index);
    this.#instruction(fileEndInstruction(flags, index, bytes), bytes + 1, sent, written);
  }

  // Instructions

  public writeUuid(uuid: UUID, sent?: SendCallback, written?: WriteCallback): void {
    this.#instruction(uuidInstruction(uuid), 16, sent, written);
  }

  public writeUtf8(text: string, sent?: SendCallback, written?: WriteCallback): void {
    this.#instruction(utf8Instruction(text), Buffer.byteLength(text), sent, written);
  }

  public writeBuffer(buffer: Buffer, sent?: SendCallback, written?: WriteCallback): void {
    const length = buffer.length;
    if (length > 30_000) {
      this.#instruction(bufferWriteInstruction(buffer), 0, sent, written);
      this.#currentPacketBytes += length; // FIXME: Hacky way
    } else {
      this.#instruction(bufferInlineInstruction(buffer), length, sent, written);
    }
  }

  public writeUint8(uint: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#instruction(uint8Instruction(uint), 1, sent, written);
  }

  public writeUint16(uint: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#instruction(uint16Instruction(uint), 2, sent, written);
  }

  public writeUint24(uint: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#instruction(uint24Instruction(uint), 3, sent, written);
  }

  public writeUint32(uint: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#instruction(uint32Instruction(uint), 4, sent, written);
  }

  public writeUint48(uint: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#instruction(uint48Instruction(uint), 6, sent, written);
  }

  public writeUint(uint: number, byteLength: number, sent?: SendCallback, written?: WriteCallback): void {
    this.#instruction(uintInstruction(uint, byteLength), byteLength, sent, written);
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
}
