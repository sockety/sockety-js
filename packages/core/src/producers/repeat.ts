import { createMessageProducer, MessageProducer } from '../MessageProducer';

function repeatWithResults<T>(producer: MessageProducer<T>, times: number): MessageProducer<T[]> {
  if (times < 1) {
    throw new Error('times should be greater than 0');
  }

  return createMessageProducer((writer, expectsResponse, callback) => {
    let left = times;
    const results: T[] = [];
    const next = (error: Error | null | undefined, message?: T) => {
      if (error != null) {
        return callback(error);
      }

      results.push(message!);
      left--;

      if (left === 0) {
        return callback(null, results);
      }
      producer(writer, expectsResponse, next);
    };
    producer(writer, expectsResponse, next);
  });
}

function repeatVoid(producer: MessageProducer, times: number): MessageProducer<void> {
  if (times < 1) {
    throw new Error('times should be greater than 0');
  }

  return createMessageProducer((writer, expectsResponse, callback) => {
    let left = times;
    const next = (error: Error | null | undefined) => {
      if (error != null) {
        return callback(error);
      }
      left--;
      if (left === 0) {
        return callback(null);
      }
      producer(writer, false, next);
    };
    producer(writer, false, next);
  });
}

export const repeat = Object.assign(repeatWithResults, { void: repeatVoid });
