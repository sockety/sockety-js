import { createContentProducerSlice } from '../ContentProducer';
import { createNumberBytesGetter } from '../createNumberBytesGetter';

const getActionNameBytes = createNumberBytesGetter('action name', [ 1, 2 ]);

export const action = (name: string) => {
  const action = Buffer.from(name);
  const length = action.length;
  const bytes = getActionNameBytes(length);
  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    writer.channelNoCallback(channel);
    writer.continueMessageNoCallback();
    writer.writeUint(length, bytes);
    writer.writeBuffer(action, sent, written);
    registered?.();
  });
}
