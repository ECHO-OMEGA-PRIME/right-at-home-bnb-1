/**
 * Test Mocks for RightAtHomeBnB
 * Service mocks for isolated testing
 */

import { vi } from 'vitest';
import {
  REAL_PROPERTIES,
  TEST_BOOKINGS,
  TEST_GUESTS,
  TEST_USERS,
  TEST_CLEANING_JOBS
} from './fixtures';

// ============================================
// PRISMA MOCK
// ============================================

export function createPrismaMock() {
  const properties = [...REAL_PROPERTIES];
  const bookings = [...TEST_BOOKINGS];
  const guests = [...TEST_GUESTS];
  const users = [...TEST_USERS];
  const cleaningJobs = [...TEST_CLEANING_JOBS];

  return {
    property: {
      findMany: vi.fn().mockResolvedValue(properties),
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(properties.find(p => p.id === where.id) || null)
      ),
      findFirst: vi.fn(({ where }: { where: Partial<typeof properties[0]> }) =>
        Promise.resolve(properties.find(p =>
          Object.entries(where).every(([k, v]) => (p as Record<string, unknown>)[k] === v)
        ) || null)
      ),
      create: vi.fn(({ data }: { data: typeof properties[0] }) => {
        const newProperty = { ...data, id: `prop_${Date.now()}` };
        properties.push(newProperty);
        return Promise.resolve(newProperty);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<typeof properties[0]> }) => {
        const index = properties.findIndex(p => p.id === where.id);
        if (index >= 0) {
          properties[index] = { ...properties[index], ...data };
          return Promise.resolve(properties[index]);
        }
        return Promise.reject(new Error('Property not found'));
      }),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        const index = properties.findIndex(p => p.id === where.id);
        if (index >= 0) {
          const deleted = properties.splice(index, 1)[0];
          return Promise.resolve(deleted);
        }
        return Promise.reject(new Error('Property not found'));
      }),
      count: vi.fn().mockResolvedValue(properties.length)
    },

    booking: {
      findMany: vi.fn().mockResolvedValue(bookings),
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(bookings.find(b => b.id === where.id) || null)
      ),
      create: vi.fn(({ data }: { data: typeof bookings[0] }) => {
        const newBooking = { ...data, id: `book_${Date.now()}` };
        bookings.push(newBooking);
        return Promise.resolve(newBooking);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<typeof bookings[0]> }) => {
        const index = bookings.findIndex(b => b.id === where.id);
        if (index >= 0) {
          bookings[index] = { ...bookings[index], ...data };
          return Promise.resolve(bookings[index]);
        }
        return Promise.reject(new Error('Booking not found'));
      }),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        const index = bookings.findIndex(b => b.id === where.id);
        if (index >= 0) {
          return Promise.resolve(bookings.splice(index, 1)[0]);
        }
        return Promise.reject(new Error('Booking not found'));
      }),
      count: vi.fn().mockResolvedValue(bookings.length)
    },

    guest: {
      findMany: vi.fn().mockResolvedValue(guests),
      findUnique: vi.fn(({ where }: { where: { id?: string; email?: string } }) =>
        Promise.resolve(guests.find(g => g.id === where.id || g.email === where.email) || null)
      ),
      create: vi.fn(({ data }: { data: typeof guests[0] }) => {
        const newGuest = { ...data, id: `guest_${Date.now()}` };
        guests.push(newGuest);
        return Promise.resolve(newGuest);
      }),
      upsert: vi.fn(({ where, create, update }: {
        where: { email: string };
        create: typeof guests[0];
        update: Partial<typeof guests[0]>;
      }) => {
        const existing = guests.find(g => g.email === where.email);
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        const newGuest = { ...create, id: `guest_${Date.now()}` };
        guests.push(newGuest);
        return Promise.resolve(newGuest);
      }),
      count: vi.fn().mockResolvedValue(guests.length)
    },

    user: {
      findMany: vi.fn().mockResolvedValue(users),
      findUnique: vi.fn(({ where }: { where: { id?: string; email?: string } }) =>
        Promise.resolve(users.find(u => u.id === where.id || u.email === where.email) || null)
      ),
      create: vi.fn(({ data }: { data: typeof users[0] }) => {
        const newUser = { ...data, id: `user_${Date.now()}` };
        users.push(newUser);
        return Promise.resolve(newUser);
      }),
      count: vi.fn().mockResolvedValue(users.length)
    },

    cleaningJob: {
      findMany: vi.fn().mockResolvedValue(cleaningJobs),
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(cleaningJobs.find(c => c.id === where.id) || null)
      ),
      create: vi.fn(({ data }: { data: typeof cleaningJobs[0] }) => {
        const newJob = { ...data, id: `clean_${Date.now()}` };
        cleaningJobs.push(newJob);
        return Promise.resolve(newJob);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<typeof cleaningJobs[0]> }) => {
        const index = cleaningJobs.findIndex(c => c.id === where.id);
        if (index >= 0) {
          cleaningJobs[index] = { ...cleaningJobs[index], ...data };
          return Promise.resolve(cleaningJobs[index]);
        }
        return Promise.reject(new Error('Cleaning job not found'));
      }),
      count: vi.fn().mockResolvedValue(cleaningJobs.length)
    },

    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations))
  };
}

