import { UUID } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from '../ContentProducer';
import { FastReplyCode } from '../constants';

export function accept(uuid: UUID): ContentProducer<void> {
  return createContentProducer<void>((writer, sent, written) => {
    writer.fastReply(uuid, FastReplyCode.Accept, sent, written);
  });
}
