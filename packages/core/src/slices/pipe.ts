import { ContentProducerSlice, createContentProducerSlice } from '../ContentProducer';
import { noop } from '../noop';
import { none } from './none';

// TODO: Consider storing them as LinkedList
// TODO: Consider draining each step
// TODO: Think if shouldn't there be error handler on each step
export function pipe(slices: ContentProducerSlice[]) {
  const end = slices.length - 1;
  if (end === -1) {
    return none;
  }
  return createContentProducerSlice((writer, sent, registered, channel) => {
    let index = 0;
    const next = () => {
      let slice = slices[index];
      while (slice === none && index !== end) {
        slice = slices[++index];
      }
      if (index === end) {
        slice(writer, sent, registered, channel);
      } else {
        index++;
        slice(writer, noop, next, channel);
      }
    };
    next();
  });
}
