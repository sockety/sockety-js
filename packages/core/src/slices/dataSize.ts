import { createContentProducerSlice } from '../ContentProducer';
import { none } from './none';
import { createNumberBytesGetter } from '../createNumberBytesGetter';

const getDataBytes = createNumberBytesGetter('data', [ 0, 1, 2, 6 ]);

export const dataSize = (dataLength: number) => {
  const dataSizeBytes = getDataBytes(dataLength);

  if (dataSizeBytes === 0) {
    return none;
  }

  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    writer.channelNoCallback(channel);
    writer.continueMessageNoCallback();
    writer.writeUint(dataLength, dataSizeBytes, sent, written);
    registered?.();
  });
}
