import dotenv from 'dotenv';
import { EventsRepo } from './events-repo';
import { createPgEventsRepo } from './pg-events-repo';
import { createMemoryEventsRepo } from './memory-events-repo';
import { createWriteBehindQueue, WriteQueue } from './write-queue';
import { NewEvent } from './schema';
import { logger } from '../../shared/logger';

dotenv.config();

let primaryRepo: EventsRepo | null = null;
let memoryFallbackRepo: EventsRepo | null = null;
let writeQueue: WriteQueue | null = null;
let isPgUp = false;

export function initStore(): EventsRepo {
  if (!memoryFallbackRepo) {
    memoryFallbackRepo = createMemoryEventsRepo();
  }

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      primaryRepo = createPgEventsRepo(dbUrl);
      writeQueue = createWriteBehindQueue(primaryRepo, memoryFallbackRepo);

      // Async check health
      primaryRepo.health().then((h) => {
        isPgUp = h === 'up';
        logger.info(`Postgres health check: ${h}`);
      }).catch(() => {
        isPgUp = false;
      });

      return primaryRepo;
    } catch (err) {
      logger.warn('Failed to initialize PG repo, falling back to memory store:', err);
      primaryRepo = null;
      writeQueue = createWriteBehindQueue(memoryFallbackRepo, memoryFallbackRepo);
      return memoryFallbackRepo;
    }
  }

  logger.info('DATABASE_URL not set; using in-memory store for session');
  writeQueue = createWriteBehindQueue(memoryFallbackRepo, memoryFallbackRepo);
  return memoryFallbackRepo;
}

export function getEventsRepo(): EventsRepo {
  if (!memoryFallbackRepo) {
    initStore();
  }
  if (primaryRepo && (isPgUp || process.env.DATABASE_URL)) {
    return primaryRepo;
  }
  return memoryFallbackRepo!;
}

export function logEvent(event: NewEvent): void {
  if (!writeQueue) {
    initStore();
  }
  writeQueue!.push(event);
}

export async function checkDbHealth(): Promise<'up' | 'down'> {
  if (!primaryRepo && !memoryFallbackRepo) {
    initStore();
  }
  if (primaryRepo) {
    const status = await primaryRepo.health();
    isPgUp = status === 'up';
    return status;
  }
  return 'down';
}

export function getMemoryRepo(): EventsRepo {
  if (!memoryFallbackRepo) {
    memoryFallbackRepo = createMemoryEventsRepo();
  }
  return memoryFallbackRepo;
}
