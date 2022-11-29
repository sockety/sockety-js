import { ContentProducerSlice, createContentProducerSlice } from '../ContentProducer';
import { none } from './none';

// TODO: Consider storing them as LinkedList
// TODO: Consider draining each step
// TODO: Think if shouldn't there be error handler on each step
export const pipe = (slices: ContentProducerSlice[]) => {
  const end = slices.length - 1;
  if (end === -1) {
    return none;
  }
  return createContentProducerSlice((writer, channel, sent, registered) => {
    let index = 0;
    const next = () => {
      let slice = slices[index];
      while (slice === none && index !== end) {
        slice = slices[++index];
      }
      if (index === end) {
        slice(writer, channel, sent, registered);
      } else {
        index++;
        slice(writer, channel, undefined, next);
      }
    };
    next();
  });
}
