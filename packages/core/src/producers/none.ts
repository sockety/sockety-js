import { createContentProducer } from '../ContentProducer';

export const none = createContentProducer<void>((writer, sent, registered) => {
  writer.addCallback(sent);
  registered();
});
