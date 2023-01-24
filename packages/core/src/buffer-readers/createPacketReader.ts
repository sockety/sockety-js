import { BufferReader } from '@sockety/buffers';
import { FileIndexBits, PacketSizeBits, PacketTypeBits } from '../bits';
import { FastReply } from '../constants';

/* eslint-disable arrow-parens, function-paren-newline, @typescript-eslint/no-shadow, newline-per-chained-call, comma-style, function-call-argument-newline, max-len */

export const createPacketReader = new BufferReader()
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
  // 0x0f
  .when('type', PacketTypeBits.FastReplyLow, $ => $
    .mask<'fastReply', FastReply | number>('fastReply', 'header', 0x0f)
    .uuid('fastReplyUuid')
    .earlyEnd())
  // 0x0fff
  .when('type', PacketTypeBits.FastReply, $ => $
    .mask('fastReplyHigh', 'header', 0x0f).setInternal('fastReplyHigh')
    .uint8('fastReplyLow').setInternal('fastReplyLow')
    .compute<'fastReply', number>('fastReply', $ => `return (${$.read('fastReplyHigh')} << 8) | ${$.read('fastReplyLow')}`)
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
    .earlyEnd())
  .when('type', PacketTypeBits.FileEnd, $ => $
    .mask<'_fileIndex', FileIndexBits>('_fileIndex', 'header', 0b00000011).setInternal('_fileIndex')
    .when('_fileIndex', FileIndexBits.First, $ => $.constant('fileEnd', 0))
    .when('_fileIndex', FileIndexBits.Uint8, $ => $.uint8('fileEnd'))
    .when('_fileIndex', FileIndexBits.Uint16, $ => $.uint16le('fileEnd'))
    .when('_fileIndex', FileIndexBits.Uint24, $ => $.uint24le('fileEnd'))
    .earlyEnd())

  .fail('Unknown packet type bits')

  .end();
