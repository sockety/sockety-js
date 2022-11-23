import { Buffer } from 'node:buffer';
import { generateUuid, UUID } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from './ContentProducer';
import { Request, REQUEST_DONE } from './Request';
import { RequestStream } from './RequestStream';
import { data } from './slices/data';
import { dataSize } from './slices/dataSize';
import { attachStream } from './slices/attachStream';
import { filesListHeader } from './slices/filesListHeader';
import { filesList } from './slices/filesList';
import { pipe } from './slices/pipe';
import { endStream } from './slices/endStream';
import { parallel } from './slices/parallel';
import { none } from './slices/none';
import { responseStart } from './slices/responseStart';
import { CREATE_PRODUCER_SLICE, FileTransfer } from './FileTransfer';

export interface CreateResponseOptions {
  data?: Buffer | string;
  files?: FileTransfer[];
}

// TODO: Validate provided data? Or on receive?
export function createResponse<T extends boolean>({
  data: rawData,
  files,
}: CreateResponseOptions, hasStream: T): (parentId: UUID) => ContentProducer<Request<T>> {
  // Compute data details
  const dataLength = rawData?.length || 0;
  const dataSlice = data(rawData);
  const dataSizeSlice = dataSize(dataLength);

  // Compute files details
  const filesCount = files?.length || 0;
  // @ts-ignore: avoid checks for better performance
  const totalFilesSize = files?.reduce((acc, file) => acc + (file.size ?? file.buffer.length), 0) || 0;

  const filesSpecSlice = filesListHeader(filesCount, totalFilesSize);
  const filesListSlice = filesList(files);

  // Compute response start information
  const responseStartSliceInitial = responseStart(hasStream)(dataLength, filesCount, totalFilesSize);

  // Write/schedule files
  // TODO: For 0-size, it should be optional
  // TODO: Max concurrency?
  const filesSlices = files ? files.map((file, index) => file[CREATE_PRODUCER_SLICE](index)) : [];

  // Build response producer
  return (parentId) => {
    const responseStartSlice = responseStartSliceInitial(parentId);
    return createContentProducer((writer, sent, written, expectsResponse) => {
      const id = generateUuid();
      const stream = hasStream && expectsResponse ? new RequestStream(writer) : null;
      const request = new Request(id, stream);

      // TODO: Think about "Abort" on "Revoke"
      writer.reserveChannel((channelId, release) => {
        pipe([
          responseStartSlice(id, expectsResponse),
          dataSizeSlice,
          filesSpecSlice,
          filesListSlice,
          hasStream && !stream ? endStream : none,
          parallel([
            dataSlice,
            attachStream(stream),
            ...filesSlices,
          ]),
        ])(writer, channelId, (error: Error | null | undefined) => {
          sent(error);
          request[REQUEST_DONE](error);
        }, written, release);
      });

      return request;
    });
  }
}
