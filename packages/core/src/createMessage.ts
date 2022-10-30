import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { generateUuid } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from './ContentProducer';
import { Request } from './Request';
import {
  FileIndexBits,
  FileNameSizeBits,
  FileSizeBits,
  MessageActionSizeBits,
  MessageDataSizeBits,
  MessageFilesCountBits,
  MessageFilesSizeBits,
  PacketTypeBits
} from './constants';
import { RequestStream } from './RequestStream';
import { createNumberBytesGetter } from './createNumberBytesGetter';
import { createNumberBytesMapper } from './createNumberBytesMapper';

// TODO: Extract type
type FileSent = { name: string, buffer: Buffer } | { name: string, size: number, stream: Readable };

export interface CreateMessageOptions {
  action: string;
  data?: Buffer;
  files?: FileSent[];
}

const getTotalFilesSizeBytes = createNumberBytesGetter('total files size', [ 2, 3, 4, 6 ]);
const getTotalFilesSizeFlag = createNumberBytesMapper('total files size', {
  2: MessageFilesSizeBits.Uint16,
  3: MessageFilesSizeBits.Uint24,
  4: MessageFilesSizeBits.Uint32,
  6: MessageFilesSizeBits.Uint48,
});

const getFilesCountBytes = createNumberBytesGetter('files count', [ 0, 1, 2, 3 ]);
const getFilesCountFlag = createNumberBytesMapper('files count', {
  0: MessageFilesCountBits.None,
  1: MessageFilesCountBits.Uint8,
  2: MessageFilesCountBits.Uint16,
  3: MessageFilesCountBits.Uint24,
});

const getDataBytes = createNumberBytesGetter('data', [ 0, 1, 2, 6 ]);
const getDataFlag = createNumberBytesMapper('data', {
  0: MessageDataSizeBits.None,
  1: MessageDataSizeBits.Uint8,
  2: MessageDataSizeBits.Uint16,
  6: MessageDataSizeBits.Uint48,
});

const getActionNameBytes = createNumberBytesGetter('action name', [ 1, 2 ]);
const getActionNameFlag = createNumberBytesMapper('action name', {
  1: MessageActionSizeBits.Uint8,
  2: MessageActionSizeBits.Uint16,
});

const getFileHeaderNameBytes = createNumberBytesGetter('file name', [ 1, 2 ]);
const getFileHeaderNameFlag = createNumberBytesMapper('file name', {
  1: FileNameSizeBits.Uint8,
  2: FileNameSizeBits.Uint16,
});

const getFileHeaderSizeBytes = createNumberBytesGetter('file size', [ 1, 2, 3, 6 ]);
const getFileHeaderSizeFlag = createNumberBytesMapper('file size', {
  1: FileSizeBits.Uint8,
  2: FileSizeBits.Uint16,
  3: FileSizeBits.Uint24,
  6: FileSizeBits.Uint48,
});

const getFileHeaderIndexBytes = createNumberBytesGetter('file index', [ 1, 2, 3, 6 ]);
const getFileHeaderIndexFlag = createNumberBytesMapper('file index', {
  // TODO: Consider 0 -> None, as there is empty slot anyway?
  1: FileIndexBits.Uint8,
  2: FileIndexBits.Uint16,
  3: FileIndexBits.Uint24,
});

// TODO: Extract type
function getFileHeaderSize(file: FileSent): number {
  const nameLength = Buffer.byteLength(file.name);
  const nameSize = getFileHeaderNameBytes(nameLength);
  // @ts-ignore: ignore types for optimization
  const size = file.size ?? file.buffer.length;
  const sizeSize = getFileHeaderSizeBytes(size);
  return 1 + sizeSize + nameSize + nameLength;
}

function writeFileHeader(buffer: Buffer, offset: number, file: FileSent): number {
  const name = file.name;
  const nameLength = Buffer.byteLength(name);
  const nameSize = getFileHeaderNameBytes(nameLength);
  const nameBits = getFileHeaderNameFlag(nameLength);
  // @ts-ignore: ignore types for optimization
  const size = file.size ?? file.buffer.length;
  const sizeSize = getFileHeaderSizeBytes(size);
  const sizeBits = getFileHeaderSizeFlag(size);

  // Write header
  buffer[offset++] = sizeBits | nameBits;

  // Write file size
  buffer.writeUintLE(size, offset, sizeSize);
  offset += sizeSize;

  // Write name size
  buffer.writeUintLE(nameLength, offset, nameSize);
  offset += nameSize;

  // Write name
  offset += buffer.write(name, offset);

  return offset;
}

