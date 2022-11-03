import { createContentProducerSlice } from '../ContentProducer';
import { none } from './none';

export const step = (fn: () => void) => {
  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    fn();
    writer.addCallback(sent, written);
    registered?.();
  });
}
