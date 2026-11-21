export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerInstance {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  child: (subPrefix: string) => LoggerInstance;
}

function formatLog(prefix: string, level: LogLevel, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${prefix}] [${level.toUpperCase()}]: ${message}`;
}

export function createLogger(prefix = 'WalledGuard'): LoggerInstance {
  return {
    debug(message: string, ...args: unknown[]): void {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(formatLog(prefix, 'debug', message), ...args);
      }
    },
    info(message: string, ...args: unknown[]): void {
      console.info(formatLog(prefix, 'info', message), ...args);
    },
    warn(message: string, ...args: unknown[]): void {
      console.warn(formatLog(prefix, 'warn', message), ...args);
    },
    error(message: string, ...args: unknown[]): void {
      console.error(formatLog(prefix, 'error', message), ...args);
    },
    child(subPrefix: string): LoggerInstance {
      return createLogger(`${prefix}:${subPrefix}`);
    }
  };
}

export const logger = createLogger();
