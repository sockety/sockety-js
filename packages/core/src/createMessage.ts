import { Buffer } from 'node:buffer';
import { generateUuid } from '@sockety/uuid';
import { createContentProducer, ContentProducer } from './ContentProducer';
import { Request, REQUEST_DONE } from './Request';
import { RequestStream } from './RequestStream';
import { action } from './slices/action';
import { data } from './slices/data';
import { messageStart } from './slices/messageStart';
import { dataSize } from './slices/dataSize';
import { attachStream } from './slices/attachStream';
import { filesListHeader } from './slices/filesListHeader';
import { filesList } from './slices/filesList';
import { pipe } from './slices/pipe';
import { endStream } from './slices/endStream';
import { parallel } from './slices/parallel';
import { none } from './slices/none';
import { CREATE_PRODUCER_SLICE, FileTransfer } from './FileTransfer';

export interface CreateMessageOptions {
  action: string;
  data?: Buffer;
  files?: FileTransfer[];
}

// TODO: Validate provided data? Or on receive?
export function createMessage<T extends boolean>({
  action: actionName,
  data: rawData,
  files,
}: CreateMessageOptions, hasStream: T): ContentProducer<Request<T>> {
  // Compute action information
  const actionLength = Buffer.byteLength(actionName);
  const actionSlice = action(actionName);

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

  // Compute message start information
  const messageStartSlice = messageStart(hasStream, actionLength)(dataLength, filesCount, totalFilesSize);

  // Write/schedule files
  // TODO: For 0-size, it should be optional
  // TODO: Max concurrency?
  const filesSlices = files ? files.map((file, index) => file[CREATE_PRODUCER_SLICE](index)) : [];

  // Build message producer
  return createContentProducer((writer, sent, written, expectsResponse) => {
    const id = generateUuid();
    const stream = hasStream && expectsResponse ? new RequestStream(writer) : null;
    const request = new Request(id, stream);

    // TODO: Think about "Abort" on "Revoke"
    writer.reserveChannel((channelId, release) => {
      pipe([
        messageStartSlice(id, expectsResponse),
        actionSlice,
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
