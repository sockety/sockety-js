import { createMessageProducer } from '../MessageProducer';

export const heartbeat = createMessageProducer<void>((writer, expectsResponse, callback) => {
  writer.writeHeartbeat(callback);
});
