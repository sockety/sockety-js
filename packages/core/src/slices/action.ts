import { createContentProducerSlice } from '../ContentProducer';
import { createNumberBytesGetter } from '../createNumberBytesGetter';

const getActionNameBytes = createNumberBytesGetter('action name', [ 1, 2 ]);

export function action(name: string) {
  const buffer = Buffer.from(name);
  const { length } = buffer;
  const bytes = getActionNameBytes(length);
  return createContentProducerSlice((writer, sent, registered, channel) => {
    writer.channel(channel);
    writer.continueMessage();
    writer.writeUint(length, bytes);
    writer.writeBuffer(buffer, sent);
    registered();
  });
}
