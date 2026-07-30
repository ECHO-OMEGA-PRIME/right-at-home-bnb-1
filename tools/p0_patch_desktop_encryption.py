from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src\renderer\services\encryption.ts")
text = path.read_text(encoding="utf-8")

text = text.replace(
    """  private encryptionKey: CryptoKey | null = null;
  private currentSession: SessionData | null = null;

  constructor() {
    this.initializeEncryption();
  }
""",
    """  private encryptionKey: CryptoKey | null = null;
  private currentSession: SessionData | null = null;
  private readonly initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.initializeEncryption();
    void this.initializationPromise
      .then(() => this.restoreSession())
      .catch((error) => console.error('[Encryption] Session restore failed:', error));
  }
""",
    1,
)

text = text.replace(
    """      // Restore session if exists
      await this.restoreSession();
    } catch (error) {
""",
    """    } catch (error) {
""",
    1,
)

text = text.replace(
    """  // Encrypt data
  async encrypt(data: unknown): Promise<EncryptedData> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
""",
    """  private async ensureEncryptionReady(): Promise<void> {
    await this.initializationPromise;
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
  }

  // Encrypt data
  async encrypt(data: unknown): Promise<EncryptedData> {
    await this.ensureEncryptionReady();
""",
    1,
)

text = text.replace(
    """  async decrypt<T>(encrypted: EncryptedData): Promise<T> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not initialized');
    }
""",
    """  async decrypt<T>(encrypted: EncryptedData): Promise<T> {
    await this.ensureEncryptionReady();
""",
    1,
)

old_exports = """export const encryptionService = new EncryptionService();

// Convenience exports
export const encrypt = encryptionService.encrypt.bind(encryptionService);
export const decrypt = encryptionService.decrypt.bind(encryptionService);
export const secureStore = encryptionService.secureStore.bind(encryptionService);
export const secureRetrieve = encryptionService.secureRetrieve.bind(encryptionService);
export const hash = encryptionService.hash.bind(encryptionService);
"""

new_exports = r'''export const encryptionService = new EncryptionService();

const PASSWORD_ENCRYPTION_VERSION = 1;
const PASSWORD_KDF_ITERATIONS = 150000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_IV_BYTES = 12;

interface PasswordEncryptedPayload {
  version: number;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function generateSalt(length = PASSWORD_SALT_BYTES): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytesToBase64(bytes);
}

async function derivePasswordCryptoKey(
  password: string,
  salt: Uint8Array,
  iterations = PASSWORD_KDF_ITERATIONS
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function deriveKey(password: string, salt: string): Promise<string> {
  const saltBytes = base64ToBytes(salt);
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PASSWORD_KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    256
  );
  return `${salt}.${bytesToBase64(new Uint8Array(bits))}`;
}

async function encryptWithPassword(plaintext: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(PASSWORD_IV_BYTES));
  const key = await derivePasswordCryptoKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const payload: PasswordEncryptedPayload = {
    version: PASSWORD_ENCRYPTION_VERSION,
    iterations: PASSWORD_KDF_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(payload);
}

async function decryptWithPassword(payloadText: string, password: string): Promise<string> {
  let payload: PasswordEncryptedPayload;
  try {
    payload = JSON.parse(payloadText) as PasswordEncryptedPayload;
  } catch {
    throw new Error('Invalid encrypted payload');
  }
  if (payload.version !== PASSWORD_ENCRYPTION_VERSION) {
    throw new Error('Unsupported password encryption version');
  }
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await derivePasswordCryptoKey(password, salt, payload.iterations);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBytes(payload.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

export function encrypt(data: unknown): Promise<EncryptedData>;
export function encrypt(data: string, password: string): Promise<string>;
export async function encrypt(
  data: unknown,
  password?: string
): Promise<EncryptedData | string> {
  if (password !== undefined) {
    if (typeof data !== 'string') {
      throw new TypeError('Password encryption requires string plaintext');
    }
    return encryptWithPassword(data, password);
  }
  return encryptionService.encrypt(data);
}

export function decrypt<T>(encrypted: EncryptedData): Promise<T>;
export function decrypt(encrypted: string, password: string): Promise<string>;
export async function decrypt<T>(
  encrypted: EncryptedData | string,
  password?: string
): Promise<T | string> {
  if (password !== undefined) {
    if (typeof encrypted !== 'string') {
      throw new TypeError('Password decryption requires a string payload');
    }
    return decryptWithPassword(encrypted, password);
  }
  if (typeof encrypted === 'string') {
    throw new TypeError('Machine-key decryption requires an EncryptedData payload');
  }
  return encryptionService.decrypt<T>(encrypted);
}

export async function encryptObject<T>(value: T, password: string): Promise<string> {
  return encryptWithPassword(JSON.stringify(value), password);
}

export async function decryptObject<T>(payload: string, password: string): Promise<T> {
  return JSON.parse(await decryptWithPassword(payload, password)) as T;
}

type SecureStoreCallable = {
  (key: string, value: unknown, expiresInMs?: number): Promise<void>;
  set(key: string, value: unknown, expiresInMs?: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
};

const secureStoreFunction = encryptionService.secureStore.bind(encryptionService);

export const secureStore: SecureStoreCallable = Object.assign(secureStoreFunction, {
  set: (key: string, value: unknown, expiresInMs?: number) =>
    encryptionService.secureStore(key, value, expiresInMs),
  get: <T>(key: string) => encryptionService.secureRetrieve<T>(key),
  delete: (key: string) => encryptionService.secureDelete(key),
  has: async (key: string) => (await encryptionService.secureRetrieve(key)) !== null,
});

export const secureRetrieve = encryptionService.secureRetrieve.bind(encryptionService);
export const hash = encryptionService.hash.bind(encryptionService);

export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const derived = await deriveKey(password, salt);
  return `pbkdf2-sha256$${PASSWORD_KDF_ITERATIONS}$${derived}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const salt = parts[2];
  const expected = parts[3];
  const actualCombined = await deriveKey(password, salt);
  const actual = actualCombined.slice(actualCombined.indexOf('.') + 1);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function generateSecureToken(length = 48): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError('Token length must be a positive integer');
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function maskSensitiveData(value: string, visibleTail = 4): string {
  if (value.length <= visibleTail) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(4, value.length - visibleTail))}${value.slice(-visibleTail)}`;
}

export function maskEmail(email: string): string {
  const separator = email.indexOf('@');
  if (separator <= 0) return maskSensitiveData(email);
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const tail = phone.replace(/\D/g, '').slice(-4);
  return `***-***-${tail}`;
}
'''

if old_exports not in text:
    raise SystemExit("Expected encryption export block was not found")
text = text.replace(old_exports, new_exports, 1)
path.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
