import { createContentProducerSlice } from '../ContentProducer';
import { createNumberBytesGetter } from '../createNumberBytesGetter';
import { none } from './none';

const getTotalFilesSizeBytes = createNumberBytesGetter('total files size', [ 2, 3, 4, 6 ]);

const getFilesCountBytes = createNumberBytesGetter('files count', [ 0, 1, 2, 3 ]);

function buildFilesListHeader(filesCount: number, totalFilesSize: number) {
  const filesCountBytes = getFilesCountBytes(filesCount);
  if (filesCountBytes === 0) {
    return none;
  }
  const totalFilesSizeBytes = getTotalFilesSizeBytes(totalFilesSize);
  return createContentProducerSlice((writer, channel, sent, written, registered) => {
    writer.channel(channel);
    writer.continueMessage();
    writer.writeUint(filesCount, filesCountBytes);
    writer.writeUint(totalFilesSize, totalFilesSizeBytes, sent, written);
    registered?.();
  });
}

export const filesListHeader = Object.assign(buildFilesListHeader, {
  empty: buildFilesListHeader(0, 0),
});
