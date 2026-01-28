/**
 * Right at Home BnB - Logging Service
 * Comprehensive logging with levels, context, and structured output
 *
 * @packageDocumentation
 * @module @rightathome/services/logger
 */

// ============================================
// TYPES
// ============================================

/** Log levels in order of severity */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured log entry */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  requestId?: string;
  userId?: string;
  duration?: number;
}

/** Logger configuration */
export interface LoggerConfig {
  /** Minimum level to log */
  level: LogLevel;
  /** Context name (e.g., "API", "Database", "Auth") */
  context?: string;
  /** Whether to include timestamps */
  timestamps?: boolean;
  /** Whether to output as JSON */
  json?: boolean;
  /** Custom log handler */
  handler?: (entry: LogEntry) => void;
  /** Whether logging is enabled */
  enabled?: boolean;
}

/** Log level severity mapping */
const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================
// LOGGER CLASS
// ============================================

/**
 * Production-ready logger with support for multiple levels,
 * context tracking, structured logging, and performance timing.
 *
 * @example
 * ```typescript
 * const logger = new Logger({ level: 'info', context: 'API' });
 * logger.info('Request received', { path: '/bookings' });
 * logger.error('Database error', { error: new Error('Connection failed') });
 * ```
 */
export class Logger {
  private config: Required<LoggerConfig>;
  private childContext?: string;
  private requestId?: string;
  private userId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      context: config.context ?? 'App',
      timestamps: config.timestamps ?? true,
      json: config.json ?? (process.env.NODE_ENV === 'production'),
      handler: config.handler ?? this.defaultHandler.bind(this),
      enabled: config.enabled ?? true,
    };
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Create a child logger with additional context
   * @param context - Additional context to prepend
   * @returns New logger instance with combined context
   */
  child(context: string): Logger {
    const childLogger = new Logger(this.config);
    childLogger.childContext = this.childContext
      ? `${this.childContext}:${context}`
      : context;
    childLogger.requestId = this.requestId;
    childLogger.userId = this.userId;
    return childLogger;
  }

  /**
   * Set request ID for correlation
   * @param requestId - Unique request identifier
   */
  setRequestId(requestId: string): this {
    this.requestId = requestId;
    return this;
  }

  /**
   * Set user ID for audit trail
   * @param userId - User identifier
   */
  setUserId(userId: string): this {
    this.userId = userId;
    return this;
  }

  /**
   * Log at debug level - detailed information for debugging
   * @param message - Log message
   * @param data - Optional structured data
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * Log at info level - general operational information
   * @param message - Log message
   * @param data - Optional structured data
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Log at warn level - potential issues that don't stop operation
   * @param message - Log message
   * @param data - Optional structured data
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Log at error level - errors that need attention
   * @param message - Log message
   * @param errorOrData - Error object or structured data
   */
  error(message: string, errorOrData?: Error | Record<string, unknown>): void {
    if (errorOrData instanceof Error) {
      this.log('error', message, {
        error: {
          name: errorOrData.name,
          message: errorOrData.message,
          stack: errorOrData.stack,
        },
      });
    } else {
      this.log('error', message, errorOrData);
    }
  }

  /**
   * Time an async operation and log the duration
   * @param label - Operation label
   * @param fn - Async function to time
   * @returns Result of the function
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.debug(`${label} completed`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.error(`${label} failed`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Time a sync operation and log the duration
   * @param label - Operation label
   * @param fn - Function to time
   * @returns Result of the function
   */
  timeSync<T>(label: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = Math.round(performance.now() - start);
      this.debug(`${label} completed`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.error(`${label} failed`, {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create a performance timer that can be stopped later
   * @param label - Operation label
   * @returns Timer object with stop() method
   */
  startTimer(label: string): { stop: (data?: Record<string, unknown>) => number } {
    const start = performance.now();
    return {
      stop: (data?: Record<string, unknown>) => {
        const duration = Math.round(performance.now() - start);
        this.debug(`${label} completed`, { ...data, duration: `${duration}ms` });
        return duration;
      },
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.config.enabled) return;
    if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[this.config.level]) return;

    const entry: LogEntry = {
      timestamp: this.config.timestamps ? new Date().toISOString() : '',
      level,
      message,
      context: this.getFullContext(),
      requestId: this.requestId,
      userId: this.userId,
    };

    if (data) {
      if ('error' in data && typeof data.error === 'object' && data.error !== null) {
        entry.error = data.error as LogEntry['error'];
        const { error, ...rest } = data;
        if (Object.keys(rest).length > 0) {
          entry.data = rest;
        }
      } else {
        entry.data = data;
      }
    }

    this.config.handler(entry);
  }

  private getFullContext(): string {
    if (this.childContext) {
      return `${this.config.context}:${this.childContext}`;
    }
    return this.config.context;
  }

  private defaultHandler(entry: LogEntry): void {
    if (this.config.json) {
      const jsonEntry = {
        ...entry,
        timestamp: entry.timestamp || undefined,
      };
      // Clean up empty values
      Object.keys(jsonEntry).forEach((key) => {
        if (jsonEntry[key as keyof typeof jsonEntry] === undefined) {
          delete jsonEntry[key as keyof typeof jsonEntry];
        }
      });
      console.log(JSON.stringify(jsonEntry));
    } else {
      this.prettyPrint(entry);
    }
  }

  private prettyPrint(entry: LogEntry): void {
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[90m', // gray
      info: '\x1b[36m', // cyan
      warn: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    const color = levelColors[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const timestamp = entry.timestamp ? `${entry.timestamp} ` : '';
    const context = entry.context ? `[${entry.context}] ` : '';
    const requestId = entry.requestId ? `(${entry.requestId}) ` : '';

    let output = `${timestamp}${color}${bold}${levelStr}${reset} ${context}${requestId}${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      output += ` ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      output += `\n  ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n${entry.error.stack.split('\n').slice(1).join('\n')}`;
      }
    }

    switch (entry.level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

/**
 * Default logger instance for quick use
 *
 * @example
 * ```typescript
 * import { logger } from '@rightathome/services/logger';
 * logger.info('Application started');
 * ```
 */
export const logger = new Logger({
  context: 'RightAtHome',
});

// ============================================
// SPECIALIZED LOGGERS
// ============================================

/**
 * Pre-configured loggers for common contexts
 */
export const loggers = {
  /** Database operations logger */
  db: new Logger({ context: 'Database' }),
  /** API/HTTP logger */
  api: new Logger({ context: 'API' }),
  /** Authentication logger */
  auth: new Logger({ context: 'Auth' }),
  /** Booking operations logger */
  booking: new Logger({ context: 'Booking' }),
  /** Cleaning operations logger */
  cleaning: new Logger({ context: 'Cleaning' }),
  /** Smart lock operations logger */
  lock: new Logger({ context: 'SmartLock' }),
  /** Messaging logger */
  messaging: new Logger({ context: 'Messaging' }),
  /** Finance logger */
  finance: new Logger({ context: 'Finance' }),
  /** AI/Concierge logger */
  concierge: new Logger({ context: 'Concierge' }),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a request-scoped logger for API handlers
 * @param requestId - Unique request ID
 * @param userId - Optional user ID
 * @returns Configured logger instance
 */
export function createRequestLogger(requestId: string, userId?: string): Logger {
  const reqLogger = new Logger({ context: 'Request' });
  reqLogger.setRequestId(requestId);
  if (userId) {
    reqLogger.setUserId(userId);
  }
  return reqLogger;
}

/**
 * Generate a unique request ID
 * @returns Unique request ID string
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${randomPart}`;
}
