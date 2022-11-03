import { createContentProducerSlice } from '../ContentProducer';
import { none } from './none';

export const data = (data: Buffer | undefined) => {
  if (data == null) {
    return none;
  }
  // TODO: Support splitting for >4GB
  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    writer.channelNoCallback(channel);
    writer.data();
    writer.writeBuffer(data, sent, written);
    registered?.();
  });
}
