import { createContentProducerSlice } from '../ContentProducer';
import { createNumberBytesGetter } from '../createNumberBytesGetter';
import { none } from './none';

const getTotalFilesSizeBytes = createNumberBytesGetter('total files size', [ 2, 3, 4, 6 ]);

const getFilesCountBytes = createNumberBytesGetter('files count', [ 0, 1, 2, 3 ]);

export const filesListHeader = (filesCount: number, totalFilesSize: number) => {
  const filesCountBytes = getFilesCountBytes(filesCount);
  if (filesCountBytes === 0) {
    return none;
  }
  const totalFilesSizeBytes = getTotalFilesSizeBytes(totalFilesSize);
  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    writer.channelNoCallback(channel);
    writer.continueMessageNoCallback();
    writer.writeUint(filesCount, filesCountBytes);
    writer.writeUint(totalFilesSize, totalFilesSizeBytes, sent, written);
    registered?.();
  });
}