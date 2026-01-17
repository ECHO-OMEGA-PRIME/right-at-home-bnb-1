/**
 * Right at Home BnB - Advanced Debug & Diagnostics System
 * =========================================================
 * Comprehensive logging, error tracking, and system diagnostics
 *
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Right at Home BnB
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: Record<string, unknown>;
  stack?: string;
}

interface SystemStatus {
  firebase: 'connected' | 'disconnected' | 'error' | 'unconfigured';
  elevenlabs: 'configured' | 'unconfigured';
  groq: 'configured' | 'unconfigured';
  sync: 'connected' | 'disconnected' | 'error';
  environment: 'development' | 'production' | 'preview';
}

// Global log buffer for debugging
const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER_SIZE = 500;

// Environment detection
const IS_BROWSER = typeof window !== 'undefined';
const IS_DEV = process.env.NODE_ENV === 'development';
const IS_VERCEL = process.env.VERCEL === '1';

/**
 * Advanced Logger with component tagging and structured data
 */
class DebugLogger {
  private component: string;
  private enabled: boolean;

  constructor(component: string) {
    this.component = component;
    this.enabled = IS_DEV || (IS_BROWSER && localStorage?.getItem('DEBUG_ENABLED') === 'true');
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      data,
      stack: error?.stack,
    };

    // Add to buffer
    LOG_BUFFER.push(entry);
    if (LOG_BUFFER.length > MAX_BUFFER_SIZE) {
      LOG_BUFFER.shift();
    }

    // Console output with styling
    if (this.enabled || level === 'error' || level === 'fatal') {
      const styles = {
        debug: 'color: #888',
        info: 'color: #0099ff',
        warn: 'color: #ff9900; font-weight: bold',
        error: 'color: #ff3333; font-weight: bold',
        fatal: 'color: #ff0000; font-weight: bold; text-decoration: underline',
      };

      const prefix = `[${this.component}]`;

      if (IS_BROWSER) {
        console.log(`%c${prefix} ${message}`, styles[level], data || '');
      } else {
        const levelTag = level.toUpperCase().padEnd(5);
        console.log(`[${entry.timestamp}] ${levelTag} ${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
      }

      if (error?.stack) {
        console.log('%cStack trace:', 'color: #ff6666', error.stack);
      }
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.log('error', message, { ...data, errorMessage: err.message }, err);
  }

  fatal(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.log('fatal', message, { ...data, errorMessage: err.message }, err);
  }

  // Time tracking
  private timers: Map<string, number> = new Map();

  time(label: string): void {
    this.timers.set(label, Date.now());
  }

  timeEnd(label: string): number {
    const start = this.timers.get(label);
    if (start) {
      const duration = Date.now() - start;
      this.timers.delete(label);
      this.debug(`Timer [${label}] completed`, { durationMs: duration });
      return duration;
    }
    return 0;
  }
}

/**
 * Create a logger for a specific component
 */
export function createLogger(component: string): DebugLogger {
  return new DebugLogger(component);
}

/**
 * Global system diagnostics
 */
export const Diagnostics = {
  /**
   * Get current system status
   */
  getStatus(): SystemStatus {
    return {
      firebase: this.checkFirebase(),
      elevenlabs: process.env.ELEVENLABS_API_KEY ? 'configured' : 'unconfigured',
      groq: process.env.GROQ_API_KEY ? 'configured' : 'unconfigured',
      sync: 'disconnected', // Will be updated by SyncProvider
      environment: IS_DEV ? 'development' : (IS_VERCEL ? (process.env.VERCEL_ENV as 'production' | 'preview') || 'production' : 'production'),
    };
  },

  /**
   * Check Firebase configuration
   */
  checkFirebase(): 'connected' | 'disconnected' | 'error' | 'unconfigured' {
    const hasConfig = !!(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    );
    if (!hasConfig) return 'unconfigured';
    return 'disconnected'; // Actual status determined at runtime
  },

  /**
   * Get environment variables status (safe - no values exposed)
   */
  getEnvStatus(): Record<string, boolean> {
    return {
      // Firebase
      NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      // Server-side
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
      ELEVENLABS_STEVEN_VOICE_ID: !!process.env.ELEVENLABS_STEVEN_VOICE_ID,
    };
  },

  /**
   * Get recent log entries
   */
  getLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let logs = [...LOG_BUFFER].reverse();
    if (level) {
      logs = logs.filter(l => l.level === level);
    }
    return logs.slice(0, count);
  },

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    LOG_BUFFER.length = 0;
  },

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(LOG_BUFFER, null, 2);
  },

  /**
   * Enable debug mode in browser
   */
  enableDebug(): void {
    if (IS_BROWSER) {
      localStorage.setItem('DEBUG_ENABLED', 'true');
      console.log('%c[DEBUG MODE ENABLED]', 'color: #00ff00; font-weight: bold; font-size: 16px');
    }
  },

  /**
   * Disable debug mode in browser
   */
  disableDebug(): void {
    if (IS_BROWSER) {
      localStorage.removeItem('DEBUG_ENABLED');
      console.log('%c[DEBUG MODE DISABLED]', 'color: #ff6666; font-weight: bold');
    }
  },

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return IS_DEV || (IS_BROWSER && localStorage?.getItem('DEBUG_ENABLED') === 'true');
  },
};

// Create pre-configured loggers for common components
export const loggers = {
  app: createLogger('App'),
  firebase: createLogger('Firebase'),
  sync: createLogger('SyncProvider'),
  stevenAI: createLogger('StevenAI'),
  voice: createLogger('Voice'),
  api: createLogger('API'),
  auth: createLogger('Auth'),
  booking: createLogger('Booking'),
  property: createLogger('Property'),
  cleaning: createLogger('Cleaning'),
};

// Expose to window for debugging in browser
if (IS_BROWSER) {
  (window as unknown as Record<string, unknown>).RAH_DEBUG = {
    Diagnostics,
    loggers,
    createLogger,
    getLogs: () => Diagnostics.getLogs(),
    enableDebug: () => Diagnostics.enableDebug(),
    disableDebug: () => Diagnostics.disableDebug(),
    getStatus: () => Diagnostics.getStatus(),
    getEnvStatus: () => Diagnostics.getEnvStatus(),
  };

  console.log(
    '%c🏠 Right at Home BnB Debug Tools Available',
    'color: #500000; font-weight: bold; font-size: 14px',
    '\nAccess via: window.RAH_DEBUG'
  );
}

export default Diagnostics;
