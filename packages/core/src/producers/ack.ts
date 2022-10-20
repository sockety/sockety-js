import { UUID } from '@sockety/uuid';
import { createMessageProducer, MessageProducer } from '../MessageProducer';

export function ack(uuid: UUID): MessageProducer<void> {
  return createMessageProducer<void>((writer, expectsResponse, callback) => {
    writer.writeAck(uuid, callback);
  });
}
