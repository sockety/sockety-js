import { createContentProducer } from '../ContentProducer';

export const heartbeat = createContentProducer<void>((writer, expectsResponse, callback) => {
  writer.heartbeat(callback);
});
