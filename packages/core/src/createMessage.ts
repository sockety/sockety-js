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

// TODO: Extract type
type FileSent = { name: string, buffer: Buffer } | { name: string, size: number, stream: Readable };

export interface CreateMessageOptions {
  action: string;
  data?: Buffer;
  files?: FileSent[];
}

// TODO: Extract type
function getFileHeaderSize(file: FileSent): number {
  const nameLength = Buffer.byteLength(file.name);
  // TODO: Fail when it's over uint24/uint48
  const nameSize = nameLength > 0xff ? 2 : 1;
  // @ts-ignore: ignore types for optimization
  const size = file.size ?? file.buffer.length;
  const sizeSize = size > 0xffffff ? 6 : size > 0xffff ? 3 : size > 0xff ? 2 : 1;
  return 1 + sizeSize + nameSize + nameLength;
}

function writeFileHeader(buffer: Buffer, offset: number, file: FileSent): number {
  const name = file.name;
  const nameLength = Buffer.byteLength(name);
  const nameBits = nameLength > 0xff ? FileNameSizeBits.Uint16 : FileNameSizeBits.Uint8;
  // @ts-ignore: ignore types for optimization
  const size = file.size ?? file.buffer.length;
  const sizeBits = size > 0xffffff ? FileSizeBits.Uint48 : size > 0xffff ? FileSizeBits.Uint24 : size > 0xff ? FileSizeBits.Uint16 : FileSizeBits.Uint8;

  // Write header
  buffer[offset++] = sizeBits | nameBits;

  // Write file size
  if (sizeBits === FileSizeBits.Uint48) {
    buffer.writeUintLE(size, offset, 6);
    offset += 6;
  } else if (sizeBits === FileSizeBits.Uint24) {
    buffer.writeUintLE(size, offset, 3);
    offset += 3;
  } else if (sizeBits === FileSizeBits.Uint16) {
    buffer.writeUint16LE(size, offset);
    offset += 2;
  } else {
    buffer[offset++] = size;
  }

  // Write name size
  if (nameBits === FileNameSizeBits.Uint16) {
    buffer.writeUint16LE(nameLength, offset);
    offset += 2;
  } else {
    buffer[offset++] = nameLength;
  }

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
  const actionLengthSize = actionLength > 0xff ? 2 : 1;
  const actionBufferLength = actionLengthSize + actionLength;
  const actionBuffer = Buffer.allocUnsafeSlow(actionBufferLength);
  if (actionLengthSize === 1) {
    actionBuffer[0] = actionLength;
    actionBuffer.write(action, 1);
  } else {
    actionBuffer.writeUint16LE(actionLength);
    actionBuffer.write(action, 2);
  }

  // Compute payload details
  // TODO: Fail when uint48 is too low
  const payloadLength = data?.length || 0;
  const payloadSizeLength = payloadLength > 0xffff ? 6 : payloadLength > 0xff ? 2 : payloadLength > 0 ? 1 : 0;
  const payloadSizeBuffer = Buffer.allocUnsafeSlow(payloadSizeLength);
  if (payloadSizeLength === 6) {
    payloadSizeBuffer.writeUintLE(payloadLength, 0, 6);
  } else if (payloadSizeLength === 2) {
    payloadSizeBuffer.writeUint16LE(payloadLength);
  } else if (payloadSizeLength === 1) {
    payloadSizeBuffer[0] = payloadLength;
  }

  // Compute files details
  // TODO: Fail when uint24 / uint48 is too low
  const filesCount = files?.length || 0;
  const filesCountLength = filesCount > 0xffff ? 3 : filesCount > 0xff ? 2 : filesCount > 0 ? 1 : 0;
  // @ts-ignore: avoid checks for better performance
  const totalFilesSize = files?.reduce((acc, file) => acc + (file.size ?? file.buffer.length), 0) || 0;
  const totalFilesSizeLength = filesCount === 0 ? 0 : totalFilesSize > 0xffffffff ? 6 : totalFilesSize > 0xffffff ? 4 : totalFilesSize > 0xffff ? 3 : totalFilesSize > 0 ? 2 : 0;

  const filesSpecBuffer = Buffer.allocUnsafeSlow(filesCountLength + totalFilesSizeLength);
  if (filesCountLength === 3) {
    filesSpecBuffer.writeUintLE(filesCount, 0, 3);
  } else if (filesCountLength === 2) {
    filesSpecBuffer.writeUint16LE(filesCount);
  } else if (filesCountLength === 1) {
    filesSpecBuffer[0] = filesCount;
  }
  if (totalFilesSizeLength === 6) {
    filesSpecBuffer.writeUintLE(totalFilesSize, filesCountLength, 6);
  } else if (totalFilesSizeLength === 4) {
    filesSpecBuffer.writeUint32LE(totalFilesSize, filesCountLength);
  } else if (totalFilesSizeLength === 3) {
    filesSpecBuffer.writeUintLE(totalFilesSize, filesCountLength, 3);
  } else if (totalFilesSizeLength === 2) {
    filesSpecBuffer.writeUint16LE(totalFilesSize, filesCountLength);
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
  const filesCountBits = filesCountLength === 3
    ? MessageFilesCountBits.Uint24
    : filesCountLength === 2
      ? MessageFilesCountBits.Uint16
      : filesCountLength === 1 ? MessageFilesCountBits.Uint8 : MessageFilesCountBits.None;
  const filesSizeBits = totalFilesSizeLength === 6
    ? MessageFilesSizeBits.Uint48
    : totalFilesSizeLength === 4
      ? MessageFilesSizeBits.Uint32
      : totalFilesSizeLength === 3 ? MessageFilesSizeBits.Uint24 : MessageFilesSizeBits.Uint16;
  const dataSizeBits = payloadSizeLength === 6
    ? MessageDataSizeBits.Uint48
    : payloadSizeLength === 2
      ? MessageDataSizeBits.Uint16
      : payloadSizeLength === 1 ? MessageDataSizeBits.Uint8 : MessageDataSizeBits.None;
  const actionSizeBits = actionLengthSize === 1 ? MessageActionSizeBits.Uint8 : MessageActionSizeBits.Uint16;
  const flags = filesCountBits | filesSizeBits | dataSizeBits | actionSizeBits;

  // Compute message size
  // Flags (1B) + UUID (16B) + Action size and name (dynamic) + Payload size (0-6B) + Files count size (0-3B) + Total file size (0-6B)
  const messageLength = 1 + 16 + actionBufferLength + payloadSizeLength + filesCountLength + totalFilesSizeLength + filesHeaderSize;
  // Channel (0-2B) + Header (1B) + Message length + Payload header (0-1B) + Payload length
  const packetLength = 2 + 1 + messageLength;

  // Build message producer
  return createContentProducer((writer, expectsResponse, _callback) => {
    // console.log('ABL', actionBufferLength, actionBuffer);
    // console.log('PSL', payloadSizeLength, payloadSizeBuffer);
    // console.log('PL', payloadLength, data);
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
      const inlinedPayloadLength = (payloadLength > 0 ? 1 : 0) + (writer.shouldInlineBuffer(payloadLength) ? payloadLength : 0);
      const inlinedLength = packetLength + inlinedPayloadLength;

      // Notify about expected message size for pool optimization
      writer.notifyLength(inlinedLength);

      // Write message header
      writer.ensureChannel(channelId);
      writer.writeMessageSignature(messageLength, hasStream, expectsResponse);

      // Write basic data
      writer.writeUint8(flags);
      writer.writeUuid(id);
      writer.write(actionBuffer);

      // Write payload size
      if (payloadLength !== 0) {
        writer.write(payloadSizeBuffer);
      }

      // Write files header
      // TODO: Drain?
      // TODO: Split with "CONTINUE"?
      if (filesCount > 0) {
        writer.write(filesSpecBuffer);
        writer.write(filesHeaderBuffer);
      }

      // Write payload
      // TODO: Drain?
      // TODO: Support splitting for >4GB
      if (payloadLength !== 0) {
        writer.writeDataSignature(payloadLength);
        writer.write(data!);
      }

      // Create outgoing message
      if (hasStream) {
        if (expectsResponse) {
          writer.addListener((error) => {
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
          writer.writeStreamEnd(channelId, callback);
          release();
        }
      } else {
        writer.addListener((error) => {
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
          const size = file.buffer.length;
          const sizeBits = size > 0xffffff ? FileSizeBits.Uint48 : size > 0xffff ? FileSizeBits.Uint24 : size > 0xff ? FileSizeBits.Uint16 : FileSizeBits.Uint8;
          const indexBits = index > 0xffff ? FileIndexBits.Uint24 : index > 0xff ? FileIndexBits.Uint16 : FileIndexBits.Uint8;

          // TODO: Ensure length?

          // Write File packet header
          writer.writeUint8(PacketTypeBits.File | sizeBits | indexBits);

          // Write file index
          if (indexBits === FileIndexBits.Uint24) {
            writer.writeUint24(index);
          } else if (indexBits === FileIndexBits.Uint16) {
            writer.writeUint16(index);
          } else {
            writer.writeUint8(index);
          }

          // Write file size
          if (sizeBits === FileSizeBits.Uint48) {
            writer.writeUint48(size);
          } else if (sizeBits === FileSizeBits.Uint24) {
            writer.writeUint24(size);
          } else if (sizeBits === FileSizeBits.Uint16) {
            writer.writeUint16(size);
          } else {
            writer.writeUint8(size);
          }

          // Write file
          // TODO: Support splitting for >4GB
          writer.write(file.buffer);

          // Write FileEnd packet
          writer.writeUint8(PacketTypeBits.FileEnd | indexBits);
          if (indexBits === FileIndexBits.Uint24) {
            writer.writeUint24(index);
          } else if (indexBits === FileIndexBits.Uint16) {
            writer.writeUint16(index);
          } else {
            writer.writeUint8(index);
          }

          filesLeft--;
          if (filesLeft === 0) {
            filesComplete = true;
            release();
            writer.addListener((error) => {
              filesSent = true;
              callback(error, message);
            });
          }
        } else {
          const indexBits = index > 0xffff ? FileIndexBits.Uint24 : index > 0xff ? FileIndexBits.Uint16 : FileIndexBits.Uint8;

          // TODO: Abort when it's aborted/closed
          file.stream.on('data', (data) => {
            const size = data.length;
            const sizeBits = size > 0xffffff ? FileSizeBits.Uint48 : size > 0xffff ? FileSizeBits.Uint24 : size > 0xff ? FileSizeBits.Uint16 : FileSizeBits.Uint8;

            // TODO: Ensure length?
            writer.ensureChannel(channelId);

            // Write File packet header
            writer.writeUint8(PacketTypeBits.File | sizeBits | indexBits);

            // Write file index
            if (indexBits === FileIndexBits.Uint24) {
              writer.writeUint24(index);
            } else if (indexBits === FileIndexBits.Uint16) {
              writer.writeUint16(index);
            } else {
              writer.writeUint8(index);
            }

            // Write file size
            if (sizeBits === FileSizeBits.Uint48) {
              writer.writeUint48(size);
            } else if (sizeBits === FileSizeBits.Uint24) {
              writer.writeUint24(size);
            } else if (sizeBits === FileSizeBits.Uint16) {
              writer.writeUint16(size);
            } else {
              writer.writeUint8(size);
            }

            // Write file
            // TODO: Support splitting for >4GB
            writer.write(data);
          });
          file.stream.on('end', () => {
            writer.ensureChannel(channelId);
            // Write FileEnd packet
            writer.writeUint8(PacketTypeBits.FileEnd | indexBits);
            if (indexBits === FileIndexBits.Uint24) {
              writer.writeUint24(index);
            } else if (indexBits === FileIndexBits.Uint16) {
              writer.writeUint16(index);
            } else {
              writer.writeUint8(index);
            }

            filesLeft--;
            if (filesLeft === 0) {
              filesComplete = true;
              release();
              writer.addListener((error) => {
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
