import { createContentProducerSlice } from '../ContentProducer';
import { none } from './none';

export const fileContent = (index: number) => (content: Buffer | undefined) => {
  if (content == null) {
    return none;
  }
  // TODO: Support splitting for >4GB
  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    writer.channelNoCallback(channel);
    writer.file(index);
    writer.writeBuffer(content, sent, written);
    registered?.();
  });
}
