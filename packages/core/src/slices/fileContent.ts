import { ContentProducerSlice, createContentProducerSlice } from '../ContentProducer';
import { none } from './none';
import { pipe } from './pipe';

// TODO: Extract
const MAX_FILE_PACKET_SIZE = 4 * 1024 * 1024;

export const fileContent = (index: number) => {
  const fileContentForIndex = (content: Buffer | undefined): ContentProducerSlice => {
    if (content == null) {
      return none;
    }

    const size = content.length;
    if (size > MAX_FILE_PACKET_SIZE) {
      // TODO: Unify splitting for different types of packets
      const slices = [];
      for (let offset = 0; offset < size; offset += MAX_FILE_PACKET_SIZE) {
        slices.push(fileContentForIndex(content.subarray(offset, offset + MAX_FILE_PACKET_SIZE)));
      }
      return pipe(slices);
    }

    return createContentProducerSlice((writer, channel, sent, registered) => {
      writer.channel(channel);
      writer.file(index);
      writer.writeBuffer(content, sent);
      registered?.();
    });
  };

  return fileContentForIndex;
}
