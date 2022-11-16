import { createContentProducer } from '../ContentProducer';

export const none = createContentProducer<void>((writer, sent, written) => {
  writer.addCallback(sent, written);
});
