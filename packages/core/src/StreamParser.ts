import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { Buffer } from 'node:buffer';
import { BufferReader } from '@sockety/buffers';
import { UUID } from '@sockety/uuid';
import { FileIndexBits, FileSizeBits, PacketSizeBits, PacketTypeBits } from './constants';
import { SocketChannel } from './SocketChannel';

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
      .rawDynamic('messageContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint16, $ => $
      .uint16le('size').setInternal('size')
      .rawDynamic('messageContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint24, $ => $
      .uint24le('size').setInternal('size')
      .rawDynamic('messageContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint32, $ => $
      .uint32le('size').setInternal('size')
      .rawDynamic('messageContent', 'size', true)
      .earlyEnd())

    .fail('Invalid packet size bits'))

  .when('type', PacketTypeBits.Continue, $ => $
    .mask<'_size', PacketSizeBits>('_size', 'header', 0b00001100).setInternal('_size')

    .when('_size', PacketSizeBits.Uint8, $ => $
      .uint8('size').setInternal('size')
      .rawDynamic('continueContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint16, $ => $
      .uint16le('size').setInternal('size')
      .rawDynamic('continueContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint24, $ => $
      .uint24le('size').setInternal('size')
      .rawDynamic('continueContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint32, $ => $
      .uint32le('size').setInternal('size')
      .rawDynamic('continueContent', 'size', true)
      .earlyEnd())

    .fail('Invalid packet size bits'))

  .when('type', PacketTypeBits.Response, $ => $
    .flag('responseHasStream', 'header', 0b00000010)
    .flag('responseExpectsResponse', 'header', 0b00000001)
    .mask<'_size', PacketSizeBits>('_size', 'header', 0b00001100).setInternal('_size')

    .when('_size', PacketSizeBits.Uint8, $ => $
      .uint8('size').setInternal('size')
      .rawDynamic('responseContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint16, $ => $
      .uint16le('size').setInternal('size')
      .rawDynamic('responseContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint24, $ => $
      .uint24le('size').setInternal('size')
      .rawDynamic('responseContent', 'size', true)
      .earlyEnd())
    .when('_size', PacketSizeBits.Uint32, $ => $
      .uint32le('size').setInternal('size')
      .rawDynamic('responseContent', 'size', true)
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
  .when('type', PacketTypeBits.Ack, $ => $
    .uuid('ack')
    .earlyEnd())
  .when('type', PacketTypeBits.Revoke, $ => $
    .uuid('revoke')
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
    .mask<'_fileIndex', FileIndexBits>('_fileIndex', 'header', 0b00001100).setInternal('_fileIndex')
    .when('_fileIndex', FileIndexBits.Uint8, $ => $.uint8('fileIndex').setInternal('fileIndex'))
    .when('_fileIndex', FileIndexBits.Uint16, $ => $.uint16le('fileIndex').setInternal('fileIndex'))
    .when('_fileIndex', FileIndexBits.Uint24, $ => $.uint24le('fileIndex').setInternal('fileIndex'))

    .mask<'_fileSize', FileSizeBits>('_fileSize', 'header', 0b00000011).setInternal('_fileSize')
    .when('_fileSize', FileSizeBits.Uint8, $ => $
      .uint8('fileSize').setInternal('fileSize')
      .rawDynamic('fileContent', 'fileSize', true)
      .earlyEnd())
    .when('_fileSize', FileSizeBits.Uint16, $ => $
      .uint16le('fileSize').setInternal('fileSize')
      .rawDynamic('fileContent', 'fileSize', true)
      .earlyEnd())
    .when('_fileSize', FileSizeBits.Uint24, $ => $
      .uint24le('fileSize').setInternal('fileSize')
      .rawDynamic('fileContent', 'fileSize', true)
      .earlyEnd())
    .when('_fileSize', FileSizeBits.Uint48, $ => $
      .uint48le('fileSize').setInternal('fileSize')
      .rawDynamic('fileContent', 'fileSize', true)
      .earlyEnd())
  )
  .when('type', PacketTypeBits.FileEnd, $ => $
    .mask<'_fileIndex', FileIndexBits>('_fileIndex', 'header', 0b00001100).setInternal('_fileIndex')
    .when('_fileIndex', FileIndexBits.Uint8, $ => $.uint8('fileEnd'))
    .when('_fileIndex', FileIndexBits.Uint16, $ => $.uint16le('fileEnd'))
    .when('_fileIndex', FileIndexBits.Uint24, $ => $.uint24le('fileEnd'))
    .earlyEnd())

  .fail('Unknown packet type bits')

  .end();

export class StreamParser extends Writable {
  // Current state
  #channels: Record<number, SocketChannel> = {};
  #currentChannel = this.#getChannel(0);

  #switchChannel = (channelId: number) => {
    this.#currentChannel = this.#getChannel(channelId);
  };

  #ack = (uuid: UUID) => this.emit('ack', uuid);
  #revoke = (uuid: UUID) => this.emit('revoke', uuid);
  #heartbeat = () => this.emit('heartbeat');
  #goAway = () => this.emit('goAway');

  #passStream = (buffer: Buffer) => this.#currentChannel.consumeStream(buffer);

  #messageHasStream = (hasStream: boolean) => this.#currentChannel.startMessage(hasStream);
  #messageExpectsResponse = (expectsResponse: boolean) => this.#currentChannel.setExpectsResponse(expectsResponse);
  #messageContent = (buffer: Buffer) => {
    const message = this.#currentChannel.consumeMessage(buffer);
    if (message) {
      this.emit('message', message);
    }
  };

  #responseHasStream = (hasStream: boolean) => this.#currentChannel.startResponse(hasStream);
  #responseExpectsResponse = (expectsResponse: boolean) => this.#currentChannel.setExpectsResponse(expectsResponse);
  #responseContent = (buffer: Buffer) => this.#currentChannel.consumeResponse(buffer);

  #continueContent = (buffer: Buffer) => this.#currentChannel.consumeContinue(buffer);

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
    ack: this.#ack,
    revoke: this.#revoke,
    abort: this.#abort,
    heartbeat: this.#heartbeat,
    goAway: this.#goAway,
    fileIndex: this.#setFileIndex,
    fileContent: this.#appendFileContent,
    fileEnd: this.#endFile,
  }).readMany;

  #getChannel(id: number): SocketChannel {
    if (this.#channels[id] === undefined) {
      this.#channels[id] = new SocketChannel();
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