// TODO: Validate provided data? Or on receive?
// TODO: Lazy compute for better initial performance?
// TODO: Extract all FLAG -> UINT calculations?
// TODO: Split to operations list
export function createMessage<T extends boolean>({
  action,
  data,
  files,
}: CreateMessageOptions, hasStream: T): ContentProducer<Request<T>> {
  // Compute action information
  const actionLength = Buffer.byteLength(action);
  const actionLengthSize = getActionNameBytes(actionLength);
  const actionBufferLength = actionLengthSize + actionLength;
  const actionBuffer = Buffer.allocUnsafeSlow(actionBufferLength);
  actionBuffer.writeUintLE(actionLength, 0, actionLengthSize);
  actionBuffer.write(action, actionLengthSize);

  // Compute data details
  const dataLength = data?.length || 0;
  const dataSizeLength = getDataBytes(dataLength);
  const dataSizeBuffer = Buffer.allocUnsafeSlow(dataSizeLength);
  if (dataSizeLength > 0) {
    dataSizeBuffer.writeUintLE(dataLength, 0, dataSizeLength);
  }

  // Compute files details
  const filesCount = files?.length || 0;
  const filesCountLength = getFilesCountBytes(filesCount);
  // @ts-ignore: avoid checks for better performance
  const totalFilesSize = files?.reduce((acc, file) => acc + (file.size ?? file.buffer.length), 0) || 0;
  const totalFilesSizeLength = filesCount === 0 ? 0 : getTotalFilesSizeBytes(totalFilesSize);

  const filesSpecBuffer = Buffer.allocUnsafeSlow(filesCountLength + totalFilesSizeLength);
  if (filesCountLength > 0) {
    filesSpecBuffer.writeUintLE(filesCount, 0, filesCountLength);
    filesSpecBuffer.writeUintLE(totalFilesSize, filesCountLength, totalFilesSizeLength);
  }

  // TODO: Return Request immediately
  // TODO: Consider doing it lazily?
  // @ts-ignore: avoid checks for better performance
  const filesHeaderSize = files?.reduce((acc, file) => acc + getFileHeaderSize(file), 0) || 0;
  const filesHeaderBuffer = Buffer.allocUnsafeSlow(filesHeaderSize);
  let offset = 0;
  for (const file of files || []) {
    offset = writeFileHeader(filesHeaderBuffer, offset, file);
  }

  // Compute flags
  const filesCountBits = getFilesCountFlag(filesCount);
  const filesSizeBits = getTotalFilesSizeFlag(totalFilesSize);
  const dataSizeBits = getDataFlag(dataLength);
  const actionSizeBits = getActionNameFlag(actionLength);
  const flags = filesCountBits | filesSizeBits | dataSizeBits | actionSizeBits;

  // Build message producer
  // TODO: Use second callback as *Complete
  return createContentProducer((writer, expectsResponse, _callback) => {
    // console.log('ABL', actionBufferLength, actionBuffer);
    // console.log('PSL', dataSizeLength, dataSizeBuffer);
    // console.log('PL', dataLength, data);
    // console.log('FC', filesCountLength);
    // console.log('TFS', totalFilesSizeLength, filesSpecBuffer);
    // console.log('FHS', filesHeaderSize, filesHeaderBuffer);
    // console.log('TOTAL', messageLength);

    // TODO: Think about "Abort" on "Revoke"
    writer.reserveChannel((channelId, _release) => writer.drained(() => {
      // State
      let message: any;
      let callbackCalled = false;
      let filesComplete = filesCount === 0;
      let filesSent = filesCount === 0;
      let streamComplete = !hasStream || !expectsResponse;
      const release = () => {
        if (filesComplete && streamComplete) {
          _release();
        }
      };
      const callback = (error: Error | null | undefined, message?: any) => {
        if (callbackCalled) {
          return;
        }
        if (error || (filesSent && filesSent)) {
          callbackCalled = true;
          _callback(error, message);
        }
      };

      // Compute
      const id = generateUuid();

      // Write message header
      writer.channel(channelId);
      writer.startMessage(expectsResponse, hasStream);

      // Write basic data
      writer.writeUint8(flags);
      writer.writeUuid(id);
      writer.writeBuffer(actionBuffer);

      // Write data size
      if (dataLength !== 0) {
        writer.writeBuffer(dataSizeBuffer);
      }

      // Write files header
      // TODO: Drain?
      // TODO: Split with "CONTINUE"?
      if (filesCount > 0) {
        writer.writeBuffer(filesSpecBuffer);
        writer.writeBuffer(filesHeaderBuffer);
      }

      // Write data
      // TODO: Drain?
      // TODO: Support splitting for >4GB
      if (dataLength !== 0) {
        writer.data();
        writer.writeBuffer(data!);
      }

      // Create outgoing message
      if (hasStream) {
        if (expectsResponse) {
          writer.addCallback((error) => {
            if (error != null) {
              callback(error);
              release();
            } else {
              const stream = new RequestStream(channelId, writer, () => {
                streamComplete = true;
                release();
              });
              message = new Request<true>(id, stream);
              callback(null, message as any);
            }
          });
        } else {
          writer.endStream(callback);
          release();
        }
      } else {
        writer.addCallback((error) => {
          if (error) {
            callback(error);
          } else if (expectsResponse) {
            message = new Request<false>(id, null);
            callback(null, message as any);
          } else {
            callback(null);
          }
        });
        release();
      }

      // Write/schedule files
      // TODO: For 0-size, it should be optional
      // TODO: Make it asynchronously (& drain & ensure channel)
      // TODO: Max concurrency?
      let filesLeft = filesCount;
      for (let index = 0; index < filesCount; index++) {
        // TODO: Support streams
        const file = files![index];
        // FIXME: 'in' performance
        if ('buffer' in file) {
          // Write File packet header
          writer.file(index);

          // Write file
          // TODO: Support splitting for >4GB
          writer.writeBuffer(file.buffer);

          // Write FileEnd packet
          writer.endFile(index);

          filesLeft--;
          if (filesLeft === 0) {
            filesComplete = true;
            release();
            writer.addCallback((error) => {
              filesSent = true;
              callback(error, message);
            });
          }
        } else {
          // TODO: Abort when it's aborted/closed
          file.stream.on('data', (data) => {
            writer.channel(channelId);

            // Write File packet header
            writer.file(index);

            // Write file
            // TODO: Support splitting for >4GB
            writer.writeBuffer(data);
          });
          file.stream.on('end', () => {
            writer.channel(channelId);
            // Write FileEnd packet
            writer.endFile(index);

            filesLeft--;
            if (filesLeft === 0) {
              filesComplete = true;
              release();
              writer.addCallback((error) => {
                filesSent = true;
                callback(error, message);
              });
            }
          });
        }
      }
    }));
  });
}
