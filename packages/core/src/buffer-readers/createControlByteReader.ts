import { BufferReader } from '@sockety/buffers';
import { ControlChannelBits } from '../bits';

export const createControlByteReader = new BufferReader()
  .uint8('control')
  .mask<'size', ControlChannelBits>('size', 'control', 0b00000011)
  .setInternal('size')
  .when('size', ControlChannelBits.Single, ($) => $.constant('channels', 1))
  .when('size', ControlChannelBits.Maximum, ($) => $.constant('channels', Infinity))
  .when('size', ControlChannelBits.Uint8, ($) => $.uint8('channels'))
  .when('size', ControlChannelBits.Uint16, ($) => $.uint16le('channels'))
  .end();