// ============================================
// FIREBASE MOCK
// ============================================

export function createFirebaseMock() {
  const documents = new Map<string, Map<string, unknown>>();

  function getCollection(collectionPath: string): Map<string, unknown> {
    if (!documents.has(collectionPath)) {
      documents.set(collectionPath, new Map());
    }
    return documents.get(collectionPath)!;
  }

  function documentSnapshot(collectionPath: string, docId: string) {
    const collection = getCollection(collectionPath);
    return {
      exists: collection.has(docId),
      id: docId,
      data: () => collection.get(docId)
    };
  }

  function collectionSnapshot(
    collectionPath: string,
    predicate?: (data: Record<string, unknown>) => boolean
  ) {
    const collection = getCollection(collectionPath);
    const entries = Array.from(collection.entries()).filter(([, raw]) => {
      if (!predicate) return true;
      return predicate((raw ?? {}) as Record<string, unknown>);
    });
    return {
      empty: entries.length === 0,
      size: entries.length,
      docs: entries.map(([id, data]) => ({
        id,
        exists: true,
        data: () => data
      }))
    };
  }

  function documentReference(collectionPath: string, docId: string) {
    return {
      _collectionPath: collectionPath,
      _docId: docId,
      get: vi.fn(() => Promise.resolve(documentSnapshot(collectionPath, docId))),
      set: vi.fn((data: unknown) => {
        getCollection(collectionPath).set(docId, data);
        return Promise.resolve();
      }),
      update: vi.fn((data: unknown) => {
        const collection = getCollection(collectionPath);
        if (!collection.has(docId)) {
          return Promise.reject(new Error('Document not found'));
        }
        const existing = collection.get(docId) as Record<string, unknown>;
        collection.set(docId, { ...existing, ...(data as Record<string, unknown>) });
        return Promise.resolve();
      }),
      delete: vi.fn(() => {
        getCollection(collectionPath).delete(docId);
        return Promise.resolve();
      }),
      onSnapshot: vi.fn((callback: (snapshot: unknown) => void) => {
        callback(documentSnapshot(collectionPath, docId));
        return vi.fn();
      })
    };
  }

  function collectionReference(collectionPath: string) {
    return {
      doc: vi.fn((docId: string) => documentReference(collectionPath, docId)),
      add: vi.fn((data: unknown) => {
        const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        getCollection(collectionPath).set(id, data);
        return Promise.resolve({ id });
      }),
      get: vi.fn(() => Promise.resolve(collectionSnapshot(collectionPath))),
      where: vi.fn((field: string, operator: string, value: unknown) => {
        const predicate = (data: Record<string, unknown>) => {
          const actual = data[field];
          switch (operator) {
            case '==': return actual === value;
            case '!=': return actual !== value;
            case '>': return typeof actual === 'number' && typeof value === 'number' && actual > value;
            case '>=': return typeof actual === 'number' && typeof value === 'number' && actual >= value;
            case '<': return typeof actual === 'number' && typeof value === 'number' && actual < value;
            case '<=': return typeof actual === 'number' && typeof value === 'number' && actual <= value;
            case 'array-contains': return Array.isArray(actual) && actual.includes(value);
            default: return false;
          }
        };
        return {
          get: vi.fn(() => Promise.resolve(collectionSnapshot(collectionPath, predicate))),
          onSnapshot: vi.fn((callback: (snapshot: unknown) => void) => {
            callback(collectionSnapshot(collectionPath, predicate));
            return vi.fn();
          })
        };
      }),
      onSnapshot: vi.fn((callback: (snapshot: unknown) => void) => {
        callback(collectionSnapshot(collectionPath));
        return vi.fn();
      })
    };
  }

  return {
    app: {
      name: 'test-app',
      options: {
        projectId: 'rightathome-prod'
      }
    },

    firestore: {
      collection: vi.fn((collectionPath: string) => collectionReference(collectionPath)),

      batch: vi.fn(() => {
        const operations: Array<() => void> = [];
        return {
          set: vi.fn((ref: { _collectionPath: string; _docId: string }, data: unknown) => {
            operations.push(() => getCollection(ref._collectionPath).set(ref._docId, data));
          }),
          update: vi.fn((ref: { _collectionPath: string; _docId: string }, data: unknown) => {
            operations.push(() => {
              const collection = getCollection(ref._collectionPath);
              if (!collection.has(ref._docId)) throw new Error('Document not found');
              const existing = collection.get(ref._docId) as Record<string, unknown>;
              collection.set(ref._docId, { ...existing, ...(data as Record<string, unknown>) });
            });
          }),
          delete: vi.fn((ref: { _collectionPath: string; _docId: string }) => {
            operations.push(() => getCollection(ref._collectionPath).delete(ref._docId));
          }),
          commit: vi.fn(() => {
            for (const operation of operations) operation();
            return Promise.resolve();
          })
        };
      }),

      runTransaction: vi.fn((updateFn: (transaction: unknown) => Promise<unknown>) => {
        const transaction = {
          get: vi.fn((ref: { _collectionPath: string; _docId: string }) =>
            Promise.resolve(documentSnapshot(ref._collectionPath, ref._docId))
          ),
          set: vi.fn((ref: { _collectionPath: string; _docId: string }, data: unknown) =>
            getCollection(ref._collectionPath).set(ref._docId, data)
          ),
          update: vi.fn((ref: { _collectionPath: string; _docId: string }, data: unknown) => {
            const collection = getCollection(ref._collectionPath);
            const existing = collection.get(ref._docId) as Record<string, unknown>;
            collection.set(ref._docId, { ...existing, ...(data as Record<string, unknown>) });
          }),
          delete: vi.fn((ref: { _collectionPath: string; _docId: string }) =>
            getCollection(ref._collectionPath).delete(ref._docId)
          )
        };
        return updateFn(transaction);
      })
    },

    _reset: () => {
      documents.clear();
    }
  };
}

