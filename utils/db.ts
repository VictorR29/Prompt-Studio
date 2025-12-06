
import { SavedPrompt } from '../types';

const DB_NAME = 'PromptStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'prompts';

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const db = {
  // Get all prompts
  getAllPrompts: async (): Promise<SavedPrompt[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by id descending (newest first) assuming id is timestamp-based
        const result = request.result as SavedPrompt[];
        resolve(result.sort((a, b) => Number(b.id) - Number(a.id)));
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Save or Update a prompt
  savePrompt: async (prompt: SavedPrompt): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(prompt);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Delete a prompt
  deletePrompt: async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Bulk save (for migration)
  saveMany: async (prompts: SavedPrompt[]): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      let processed = 0;
      prompts.forEach(prompt => {
          const request = store.put(prompt);
          request.onsuccess = () => {
              processed++;
              if (processed === prompts.length) resolve();
          };
          request.onerror = () => reject(request.error);
      });
      
      if (prompts.length === 0) resolve();
    });
  },

  // Clear all
  clearAll: async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
