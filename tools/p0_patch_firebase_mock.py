from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\packages\testing\utils\mocks.ts")
text = path.read_text(encoding="utf-8")
start_marker = "export function createFirebaseMock() {"
end_marker = "// ============================================\n// API MOCK"
start = text.index(start_marker)
end = text.index(end_marker, start)

replacement = r'''export function createFirebaseMock() {
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

'''

path.write_text(text[:start] + replacement + text[end:], encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
