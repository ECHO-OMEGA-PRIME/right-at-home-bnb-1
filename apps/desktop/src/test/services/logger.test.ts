/**
 * Right at Home BnB - Logger Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockElectronAPI, mockStore } from '../setup';

// Need to import after setup
let logger: typeof import('@renderer/services/logger').logger;
let LogLevel: typeof import('@renderer/services/logger').LogLevel;

describe('Logger Service', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockStore.clear();

    // Dynamic import to get fresh instance
    const module = await import('@renderer/services/logger');
    logger = module.logger;
  });

  describe('Configuration', () => {
    it('should have default configuration', () => {
      const config = logger.getConfig();
      expect(config.level).toBe('info');
      expect(config.maxEntries).toBe(10000);
      expect(config.persistLogs).toBe(true);
      expect(config.consoleOutput).toBe(true);
    });

    it('should allow updating configuration', () => {
      logger.setConfig({ level: 'debug', maxEntries: 5000 });
      const config = logger.getConfig();
      expect(config.level).toBe('debug');
      expect(config.maxEntries).toBe(5000);
    });
  });

  describe('Logging Methods', () => {
    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.info('TEST', 'Test message');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warn messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      logger.warn('TEST', 'Warning message');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      logger.error('TEST', 'Error message');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log debug by default (info level)', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.debug('TEST', 'Debug message');
      // Debug should not be logged when level is info
      const debugCalls = consoleSpy.mock.calls.filter(
        (call) => call[0]?.includes?.('DEBUG')
      );
      expect(debugCalls.length).toBe(0);
      consoleSpy.mockRestore();
    });

    it('should log debug when level is set to debug', () => {
      logger.setConfig({ level: 'debug' });
      const consoleSpy = vi.spyOn(console, 'log');
      logger.debug('TEST', 'Debug message');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Specialized Logging', () => {
    it('should log API calls', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.api('GET', '/api/bookings', 200, 150);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log actions', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.action('booking_created', { bookingId: '123' });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log navigation', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.navigation('/dashboard', '/bookings');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Log Retrieval', () => {
    beforeEach(() => {
      logger.info('TEST', 'Info message 1');
      logger.info('TEST', 'Info message 2');
      logger.warn('WARNING', 'Warning message');
      logger.error('ERROR', 'Error message');
    });

    it('should get all logs', () => {
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(4);
    });

    it('should filter logs by level', () => {
      const errorLogs = logger.getLogs({ level: 'error' });
      expect(errorLogs.every((log) => log.level === 'error')).toBe(true);
    });

    it('should filter logs by category', () => {
      const testLogs = logger.getLogs({ category: 'TEST' });
      expect(testLogs.every((log) => log.category === 'TEST')).toBe(true);
    });

    it('should limit returned logs', () => {
      const logs = logger.getLogs({ limit: 2 });
      expect(logs.length).toBe(2);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      logger.info('TEST', 'Info 1');
      logger.info('TEST', 'Info 2');
      logger.warn('WARN', 'Warning');
      logger.error('ERROR', 'Error');
    });

    it('should calculate log statistics', () => {
      const stats = logger.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(4);
      expect(stats.byLevel.info).toBeGreaterThanOrEqual(2);
      expect(stats.byLevel.warn).toBeGreaterThanOrEqual(1);
      expect(stats.byLevel.error).toBeGreaterThanOrEqual(1);
    });

    it('should count errors in last 24 hours', () => {
      const stats = logger.getStats();
      expect(stats.errors24h).toBeGreaterThanOrEqual(1);
    });
  });

  describe('User Session', () => {
    it('should set user ID', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.setUserId('user-123');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
