import { ContentProducerSlice, createContentProducerSlice } from '../ContentProducer';
import { none } from './none';
import { pipe } from './pipe';

// TODO: Extract
const MAX_DATA_PACKET_SIZE = 4 * 1024 * 1024;

export const data = (buffer: Buffer | undefined): ContentProducerSlice => {
  if (buffer == null) {
    return none;
  }

  const size = buffer.length;
  if (size > MAX_DATA_PACKET_SIZE) {
    // TODO: Unify splitting for different types of packets
    const slices = [];
    for (let offset = 0; offset < size; offset += MAX_DATA_PACKET_SIZE) {
      slices.push(data(buffer.subarray(offset, offset + MAX_DATA_PACKET_SIZE)));
    }
    return pipe(slices);
  }

  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    writer.channel(channel);
    writer.data();
    writer.writeBuffer(buffer, sent, written);
    registered?.();
  });
}
