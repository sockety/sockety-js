import { createContentProducerSlice } from '../ContentProducer';

export const fileEnd = (index: number) => createContentProducerSlice((writer, sent, registered, channel) => {
  writer.channel(channel);
  writer.endFile(index, sent);
  registered();
})
