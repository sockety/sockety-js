import { createContentProducerSlice } from '../ContentProducer';
import { none } from './none';

export const fileEnd = (index: number) => createContentProducerSlice((writer, channel, sent, written, registered) => {
  writer.channel(channel);
  writer.endFile(index, sent, written);
  registered?.();
})
