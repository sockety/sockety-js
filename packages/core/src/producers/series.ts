import { ContentProducer, createContentProducer } from '../ContentProducer';
import { none } from './none';

const noop = () => {};

export function series(...producers: ContentProducer[]): ContentProducer<void> {
  const total = producers.length;
  if (total === 0) {
    return none;
  }

  return createContentProducer<void>((writer, sent, registered, ) => {
    let index = 0;
    let finished = false;
    let left = total;

    // Mark as sent when failed or all has finished
    const finish = (error?: Error | null) => {
      if (finished) {
        return;
      }
      if (error != null) {
        sent(error);
        finished = true;
      } else {
        left--;
        if (left === 0) {
          sent(null);
        }
      }
    };

    // Write the next one
    const next = () => {
      const producer = producers[index];
      index++;

      // Something already went wrong
      if (finished) {
        return;
      }

      const sentCallback = index === total ? finish : noop;
      const registeredCallback = index === total ? registered : next;
      producer(writer, sentCallback, registeredCallback, false);
    };

    // Start
    next();
  });
}
