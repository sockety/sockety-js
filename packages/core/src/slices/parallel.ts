import { ContentProducerSlice, createContentProducerSlice } from '../ContentProducer';
import { noop } from '../noop';
import { none } from './none';

type Callback = () => void;
type ErrorCallback = (error: Error | null | undefined) => void;

function createSentCallback(left: number, callback: ErrorCallback | undefined): ErrorCallback {
  if (callback == null) {
    return noop;
  }
  return (error: Error | null | undefined) => {
    if (error == null) {
      left--;
      if (left === 0) {
        callback(null);
      }
    } else {
      left = 0;
      callback(error);
    }
  };
}

function createCallback(left: number, callback: Callback | undefined): Callback {
  if (callback == null) {
    return noop;
  }
  return () => {
    left--;
    if (left === 0) {
      callback();
    }
  };
}

// TODO: Consider storing them as LinkedList
// TODO: Consider draining each step
// TODO: Think if shouldn't there be error handler on each step
export const parallel = (slices: ContentProducerSlice[], concurrency = Infinity) => {
  const total = slices.length;
  if (total === 0 || !slices.some((x) => x !== none)) {
    return none;
  } else if (total === 1) {
    return slices[0];
  }
  if (concurrency >= total) {
    return createContentProducerSlice((writer, channel, sent, registered) => {
      const sentOne = createSentCallback(total, sent);
      const registeredOne = createCallback(total, registered);

      for (let i = 0; i < total; i++) {
        slices[i](writer, channel, sentOne, registeredOne);
      }
    });
  } else {
    throw new Error('Not implemented yet');
  }
}
