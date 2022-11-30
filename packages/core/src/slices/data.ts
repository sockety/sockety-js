import { ContentProducerSlice, createContentProducerSlice } from '../ContentProducer';
import { none } from './none';
import { pipe } from './pipe';

// TODO: Extract
const MAX_DATA_PACKET_SIZE = 4 * 1024 * 1024;

export const data = (content: Buffer | string | undefined): ContentProducerSlice => {
  if (content == null) {
    return none;
  }

  const buffer = typeof content === 'string' ? Buffer.from(content) : content;

  const size = buffer.length;
  if (size > MAX_DATA_PACKET_SIZE) {
    // TODO: Unify splitting for different types of packets
    const slices = [];
    for (let offset = 0; offset < size; offset += MAX_DATA_PACKET_SIZE) {
      slices.push(data(buffer.subarray(offset, offset + MAX_DATA_PACKET_SIZE)));
    }
    return pipe(slices);
  }

  return createContentProducerSlice((writer, channel, sent, registered) => {
    writer.channel(channel);
    writer.data();
    writer.writeBuffer(buffer, sent);
    registered();
  });
}
