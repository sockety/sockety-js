import { createMessageProducer, MessageProducer } from '../MessageProducer';

function seriesWithResults<T extends MessageProducer[]>(producers: T): MessageProducer<any[]> {
  const length = producers.length;
  if (length === 0) {
    return createMessageProducer((writer, expectsResponse, callback) => process.nextTick(() => callback(null, [])));
  }

  return createMessageProducer((writer, expectsResponse, callback) => {
    let index = 0;
    const results: any[] = [];
    const next = (error: Error | null | undefined, message?: T) => {
      if (error != null) {
        return callback(error);
      }
      results.push(message!);
      index++;
      if (index === length) {
        return callback(null, results);
      }
      producers[index](writer, expectsResponse, next);
    };
    producers[0](writer, expectsResponse, next);
  });
}

function seriesVoid(producers: MessageProducer[]): MessageProducer<void> {
  const length = producers.length;
  if (length === 0) {
    return createMessageProducer((writer, expectsResponse, callback) => process.nextTick(() => callback(null)));
  }

  return createMessageProducer((writer, expectsResponse, callback) => {
    let index = 0;
    const next = (error: Error | null | undefined) => {
      if (error != null) {
        return callback(error);
      }
      index++;
      if (index === length) {
        return callback(null);
      }
      producers[index](writer, false, next);
    };
    producers[0](writer, false, next);
  });
}

export const series = Object.assign(seriesWithResults, { void: seriesVoid });
