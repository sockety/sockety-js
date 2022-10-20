import { UUID } from '@sockety/uuid';
import { createMessageProducer, MessageProducer } from '../MessageProducer';

export function revoke(uuid: UUID): MessageProducer<void> {
  return createMessageProducer<void>((writer, expectsResponse, callback) => {
    writer.writeRevoke(uuid, callback);
  });
}
