import { Writable } from 'node:stream';
import type { Buffer } from 'node:buffer';
import { BufferReader } from '@sockety/buffers';
import type { UUID } from '@sockety/uuid';
import { FastReply, FileIndexBits, PacketSizeBits, PacketTypeBits } from '../constants';
import type { RawMessage } from './RawMessage';
import { StreamChannel, StreamChannelOptions } from './StreamChannel';
import { RawResponse } from './RawResponse';

export interface StreamParserOptions<M extends RawMessage, R extends RawResponse> {
  createMessage: StreamChannelOptions<M, R>['createMessage'];
  createResponse: StreamChannelOptions<M, R>['createResponse'];
}

const createPacketConsumer = new BufferReader()
  .uint8('header').setInternal('header')
  .mask<'type', PacketTypeBits>('type', 'header', 0xf0).setInternal('type')

  // Switch Channel
  // 0x0f
  .when('type', PacketTypeBits.ChannelSwitchLow, $ => $
    .mask('channel', 'header', 0x0f)
    .earlyEnd())
  // 0x0fff
  .when('type', PacketTypeBits.ChannelSwitch, $ => $
    .mask('channelHigh', 'header', 0x0f).setInternal('channelHigh')
    .uint8('channelLow').setInternal('channelLow')
    .compute<'channel', number>('channel', $ => `return (${$.read('channelHigh')} << 8) | ${$.read('channelLow')}`)
    .earlyEnd())

  // Handle Message
  .when('type', PacketTypeBits.Message, $ => $
    .flag('messageHasStream', 'header', 0b00000010)
    .flag('messageExpectsResponse', 'header', 0b00000001)
    .mask<'_size', PacketSizeBits>('_size', 'header', 0b00001100).setInternal('_size')

    .when('_size', PacketSizeBits.Uint8, $ => $
      .uint8('size').setInternal('size')
      .passDynamic('messageContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint16, $ => $
      .uint16le('size').setInternal('size')
      .passDynamic('messageContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint24, $ => $
      .uint24le('size').setInternal('size')
      .passDynamic('messageContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint32, $ => $
      .uint32le('size').setInternal('size')
      .passDynamic('messageContent', 'size')
      .earlyEnd())

    .fail('Invalid packet size bits'))

  .when('type', PacketTypeBits.Continue, $ => $
    .mask<'_size', PacketSizeBits>('_size', 'header', 0b00001100).setInternal('_size')

    .when('_size', PacketSizeBits.Uint8, $ => $
      .uint8('size').setInternal('size')
      .passDynamic('continueContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint16, $ => $
      .uint16le('size').setInternal('size')
      .passDynamic('continueContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint24, $ => $
      .uint24le('size').setInternal('size')
      .passDynamic('continueContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint32, $ => $
      .uint32le('size').setInternal('size')
      .passDynamic('continueContent', 'size')
      .earlyEnd())

    .fail('Invalid packet size bits'))

  .when('type', PacketTypeBits.Response, $ => $
    .flag('responseHasStream', 'header', 0b00000010)
    .flag('responseExpectsResponse', 'header', 0b00000001)
    .mask<'_size', PacketSizeBits>('_size', 'header', 0b00001100).setInternal('_size')

    .when('_size', PacketSizeBits.Uint8, $ => $
      .uint8('size').setInternal('size')
      .passDynamic('responseContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint16, $ => $
      .uint16le('size').setInternal('size')
      .passDynamic('responseContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint24, $ => $
      .uint24le('size').setInternal('size')
      .passDynamic('responseContent', 'size')
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint32, $ => $
      .uint32le('size').setInternal('size')
      .passDynamic('responseContent', 'size')
      .earlyEnd())

    .fail('Invalid packet size bits'))

  // Pass Message Stream
  .when('type', PacketTypeBits.Stream, $ => $
    .mask<'_size', PacketSizeBits>('_size', 'header', 0b00001100).setInternal('_size')
    .when('_size', PacketSizeBits.Uint8, $ => $
      .uint8('size').setInternal('size')
      .rawDynamic('stream', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint16, $ => $
      .uint16le('size').setInternal('size')
      .rawDynamic('stream', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint24, $ => $
      .uint24le('size').setInternal('size')
      .rawDynamic('stream', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint32, $ => $
      .uint32le('size').setInternal('size')
      .rawDynamic('stream', 'size', true)
      .earlyEnd())
    .fail('Invalid packet size bits'))

  // Pass Data Stream
  .when('type', PacketTypeBits.Data, $ => $
    .mask<'_size', PacketSizeBits>('_size', 'header', 0b00001100).setInternal('_size')
    .when('_size', PacketSizeBits.Uint8, $ => $
      .uint8('size').setInternal('size')
      .rawDynamic('data', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint16, $ => $
      .uint16le('size').setInternal('size')
      .rawDynamic('data', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint24, $ => $
      .uint24le('size').setInternal('size')
      .rawDynamic('data', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint32, $ => $
      .uint32le('size').setInternal('size')
      .rawDynamic('data', 'size', true)
      .earlyEnd())
    .fail('Invalid packet size bits'))

  // Inform Stream End
  .when('type', PacketTypeBits.StreamEnd, $ => $
    .constant('streamEnd', true)
    .earlyEnd())

  // Reply Fast
  .when('type', PacketTypeBits.FastReply, $ => $
    .mask<'fastReply', FastReply | number>('fastReply', 'header', 0b00001111)
    .uuid('fastReplyUuid')
    .earlyEnd())

  // Abort Message
  .when('type', PacketTypeBits.Abort, $ => $
    .constant('abort', true)
    .earlyEnd())

  // Signals
  .when('type', PacketTypeBits.Heartbeat, $ => $
    .constant('heartbeat', true)
    .earlyEnd())
  .when('type', PacketTypeBits.GoAway, $ => $
    .constant('goAway', true)
    .earlyEnd())

  // Files
  .when('type', PacketTypeBits.File, $ => $
    .mask<'_fileSize', PacketSizeBits>('_fileSize', 'header', 0b00001100).setInternal('_fileSize')
    .when('_fileSize', PacketSizeBits.Uint8, $ => $.uint8('fileSize').setInternal('fileSize'))
    .when('_fileSize', PacketSizeBits.Uint16, $ => $.uint16le('fileSize').setInternal('fileSize'))
    .when('_fileSize', PacketSizeBits.Uint24, $ => $.uint24le('fileSize').setInternal('fileSize'))
    .when('_fileSize', PacketSizeBits.Uint32, $ => $.uint48le('fileSize').setInternal('fileSize'))

    .mask<'_fileIndex', FileIndexBits>('_fileIndex', 'header', 0b00000011).setInternal('_fileIndex')
    .when('_fileIndex', FileIndexBits.First, $ => $.constant('fileIndex', 0))
    .when('_fileIndex', FileIndexBits.Uint8, $ => $.uint8('fileIndex'))
    .when('_fileIndex', FileIndexBits.Uint16, $ => $.uint16le('fileIndex'))
    .when('_fileIndex', FileIndexBits.Uint24, $ => $.uint24le('fileIndex'))

    .rawDynamic('fileContent', 'fileSize', true)
    .earlyEnd()
  )
  .when('type', PacketTypeBits.FileEnd, $ => $
    .mask<'_fileIndex', FileIndexBits>('_fileIndex', 'header', 0b00000011).setInternal('_fileIndex')
    .when('_fileIndex', FileIndexBits.First, $ => $.constant('fileEnd', 0))
    .when('_fileIndex', FileIndexBits.Uint8, $ => $.uint8('fileEnd'))
    .when('_fileIndex', FileIndexBits.Uint16, $ => $.uint16le('fileEnd'))
    .when('_fileIndex', FileIndexBits.Uint24, $ => $.uint24le('fileEnd'))
    .earlyEnd())

  .fail('Unknown packet type bits')

  .end();

export class StreamParser<M extends RawMessage = RawMessage, R extends RawResponse = RawResponse> extends Writable {
  readonly #options?: Partial<StreamParserOptions<M, R>>;

  // Current state
  #channels: Record<number, StreamChannel<M, R>> = {};
  #currentChannel: StreamChannel<M, R>;
  #fastReplyCode = 0;

  public constructor(options?: Partial<StreamParserOptions<M, R>>) {
    super();
    this.#options = options;
    this.#currentChannel = this.#getChannel(0);
  }

  #switchChannel = (channelId: number) => {
    this.#currentChannel = this.#getChannel(channelId);
  };

  #setFastReply = (code: number) => {
    this.#fastReplyCode = code;
  };
  #setFastReplyUuid = (uuid: UUID) => this.emit('fast-reply', uuid, this.#fastReplyCode);
  #heartbeat = () => this.emit('heartbeat');
  #goAway = () => this.emit('goAway');

  #passStream = (buffer: Buffer) => this.#currentChannel.consumeStream(buffer);

  #messageHasStream = (hasStream: boolean) => this.#currentChannel.startMessage(hasStream);
  #messageExpectsResponse = (expectsResponse: boolean) => this.#currentChannel.setExpectsResponse(expectsResponse);
  #messageContent = (buffer: Buffer, offset: number, end: number) => {
    const message = this.#currentChannel.consumeMessage(buffer, offset, end);
    if (message) {
      // TODO: Think if next tick should be there
      process.nextTick(() => {
        // TODO: Do it only when the message is not aborted
        this.emit('message', message);
      });
    }
  };

  #responseHasStream = (hasStream: boolean) => this.#currentChannel.startResponse(hasStream);
  #responseExpectsResponse = (expectsResponse: boolean) => this.#currentChannel.setExpectsResponse(expectsResponse);
  #responseContent = (buffer: Buffer, offset: number, end: number) => {
    const response = this.#currentChannel.consumeResponse(buffer, offset, end);
    if (response) {
      // TODO: Think if next tick should be there
      process.nextTick(() => {
        // TODO: Do it only when the response is not aborted
        this.emit('response', response);
      });
    }
  };

  #continueContent = (buffer: Buffer, offset: number, end: number) => {
    if (this.#currentChannel.isMessage()) {
      const message = this.#currentChannel.consumeMessage(buffer, offset, end);
      if (message) {
        // TODO: Think if next tick should be there
        process.nextTick(() => {
          // TODO: Do it only when the message is not aborted
          this.emit('message', message);
        });
      }
    } else {
      const response = this.#currentChannel.consumeResponse(buffer, offset, end);
      if (response) {
        // TODO: Think if next tick should be there
        process.nextTick(() => {
          // TODO: Do it only when the response is not aborted
          this.emit('response', response);
        });
      }
    }
  }

  #appendData = (buffer: Buffer) => this.#currentChannel.consumeData(buffer);

  #setFileIndex = (index: number) => this.#currentChannel.setFileIndex(index);
  #appendFileContent = (content: Buffer) => this.#currentChannel.appendFileContent(content);
  #endFile = (index: number) => this.#currentChannel.endFile(index);

  #finishStream = () => this.#currentChannel.finishStream();
  #abort = () => this.#currentChannel.abort();

  #consume = createPacketConsumer({
    channel: this.#switchChannel,
    messageHasStream: this.#messageHasStream,
    messageExpectsResponse: this.#messageExpectsResponse,
    messageContent: this.#messageContent,
    responseHasStream: this.#responseHasStream,
    responseExpectsResponse: this.#responseExpectsResponse,
    responseContent: this.#responseContent,
    continueContent: this.#continueContent,
    data: this.#appendData,
    stream: this.#passStream,
    streamEnd: this.#finishStream,
    fastReply: this.#setFastReply,
    fastReplyUuid: this.#setFastReplyUuid,
    abort: this.#abort,
    heartbeat: this.#heartbeat,
    goAway: this.#goAway,
    fileIndex: this.#setFileIndex,
    fileContent: this.#appendFileContent,
    fileEnd: this.#endFile,
  }).readMany;

  #getChannel(id: number): StreamChannel<M, R> {
    if (this.#channels[id] === undefined) {
      this.#channels[id] = new StreamChannel(this.#options);
    }
    return this.#channels[id];
  }

  public _write(buffer: Buffer, encoding: any, callback: (error?: Error | null) => void): void {
    try {
      this.#consume(buffer);
      callback(null);
    } catch (error: any) {
      callback(error);
    }
  }
}

export interface StreamParser<M extends RawMessage = RawMessage, R extends RawResponse = RawResponse> {
  addListener(event: 'message', listener: (message: M) => void): this;
  on(event: 'message', listener: (message: M) => void): this;
  once(event: 'message', listener: (message: M) => void): this;
  prependListener(event: 'message', listener: (message: M) => void): this;
  prependOnceListener(event: 'message', listener: (message: M) => void): this;
  removeListener(event: 'message', listener: (message: M) => void): this;
  emit(event: 'message', message: M): boolean;

  addListener(event: 'response', listener: (response: R) => void): this;
  on(event: 'response', listener: (response: R) => void): this;
  once(event: 'response', listener: (response: R) => void): this;
  prependListener(event: 'response', listener: (response: R) => void): this;
  prependOnceListener(event: 'response', listener: (response: R) => void): this;
  removeListener(event: 'response', listener: (response: R) => void): this;
  emit(event: 'response', response: R): boolean;

  addListener(event: 'fast-reply', listener: (id: UUID, code: number) => void): this;
  on(event: 'fast-reply', listener: (id: UUID, code: number) => void): this;
  once(event: 'fast-reply', listener: (id: UUID, code: number) => void): this;
  prependListener(event: 'fast-reply', listener: (id: UUID, code: number) => void): this;
  prependOnceListener(event: 'fast-reply', listener: (id: UUID, code: number) => void): this;
  removeListener(event: 'fast-reply', listener: (id: UUID, code: number) => void): this;
  emit(event: 'fast-reply', id: UUID, code: number): boolean;

  addListener(event: 'goAway' | 'heartbeat', listener: () => void): this;
  on(event: 'goAway' | 'heartbeat', listener: () => void): this;
  once(event: 'goAway' | 'heartbeat', listener: () => void): this;
  prependListener(event: 'goAway' | 'heartbeat', listener: () => void): this;
  prependOnceListener(event: 'goAway' | 'heartbeat', listener: () => void): this;
  removeListener(event: 'goAway' | 'heartbeat', listener: () => void): this;
  emit(event: 'goAway' | 'heartbeat'): boolean;

  addListener(event: 'close', listener: () => void): this;
  addListener(event: 'data', listener: (chunk: any) => void): this;
  addListener(event: 'end', listener: () => void): this;
  addListener(event: 'error', listener: (err: Error) => void): this;
  addListener(event: 'pause', listener: () => void): this;
  addListener(event: 'readable', listener: () => void): this;
  addListener(event: 'resume', listener: () => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;

  emit(event: 'close'): boolean;
  emit(event: 'data', chunk: any): boolean;
  emit(event: 'end'): boolean;
  emit(event: 'error', err: Error): boolean;
  emit(event: 'pause'): boolean;
  emit(event: 'readable'): boolean;
  emit(event: 'resume'): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;

  on(event: 'close', listener: () => void): this;
  on(event: 'data', listener: (chunk: any) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'pause', listener: () => void): this;
  on(event: 'readable', listener: () => void): this;
  on(event: 'resume', listener: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;

  once(event: 'close', listener: () => void): this;
  once(event: 'data', listener: (chunk: any) => void): this;
  once(event: 'end', listener: () => void): this;
  once(event: 'error', listener: (err: Error) => void): this;
  once(event: 'pause', listener: () => void): this;
  once(event: 'readable', listener: () => void): this;
  once(event: 'resume', listener: () => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;

  prependListener(event: 'close', listener: () => void): this;
  prependListener(event: 'data', listener: (chunk: any) => void): this;
  prependListener(event: 'end', listener: () => void): this;
  prependListener(event: 'error', listener: (err: Error) => void): this;
  prependListener(event: 'pause', listener: () => void): this;
  prependListener(event: 'readable', listener: () => void): this;
  prependListener(event: 'resume', listener: () => void): this;
  prependListener(event: string | symbol, listener: (...args: any[]) => void): this;

  prependOnceListener(event: 'close', listener: () => void): this;
  prependOnceListener(event: 'data', listener: (chunk: any) => void): this;
  prependOnceListener(event: 'end', listener: () => void): this;
  prependOnceListener(event: 'error', listener: (err: Error) => void): this;
  prependOnceListener(event: 'pause', listener: () => void): this;
  prependOnceListener(event: 'readable', listener: () => void): this;
  prependOnceListener(event: 'resume', listener: () => void): this;
  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;

  removeListener(event: 'close', listener: () => void): this;
  removeListener(event: 'data', listener: (chunk: any) => void): this;
  removeListener(event: 'end', listener: () => void): this;
  removeListener(event: 'error', listener: (err: Error) => void): this;
  removeListener(event: 'pause', listener: () => void): this;
  removeListener(event: 'readable', listener: () => void): this;
  removeListener(event: 'resume', listener: () => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
}