// ============================================
// API MOCK
// ============================================

export function createApiMock() {
  return {
    properties: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: REAL_PROPERTIES,
        pagination: { page: 1, limit: 50, total: REAL_PROPERTIES.length, totalPages: 1 }
      }),
      get: vi.fn((id: string) => Promise.resolve({
        success: true,
        data: REAL_PROPERTIES.find(p => p.id === id) || null
      })),
      create: vi.fn((data: unknown) => Promise.resolve({
        success: true,
        data: { ...data, id: `prop_${Date.now()}` }
      })),
      update: vi.fn((id: string, data: unknown) => Promise.resolve({
        success: true,
        data: { ...(REAL_PROPERTIES.find(p => p.id === id) || {}), ...data }
      })),
      delete: vi.fn(() => Promise.resolve({ success: true }))
    },

    bookings: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: TEST_BOOKINGS,
        pagination: { page: 1, limit: 50, total: TEST_BOOKINGS.length, totalPages: 1 }
      }),
      get: vi.fn((id: string) => Promise.resolve({
        success: true,
        data: TEST_BOOKINGS.find(b => b.id === id) || null
      })),
      create: vi.fn((data: unknown) => Promise.resolve({
        success: true,
        data: { ...data, id: `book_${Date.now()}` }
      })),
      update: vi.fn((id: string, data: unknown) => Promise.resolve({
        success: true,
        data: { ...(TEST_BOOKINGS.find(b => b.id === id) || {}), ...data }
      })),
      cancel: vi.fn((id: string) => Promise.resolve({
        success: true,
        data: { ...(TEST_BOOKINGS.find(b => b.id === id) || {}), status: 'cancelled' }
      }))
    },

    guests: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: TEST_GUESTS,
        pagination: { page: 1, limit: 50, total: TEST_GUESTS.length, totalPages: 1 }
      }),
      get: vi.fn((id: string) => Promise.resolve({
        success: true,
        data: TEST_GUESTS.find(g => g.id === id) || null
      })),
      search: vi.fn((query: string) => Promise.resolve({
        success: true,
        data: TEST_GUESTS.filter(g =>
          g.name?.toLowerCase().includes(query.toLowerCase()) ||
          g.email?.toLowerCase().includes(query.toLowerCase())
        )
      }))
    },

    cleaning: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: TEST_CLEANING_JOBS,
        pagination: { page: 1, limit: 50, total: TEST_CLEANING_JOBS.length, totalPages: 1 }
      }),
      get: vi.fn((id: string) => Promise.resolve({
        success: true,
        data: TEST_CLEANING_JOBS.find(c => c.id === id) || null
      })),
      assign: vi.fn((jobId: string, cleanerId: string) => Promise.resolve({
        success: true,
        data: { ...(TEST_CLEANING_JOBS.find(c => c.id === jobId) || {}), cleanerId, status: 'assigned' }
      })),
      complete: vi.fn((jobId: string) => Promise.resolve({
        success: true,
        data: { ...(TEST_CLEANING_JOBS.find(c => c.id === jobId) || {}), status: 'completed' }
      }))
    }
  };
}

// ============================================
// FETCH MOCK
// ============================================

export function createFetchMock() {
  const responses = new Map<string, unknown>();

  const mockFetch = vi.fn((url: string, options?: RequestInit) => {
    const method = options?.method || 'GET';
    const key = `${method}:${url}`;

    if (responses.has(key)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses.get(key)),
        text: () => Promise.resolve(JSON.stringify(responses.get(key)))
      });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
      text: () => Promise.resolve('Not found')
    });
  });

  return {
    fetch: mockFetch,
    setResponse: (method: string, url: string, response: unknown) => {
      responses.set(`${method}:${url}`, response);
    },
    reset: () => {
      responses.clear();
      mockFetch.mockClear();
    }
  };
}

// ============================================
// STORAGE MOCK
// ============================================

export function createStorageMock() {
  const storage = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => storage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    key: vi.fn((index: number) => Array.from(storage.keys())[index] || null),
    get length() {
      return storage.size;
    }
  };
}
