import { createContentProducerSlice } from '../ContentProducer';

export const none = createContentProducerSlice((writer, channel, sent, written, registered) => {
  writer.addCallback(sent, written);
  registered?.();
});
