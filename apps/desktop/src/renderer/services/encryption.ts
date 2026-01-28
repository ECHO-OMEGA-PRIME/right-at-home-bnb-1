/**
 * Right at Home BnB - Encryption Service
 * Secure storage and encryption for sensitive data
 */

export interface EncryptedData {
  iv: string;
  data: string;
  tag: string;
  version: number;
}

export interface SecureStorageItem {
  key: string;
  encryptedValue: EncryptedData;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface SessionData {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActivity: string;
  deviceInfo: {
    platform: string;
    version: string;
    hostname: string;
  };
  permissions: string[];
}

class EncryptionService {
  private readonly ENCRYPTION_VERSION = 1;
  private readonly KEY_DERIVATION_ITERATIONS = 100000;
  private encryptionKey: CryptoKey | null = null;
  private currentSession: SessionData | null = null;

  constructor() {
    this.initializeEncryption();
  }

  private async initializeEncryption(): Promise<void> {
    try {
      // Try to load existing key or derive new one
      const storedKeyData = await window.electronAPI.store.get<string>('encryptionKeyData');

      if (storedKeyData) {
        await this.loadEncryptionKey(storedKeyData);
      } else {
        await this.generateNewEncryptionKey();
      }

      // Restore session if exists
      await this.restoreSession();
    } catch (error) {
      console.error('[Encryption] Initialization failed:', error);
    }
  }

  private async generateNewEncryptionKey(): Promise<void> {
    // Generate a random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Get machine-specific data for key derivation
    const machineId = await this.getMachineIdentifier();

    // Derive key from machine identifier
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(machineId),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.KEY_DERIVATION_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // Store salt for future key derivation
    const saltBase64 = btoa(String.fromCharCode(...salt));
    await window.electronAPI.store.set('encryptionKeyData', saltBase64);
  }

