import { Writable } from 'node:stream';
import type { Buffer } from 'node:buffer';
import type { UUID } from '@sockety/uuid';
import { createPacketReader } from '../buffer-readers/createPacketReader';
import type { RawMessage } from './RawMessage';
import { StreamChannel, StreamChannelOptions } from './StreamChannel';
import { RawResponse } from './RawResponse';

export interface StreamParserOptions<M extends RawMessage, R extends RawResponse> {
  createMessage: StreamChannelOptions<M, R>['createMessage'];
  createResponse: StreamChannelOptions<M, R>['createResponse'];
  maxChannels?: number;
}

export class StreamParser<M extends RawMessage = RawMessage, R extends RawResponse = RawResponse> extends Writable {
  readonly #options?: Partial<StreamParserOptions<M, R>>;
  readonly #maxChannels: number;

  // Current state
  #channels: Record<number, StreamChannel<M, R>> = {};
  #currentChannel: StreamChannel<M, R>;
  #fastReplyCode = 0;

  public constructor(options?: Partial<StreamParserOptions<M, R>>) {
    super();
    this.#options = options;
    this.#maxChannels = options?.maxChannels ?? 4096;
    this.#currentChannel = this.#getChannel(0);
  }

  #emitMessage(message: M | null): void {
    if (message === null) {
      return;
    }
    // TODO: Think if next tick should be there
    // TODO: Do it only when the message is not aborted
    process.nextTick(() => this.emit('message', message));
  }

  #emitResponse(message: R | null): void {
    if (message === null) {
      return;
    }
    // TODO: Think if next tick should be there
    // TODO: Do it only when the message is not aborted
    process.nextTick(() => this.emit('response', message));
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
    this.#emitMessage(this.#currentChannel.consumeMessage(buffer, offset, end));
  };

  #responseHasStream = (hasStream: boolean) => this.#currentChannel.startResponse(hasStream);
  #responseExpectsResponse = (expectsResponse: boolean) => this.#currentChannel.setExpectsResponse(expectsResponse);
  #responseContent = (buffer: Buffer, offset: number, end: number) => {
    this.#emitResponse(this.#currentChannel.consumeResponse(buffer, offset, end));
  };

  #continueContent = (buffer: Buffer, offset: number, end: number) => {
    if (this.#currentChannel.isMessage()) {
      this.#emitMessage(this.#currentChannel.consumeMessage(buffer, offset, end));
    } else {
      this.#emitResponse(this.#currentChannel.consumeResponse(buffer, offset, end));
    }
  };

  #appendData = (buffer: Buffer) => this.#currentChannel.consumeData(buffer);

  #setFileIndex = (index: number) => this.#currentChannel.setFileIndex(index);
  #appendFileContent = (content: Buffer) => this.#currentChannel.appendFileContent(content);
  #endFile = (index: number) => this.#currentChannel.endFile(index);

  #finishStream = () => this.#currentChannel.finishStream();
  #abort = () => this.#currentChannel.abort();

  #consume = createPacketReader({
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
    if (id >= this.#maxChannels) {
      throw new Error('Used over maximum channels');
    } else if (this.#channels[id] === undefined) {
      this.#channels[id] = new StreamChannel(this.#options);
    }
    return this.#channels[id];
  }

  // eslint-disable-next-line no-underscore-dangle
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
