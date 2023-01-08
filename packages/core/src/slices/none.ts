import { createContentProducerSlice } from '../ContentProducer';

export const none = createContentProducerSlice((writer, sent, registered) => {
  writer.addCallback(sent);
  registered();
});
