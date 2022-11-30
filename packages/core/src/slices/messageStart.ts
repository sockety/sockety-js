import { UUID } from '@sockety/uuid';
import { createContentProducerSlice } from '../ContentProducer';
import { createNumberBytesMapper } from '../createNumberBytesMapper';
import {
  MessageActionSizeBits,
  MessageDataSizeBits,
  MessageFilesCountBits,
  MessageFilesSizeBits
} from '../constants';

const getTotalFilesSizeFlag = createNumberBytesMapper('total files size', {
  2: MessageFilesSizeBits.Uint16,
  3: MessageFilesSizeBits.Uint24,
  4: MessageFilesSizeBits.Uint32,
  6: MessageFilesSizeBits.Uint48,
});

const getFilesCountFlag = createNumberBytesMapper('files count', {
  0: MessageFilesCountBits.None,
  1: MessageFilesCountBits.Uint8,
  2: MessageFilesCountBits.Uint16,
  3: MessageFilesCountBits.Uint24,
});

const getDataFlag = createNumberBytesMapper('data', {
  0: MessageDataSizeBits.None,
  1: MessageDataSizeBits.Uint8,
  2: MessageDataSizeBits.Uint16,
  6: MessageDataSizeBits.Uint48,
});

const getActionNameFlag = createNumberBytesMapper('action name', {
  1: MessageActionSizeBits.Uint8,
  2: MessageActionSizeBits.Uint16,
});

export const messageStart = (hasStream: boolean, actionLength: number) => {
  const actionSizeBits = getActionNameFlag(actionLength);

  return (dataLength: number, filesCount: number, totalFilesSize: number) => {
    const filesCountBits = getFilesCountFlag(filesCount);
    const filesSizeBits = getTotalFilesSizeFlag(totalFilesSize);
    const dataSizeBits = getDataFlag(dataLength);
    const flags = filesCountBits | filesSizeBits | dataSizeBits | actionSizeBits;

    return (id: UUID, expectsResponse: boolean) => {
      return createContentProducerSlice((writer, sent, registered, channel) => {
        writer.channel(channel);
        writer.startMessage(expectsResponse, hasStream);
        writer.writeUint8(flags);
        writer.writeUuid(id, sent);
        registered();
      });
    }
  }
}
