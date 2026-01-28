/**
 * Right at Home BnB - Encryption Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockElectronAPI, mockStore } from '../setup';

describe('Encryption Service', () => {
  let encryptionService: typeof import('@renderer/services/encryption');

  beforeEach(async () => {
    vi.resetModules();
    mockStore.clear();

    // Dynamic import to get fresh instance
    encryptionService = await import('@renderer/services/encryption');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Key Derivation', () => {
    it('should derive key from password', async () => {
      const password = 'test-password-123';
      const salt = encryptionService.generateSalt();

      const key = await encryptionService.deriveKey(password, salt);

      expect(key).toBeDefined();
      // Key should be consistent for same password and salt
      const key2 = await encryptionService.deriveKey(password, salt);
      expect(key).toEqual(key2);
    });

    it('should generate different keys for different salts', async () => {
      const password = 'test-password-123';
      const salt1 = encryptionService.generateSalt();
      const salt2 = encryptionService.generateSalt();

      const key1 = await encryptionService.deriveKey(password, salt1);
      const key2 = await encryptionService.deriveKey(password, salt2);

      expect(key1).not.toEqual(key2);
    });

    it('should generate random salt', () => {
      const salt1 = encryptionService.generateSalt();
      const salt2 = encryptionService.generateSalt();

      expect(salt1).toBeDefined();
      expect(salt2).toBeDefined();
      expect(salt1).not.toBe(salt2);
      expect(salt1.length).toBeGreaterThan(0);
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const plaintext = 'Sensitive guest information';
      const password = 'secure-password';

      const encrypted = await encryptionService.encrypt(plaintext, password);
      const decrypted = await encryptionService.decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt objects correctly', async () => {
      const data = {
        guestName: 'John Doe',
        creditCard: '4111111111111111',
        email: 'john@example.com',
      };
      const password = 'secure-password';

      const encrypted = await encryptionService.encryptObject(data, password);
      const decrypted = await encryptionService.decryptObject(encrypted, password);

      expect(decrypted).toEqual(data);
    });

    it('should fail decryption with wrong password', async () => {
      const plaintext = 'Sensitive data';
      const correctPassword = 'correct-password';
      const wrongPassword = 'wrong-password';

      const encrypted = await encryptionService.encrypt(plaintext, correctPassword);

      await expect(
        encryptionService.decrypt(encrypted, wrongPassword)
      ).rejects.toThrow();
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = 'Same message';
      const password = 'password';

      const encrypted1 = await encryptionService.encrypt(plaintext, password);
      const encrypted2 = await encryptionService.encrypt(plaintext, password);

      // IVs should be different, so ciphertext should differ
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same plaintext
      const decrypted1 = await encryptionService.decrypt(encrypted1, password);
      const decrypted2 = await encryptionService.decrypt(encrypted2, password);
      expect(decrypted1).toBe(decrypted2);
    });
  });

  describe('Secure Storage', () => {
    it('should store and retrieve encrypted data', async () => {
      const key = 'api-credentials';
      const data = { apiKey: 'secret-api-key', secret: 'secret-value' };

      await encryptionService.secureStore.set(key, data);
      const retrieved = await encryptionService.secureStore.get(key);

      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent key', async () => {
      const retrieved = await encryptionService.secureStore.get('non-existent-key');

      expect(retrieved).toBeNull();
    });

    it('should delete stored data', async () => {
      const key = 'temp-data';
      const data = { temp: 'value' };

      await encryptionService.secureStore.set(key, data);
      await encryptionService.secureStore.delete(key);
      const retrieved = await encryptionService.secureStore.get(key);

      expect(retrieved).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'check-key';
      const data = { value: 'test' };

      expect(await encryptionService.secureStore.has(key)).toBe(false);

      await encryptionService.secureStore.set(key, data);

      expect(await encryptionService.secureStore.has(key)).toBe(true);
    });
  });

  describe('Hashing', () => {
    it('should hash passwords securely', async () => {
      const password = 'user-password';

      const hash = await encryptionService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify password against hash', async () => {
      const password = 'user-password';

      const hash = await encryptionService.hashPassword(password);
      const isValid = await encryptionService.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';

      const hash = await encryptionService.hashPassword(password);
      const isValid = await encryptionService.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'same-password';

      const hash1 = await encryptionService.hashPassword(password);
      const hash2 = await encryptionService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Token Generation', () => {
    it('should generate secure random tokens', () => {
      const token = encryptionService.generateSecureToken();

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(20);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(encryptionService.generateSecureToken());
      }

      expect(tokens.size).toBe(100);
    });

    it('should generate tokens of specified length', () => {
      const length = 64;
      const token = encryptionService.generateSecureToken(length);

      expect(token.length).toBe(length);
    });
  });

  describe('Data Sanitization', () => {
    it('should mask sensitive data', () => {
      const creditCard = '4111111111111111';
      const masked = encryptionService.maskSensitiveData(creditCard);

      expect(masked).toContain('****');
      expect(masked).not.toContain('4111111111111111');
      expect(masked.endsWith('1111')).toBe(true);
    });

    it('should mask email addresses', () => {
      const email = 'john.doe@example.com';
      const masked = encryptionService.maskEmail(email);

      expect(masked).toContain('***');
      expect(masked).toContain('@');
      expect(masked).toContain('example.com');
    });

    it('should mask phone numbers', () => {
      const phone = '+1 (432) 555-1234';
      const masked = encryptionService.maskPhone(phone);

      expect(masked).toContain('***');
      expect(masked.endsWith('1234')).toBe(true);
    });
  });
});
