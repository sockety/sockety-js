import { BufferReader } from '@sockety/buffers';
import { FileNameSizeBits, FileSizeBits, MessageDataSizeBits, MessageFilesCountBits, MessageFilesSizeBits } from '../bits';

/* eslint-disable arrow-parens, function-paren-newline, @typescript-eslint/no-shadow, newline-per-chained-call, comma-style, function-call-argument-newline, max-len */

export const createResponsePacketReader = new BufferReader()
  .uint8('flags').setInternal('flags')

  .uuid('parentId')
  .uuid('id')

  .mask<'_dataSize', MessageDataSizeBits>('_dataSize', 'flags', 0b11000000).setInternal('_dataSize')
  .when('_dataSize', MessageDataSizeBits.None, $ => $.constant('dataSize', 0))
  .when('_dataSize', MessageDataSizeBits.Uint8, $ => $.uint8('dataSize'))
  .when('_dataSize', MessageDataSizeBits.Uint16, $ => $.uint16le('dataSize'))
  .when('_dataSize', MessageDataSizeBits.Uint48, $ => $.uint48le('dataSize'))

  .mask<'_filesCount', MessageFilesCountBits>('_filesCount', 'flags', 0b00110000).setInternal('_filesCount')
  .when('_filesCount', MessageFilesCountBits.None, $ => $.constant('filesCount', 0))
  .when('_filesCount', MessageFilesCountBits.Uint8, $ => $.uint8('filesCount'))
  .when('_filesCount', MessageFilesCountBits.Uint16, $ => $.uint16le('filesCount'))
  .when('_filesCount', MessageFilesCountBits.Uint24, $ => $.uint24le('filesCount'))

  .mask<'_filesSize', MessageFilesSizeBits>('_filesSize', 'flags', 0b00001100).setInternal('_filesSize')
  .compute<'__filesSize', number>('__filesSize', $ => `return ${$.read('_filesCount')} === ${MessageFilesCountBits.None} ? -1 : ${$.read('_filesSize')}`).setInternal('__filesSize')
  .when('__filesSize', -1, $ => $.constant('filesSize', 0))
  .when('__filesSize', MessageFilesSizeBits.Uint16, $ => $.uint16le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint24, $ => $.uint24le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint32, $ => $.uint32le('filesSize'))
  .when('__filesSize', MessageFilesSizeBits.Uint48, $ => $.uint48le('filesSize'))

  // TODO: Consider ignoring when there is no data
  .arrayDynamic('filesHeader', 'filesCount', $ => $
    .uint8('header').setInternal('header')

    .mask<'_size', FileSizeBits>('_size', 'header', 0b00001100).setInternal('_size')
    .when('_size', FileSizeBits.Uint8, $ => $.uint8('size'))
    .when('_size', FileSizeBits.Uint16, $ => $.uint16le('size'))
    .when('_size', FileSizeBits.Uint24, $ => $.uint24le('size'))
    .when('_size', FileSizeBits.Uint48, $ => $.uint48le('size'))

    .mask<'_nameSize', FileNameSizeBits>('_nameSize', 'header', 0b00000010).setInternal('_nameSize')
    .when('_nameSize', FileNameSizeBits.Uint8, $ => $.uint8('nameSize').setInternal('nameSize'))
    .when('_nameSize', FileNameSizeBits.Uint16, $ => $.uint16le('nameSize').setInternal('nameSize'))
    .utf8Dynamic('name', 'nameSize')
  , true)

  .end();
