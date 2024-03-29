import { createContentProducerSlice } from '../ContentProducer';
import { none } from './none';
import { createNumberBytesGetter } from '../utils/createNumberBytesGetter';

const getDataBytes = createNumberBytesGetter('data', [ 0, 1, 2, 6 ]);

function buildDataSize(dataLength: number) {
  const dataSizeBytes = getDataBytes(dataLength);

  if (dataSizeBytes === 0) {
    return none;
  }

  return createContentProducerSlice((writer, sent, registered, channel) => {
    writer.channel(channel);
    writer.continueMessage();
    writer.writeUint(dataLength, dataSizeBytes, sent);
    registered();
  });
}

export const dataSize = Object.assign(buildDataSize, {
  empty: buildDataSize(0),
});
