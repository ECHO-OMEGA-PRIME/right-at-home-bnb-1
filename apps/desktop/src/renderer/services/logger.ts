/**
 * Right at Home BnB - Logging Service
 * Structured logging with rotation and persistence
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
  userId?: string;
  sessionId?: string;
}

export interface LogConfig {
  level: LogLevel;
  maxEntries: number;
  persistLogs: boolean;
  consoleOutput: boolean;
  categories: {
    [key: string]: LogLevel;
  };
}

class Logger {
  private config: LogConfig = {
    level: 'info',
    maxEntries: 10000,
    persistLogs: true,
    consoleOutput: true,
    categories: {},
  };

  private logs: LogEntry[] = [];
  private sessionId: string;
  private userId: string | null = null;

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadConfig();
    this.loadLogs();

    // Set up error handlers
    this.setupErrorHandlers();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private async loadConfig(): Promise<void> {
    try {
      const stored = await window.electronAPI.store.get<LogConfig>('logConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      console.error('[Logger] Failed to load config:', error);
    }
  }

  private async loadLogs(): Promise<void> {
    try {
      const stored = await window.electronAPI.store.get<LogEntry[]>('logs');
      if (stored) {
        this.logs = stored;
      }
    } catch (error) {
      console.error('[Logger] Failed to load logs:', error);
    }
  }

  private async saveLogs(): Promise<void> {
    if (!this.config.persistLogs) return;

    try {
      // Trim logs if necessary
      while (this.logs.length > this.config.maxEntries) {
        this.logs.shift();
      }
      await window.electronAPI.store.set('logs', this.logs);
    } catch (error) {
      console.error('[Logger] Failed to save logs:', error);
    }
  }

  private setupErrorHandlers(): void {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('UNHANDLED_ERROR', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('UNHANDLED_REJECTION', String(event.reason), {
        reason: event.reason,
      });
    });
  }

  setUserId(userId: string): void {
    this.userId = userId;
    this.info('SESSION', 'User ID set', { userId });
  }

  setConfig(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
    window.electronAPI.store.set('logConfig', this.config);
  }

  getConfig(): LogConfig {
    return { ...this.config };
  }

  private shouldLog(level: LogLevel, category: string): boolean {
    // Check category-specific level first
    const categoryLevel = this.config.categories[category];
    if (categoryLevel) {
      return this.levelPriority[level] >= this.levelPriority[categoryLevel];
    }

    // Fall back to global level
    return this.levelPriority[level] >= this.levelPriority[this.config.level];
  }

  private log(level: LogLevel, category: string, message: string, data?: unknown): void {
    if (!this.shouldLog(level, category)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      userId: this.userId || undefined,
      sessionId: this.sessionId,
    };

    this.logs.push(entry);

    // Console output
    if (this.config.consoleOutput) {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${category}]`;
      const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      if (data) {
        consoleMethod(prefix, message, data);
      } else {
        consoleMethod(prefix, message);
      }
    }

    // Debounced save
    this.debouncedSave();
  }

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveLogs();
    }, 1000);
  }

  // Public logging methods
  debug(category: string, message: string, data?: unknown): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: unknown): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: unknown): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: unknown): void {
    this.log('error', category, message, data);
  }

  // Specialized logging methods
  api(method: string, url: string, status: number, duration: number): void {
    this.info('API', `${method} ${url}`, { status, duration });
  }

  action(action: string, details?: unknown): void {
    this.info('ACTION', action, details);
  }

  navigation(from: string, to: string): void {
    this.info('NAVIGATION', `${from} -> ${to}`);
  }

  performance(metric: string, value: number, unit: string = 'ms'): void {
    this.debug('PERFORMANCE', `${metric}: ${value}${unit}`);
  }

  // Get logs with filtering
  getLogs(options?: {
    level?: LogLevel;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (options?.level) {
      const minPriority = this.levelPriority[options.level];
      filtered = filtered.filter((log) => this.levelPriority[log.level] >= minPriority);
    }

    if (options?.category) {
      filtered = filtered.filter((log) => log.category === options.category);
    }

    if (options?.startDate) {
      filtered = filtered.filter((log) => new Date(log.timestamp) >= options.startDate!);
    }

    if (options?.endDate) {
      filtered = filtered.filter((log) => new Date(log.timestamp) <= options.endDate!);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  // Get log statistics
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
    errors24h: number;
  } {
    const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    const byCategory: Record<string, number> = {};
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let errors24h = 0;

    this.logs.forEach((log) => {
      byLevel[log.level]++;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;

      if (log.level === 'error' && new Date(log.timestamp) >= yesterday) {
        errors24h++;
      }
    });

    return {
      total: this.logs.length,
      byLevel,
      byCategory,
      errors24h,
    };
  }

  // Export logs
  async exportLogs(format: 'json' | 'csv' = 'json'): Promise<{ success: boolean; path?: string }> {
    const result = await window.electronAPI.dialog.showSaveDialog({
      title: 'Export Logs',
      defaultPath: `rightathome-logs-${new Date().toISOString().split('T')[0]}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    let content: string;

    if (format === 'json') {
      content = JSON.stringify(this.logs, null, 2);
    } else {
      // CSV format
      const headers = ['timestamp', 'level', 'category', 'message', 'userId', 'sessionId'];
      const rows = this.logs.map((log) => [
        log.timestamp,
        log.level,
        log.category,
        `"${log.message.replace(/"/g, '""')}"`,
        log.userId || '',
        log.sessionId,
      ]);
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }

    const writeResult = await window.electronAPI.file.write(result.filePath, content);
    return { success: writeResult.success, path: result.filePath };
  }

  // Clear logs
  async clearLogs(beforeDate?: Date): Promise<void> {
    if (beforeDate) {
      this.logs = this.logs.filter((log) => new Date(log.timestamp) >= beforeDate);
    } else {
      this.logs = [];
    }
    await this.saveLogs();
    this.info('SYSTEM', 'Logs cleared', { beforeDate: beforeDate?.toISOString() });
  }
}

export const logger = new Logger();

// Convenience exports
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
