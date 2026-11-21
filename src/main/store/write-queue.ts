import { NewEvent } from './schema';
import { EventsRepo } from './events-repo';
import { logger } from '../../shared/logger';

export interface WriteQueue {
  push: (event: NewEvent) => void;
  flush: () => Promise<void>;
  size: () => number;
}

export function createWriteBehindQueue(
  primaryRepo: EventsRepo,
  fallbackRepo: EventsRepo,
  maxQueueSize = 1000
): WriteQueue {
  const queue: NewEvent[] = [];
  let isFlushing = false;

  async function flush(): Promise<void> {
    if (isFlushing || queue.length === 0) return;
    isFlushing = true;

    try {
      while (queue.length > 0) {
        const item = queue[0];
        try {
          const health = await primaryRepo.health();
          if (health === 'up') {
            await primaryRepo.insert(item);
          } else {
            await fallbackRepo.insert(item);
          }
          queue.shift(); // Remove successfully processed item
        } catch (err) {
          logger.warn('Failed to insert into primary store, fallback to memory store:', err);
          await fallbackRepo.insert(item);
          queue.shift();
        }
      }
    } finally {
      isFlushing = false;
    }
  }

  function push(event: NewEvent): void {
    if (queue.length >= maxQueueSize) {
      // Drop oldest if bounded queue saturates
      queue.shift();
      logger.warn('Write-behind queue full, dropped oldest event');
    }
    queue.push(event);

    // Trigger async background flush without awaiting
    setTimeout(() => {
      flush().catch((err) => logger.error('Write-behind queue flush error:', err));
    }, 0);
  }

  return {
    push,
    flush,
    size: () => queue.length
  };
}