  private async loadEncryptionKey(saltBase64: string): Promise<void> {
    const salt = new Uint8Array(
      atob(saltBase64)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    const machineId = await this.getMachineIdentifier();

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(machineId),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.KEY_DERIVATION_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async getMachineIdentifier(): Promise<string> {
    // Combine multiple machine-specific factors
    const factors = [
      navigator.userAgent,
      navigator.language,
      screen.width.toString(),
      screen.height.toString(),
      new Date().getTimezoneOffset().toString(),
    ];

    // Get hostname if available
    try {
      const appInfo = await window.electronAPI.app.getInfo();
      factors.push(appInfo.platform || 'unknown');
    } catch {
      factors.push('electron');
    }

    // Hash the combined factors
    const combined = factors.join('|');
    const msgBuffer = new TextEncoder().encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Encrypt data
  async encrypt(data: unknown): Promise<EncryptedData> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(data));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encodedData
    );

    // Extract authentication tag (last 16 bytes) and ciphertext
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const ciphertext = encryptedArray.slice(0, -16);
    const tag = encryptedArray.slice(-16);

    return {
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...ciphertext)),
      tag: btoa(String.fromCharCode(...tag)),
      version: this.ENCRYPTION_VERSION,
    };
  }

  // Decrypt data
  async decrypt<T>(encrypted: EncryptedData): Promise<T> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }

    if (encrypted.version !== this.ENCRYPTION_VERSION) {
      throw new Error('Unsupported encryption version');
    }

    const iv = new Uint8Array(
      atob(encrypted.iv)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    const ciphertext = new Uint8Array(
      atob(encrypted.data)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    const tag = new Uint8Array(
      atob(encrypted.tag)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    // Combine ciphertext and tag for decryption
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      combined
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedText) as T;
  }

  // Secure storage operations
  async secureStore(key: string, value: unknown, expiresInMs?: number): Promise<void> {
    const encrypted = await this.encrypt(value);

    const item: SecureStorageItem = {
      key,
      encryptedValue: encrypted,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs).toISOString() : undefined,
    };

    await window.electronAPI.store.set(`secure:${key}`, item);
  }

  async secureRetrieve<T>(key: string): Promise<T | null> {
    const item = await window.electronAPI.store.get<SecureStorageItem>(`secure:${key}`);

    if (!item) {
      return null;
    }

    // Check expiration
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
      await this.secureDelete(key);
      return null;
    }

    try {
      return await this.decrypt<T>(item.encryptedValue);
    } catch (error) {
      console.error('[Encryption] Failed to decrypt:', error);
      return null;
    }
  }

  async secureDelete(key: string): Promise<void> {
    await window.electronAPI.store.delete(`secure:${key}`);
  }

  async secureList(): Promise<string[]> {
    // This would need to be implemented in the store API
    // For now, return empty array
    return [];
  }

  // Session management
  async createSession(userId: string, permissions: string[] = []): Promise<SessionData> {
    const sessionDurationMs = 24 * 60 * 60 * 1000; // 24 hours

    let platform = 'unknown';
    let version = 'unknown';
    let hostname = 'unknown';

    try {
      const appInfo = await window.electronAPI.app.getInfo();
      platform = appInfo.platform || 'unknown';
      version = appInfo.version || 'unknown';
    } catch {
      // Ignore
    }

    const session: SessionData = {
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + sessionDurationMs).toISOString(),
      lastActivity: new Date().toISOString(),
      deviceInfo: {
        platform,
        version,
        hostname,
      },
      permissions,
    };

    await this.secureStore('currentSession', session, sessionDurationMs);
    this.currentSession = session;

    return session;
  }

  async restoreSession(): Promise<SessionData | null> {
    const session = await this.secureRetrieve<SessionData>('currentSession');

    if (!session) {
      return null;
    }

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.endSession();
      return null;
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();
    await this.secureStore('currentSession', session);
    this.currentSession = session;

    return session;
  }

  async refreshSession(): Promise<SessionData | null> {
    if (!this.currentSession) {
      return null;
    }

    // Extend session by 24 hours
    const sessionDurationMs = 24 * 60 * 60 * 1000;
    this.currentSession.expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();
    this.currentSession.lastActivity = new Date().toISOString();

    await this.secureStore('currentSession', this.currentSession, sessionDurationMs);
    return this.currentSession;
  }

  async endSession(): Promise<void> {
    await this.secureDelete('currentSession');
    this.currentSession = null;
  }

  getSession(): SessionData | null {
    return this.currentSession;
  }

  isSessionValid(): boolean {
    if (!this.currentSession) {
      return false;
    }
    return new Date(this.currentSession.expiresAt) > new Date();
  }

  hasPermission(permission: string): boolean {
    if (!this.currentSession) {
      return false;
    }
    return this.currentSession.permissions.includes(permission) ||
           this.currentSession.permissions.includes('*');
  }

  // Hash sensitive data (for comparisons without storing plaintext)
  async hash(data: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Generate secure random token
  generateToken(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Secure credential storage helpers
  async storeCredential(
    service: string,
    username: string,
    password: string
  ): Promise<void> {
    const credential = {
      username,
      password,
      storedAt: new Date().toISOString(),
    };
    await this.secureStore(`credential:${service}`, credential);
  }

  async getCredential(
    service: string
  ): Promise<{ username: string; password: string } | null> {
    const credential = await this.secureRetrieve<{
      username: string;
      password: string;
      storedAt: string;
    }>(`credential:${service}`);

    if (!credential) {
      return null;
    }

    return { username: credential.username, password: credential.password };
  }

  async deleteCredential(service: string): Promise<void> {
    await this.secureDelete(`credential:${service}`);
  }

  // API token management
  async storeApiToken(
    provider: string,
    token: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<void> {
    const tokenData = {
      token,
      refreshToken,
      expiresAt: expiresAt?.toISOString(),
      storedAt: new Date().toISOString(),
    };

    const expiresInMs = expiresAt ? expiresAt.getTime() - Date.now() : undefined;
    await this.secureStore(`apiToken:${provider}`, tokenData, expiresInMs);
  }

  async getApiToken(provider: string): Promise<{
    token: string;
    refreshToken?: string;
    expiresAt?: string;
  } | null> {
    return this.secureRetrieve(`apiToken:${provider}`);
  }

  async deleteApiToken(provider: string): Promise<void> {
    await this.secureDelete(`apiToken:${provider}`);
  }
}

export const encryptionService = new EncryptionService();

// Convenience exports
export const encrypt = encryptionService.encrypt.bind(encryptionService);
export const decrypt = encryptionService.decrypt.bind(encryptionService);
export const secureStore = encryptionService.secureStore.bind(encryptionService);
export const secureRetrieve = encryptionService.secureRetrieve.bind(encryptionService);
export const hash = encryptionService.hash.bind(encryptionService);
