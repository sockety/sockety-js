import { createContentProducerSlice } from '../ContentProducer';

export const none = createContentProducerSlice((writer, sent, registered, channel) => {
  writer.addCallback(sent);
  registered();
});
