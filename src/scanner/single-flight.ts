export interface SingleFlightGroup<T> {
  do: (key: string, fn: () => Promise<T>) => Promise<T>;
  isInFlight: (key: string) => boolean;
}

export function createSingleFlight<T>(): SingleFlightGroup<T> {
  const inFlight = new Map<string, Promise<T>>();

  async function execute(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = fn().finally(() => {
      inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
  }

  function isInFlight(key: string): boolean {
    return inFlight.has(key);
  }

  return { do: execute, isInFlight };
}
