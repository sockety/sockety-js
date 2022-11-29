import { createContentProducerSlice } from '../ContentProducer';

export const none = createContentProducerSlice((writer, channel, sent, registered) => {
  writer.addCallback(sent);
  registered?.();
});
