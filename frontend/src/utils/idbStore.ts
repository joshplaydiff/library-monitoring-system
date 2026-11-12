/**
 * IndexedDB Offline Storage Service
 * 
 * Provides durable, client-side storage for offline attendance events.
 * 
 * SECURITY NOTES:
 * - Stores ONLY: client_event_id, official_id, id_type, purpose, section, room_id,
 *   log_type, local_timestamp, sync_status, retry_count, last_error
 * - NEVER stores: JWT tokens, passwords, JWT secrets, activation tokens,
 *   reset tokens, or any authentication secrets
 * - Does NOT store patron names (only official_id for identification)
 * 
 * DATA RETENTION:
 * - Pending/failed events: retained indefinitely until synced or manually removed
 * - Synced events: retained for 30 days then eligible for cleanup
 * - Failed events: retained indefinitely for librarian review
 */

const DB_NAME = 'LibraryMonitoringDB';
const DB_VERSION = 1;
const STORE_NAME = 'attendance_queue';

// IndexedDB instance
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;

      // Create object store for attendance queue
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'client_event_id',
          autoIncrement: false
        });

        // Index on sync_status for querying pending/failed events
        store.createIndex('sync_status', 'sync_status', { unique: false });

        // Index on client_event_id for deduplication
        store.createIndex('client_event_id', 'client_event_id', { unique: true });

        // Index on local_timestamp for chronological ordering
        store.createIndex('local_timestamp', 'local_timestamp', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Attendance Event Interface
 * Stores only essential data - NO secrets or personal information
 */
export interface OfflineEvent {
  client_event_id: string;
  official_id: string;
  id_type: string;
  purpose: string;
  section: string;
  room_id?: number;
  log_type: 'entry' | 'exit';
  local_timestamp: string; // ISO string of when scan occurred offline
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed' | 'needs-review';
  retry_count: number;
  last_error?: string;
  synced_at?: string; // ISO string when successfully synced to server
}

/**
 * Save an attendance event to IndexedDB
 * Preserves leading zeros in official_id (stored as string)
 */
export async function saveOfflineEvent(event: OfflineEvent): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const request = store.put(event);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to save offline event'));
    };

    tx.onerror = () => {
      reject(new Error('IndexedDB transaction failed'));
    };
  });
}

/**
 * Get all offline events, optionally filtered by sync_status
 */
export async function getOfflineEvents(status?: 'pending' | 'syncing' | 'synced' | 'failed' | 'needs-review'): Promise<OfflineEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let request: IDBRequest;

    if (status) {
      const index = store.index('sync_status');
      request = index.getAll(status);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error('Failed to fetch offline events'));
    };
  });
}

/**
 * Get a single offline event by client_event_id
 */
export async function getOfflineEvent(client_event_id: string): Promise<OfflineEvent | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const request = store.get(client_event_id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(new Error('Failed to fetch offline event'));
    };
  });
}

/**
 * Update sync status of an event
 */
export async function updateEventStatus(
  client_event_id: string,
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'needs-review',
  error?: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const getRequest = store.get(client_event_id);

    getRequest.onsuccess = () => {
      const event = getRequest.result;
      if (!event) {
        reject(new Error(`Event ${client_event_id} not found`));
        return;
      }

      event.sync_status = status;
      if (status === 'synced') {
        event.synced_at = new Date().toISOString();
      }
      if (error) {
        event.last_error = error;
        event.retry_count = (event.retry_count || 0) + 1;
      }

      const putRequest = store.put(event);

      putRequest.onsuccess = () => {
        resolve();
      };

      putRequest.onerror = () => {
        reject(new Error('Failed to update event status'));
      };
    };

    getRequest.onerror = () => {
      reject(new Error('Failed to fetch event for update'));
    };
  });
}

/**
 * Delete a synced event from IndexedDB
 * Only called after successful server confirmation
 */
export async function deleteSyncedEvent(client_event_id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const request = store.delete(client_event_id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Failed to delete synced event'));
    };
  });
}

/**
 * Count events by sync_status
 */
export async function getEventCounts(): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  needs_review: number;
}> {
  const events = await getOfflineEvents();
  const counts = {
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    needs_review: 0
  };

  for (const event of events) {
    if (event.sync_status === 'pending') counts.pending++;
    if (event.sync_status === 'syncing') counts.syncing++;
    if (event.sync_status === 'synced') counts.synced++;
    if (event.sync_status === 'failed') counts.failed++;
    if (event.sync_status === 'needs-review') counts.needs_review++;
  }

  return counts;
}

/**
 * Check if an event already exists in IndexedDB
 * Used for duplicate prevention
 */
export async function eventExists(client_event_id: string): Promise<boolean> {
  const event = await getOfflineEvent(client_event_id);
  return !!event;
}

/**
 * Clear all synced events older than a threshold
 * Used for retention management
 */
export async function clearSyncedEvents(olderThanDays: number = 30): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sync_status');

    const request = index.getAll('synced');

    request.onsuccess = () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);

      const deleteRequests = request.result
        .filter((e: OfflineEvent) => e.synced_at && new Date(e.synced_at) < cutoff)
        .map((e: OfflineEvent) => store.delete(e.client_event_id));

      Promise.all(deleteRequests).then(() => resolve()).catch(reject);
    };

    request.onerror = () => {
      reject(new Error('Failed to delete synced events'));
    };
  });
}

/**
 * Check if IndexedDB is available in this browser
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Get the IndexedDB instance (for advanced use)
 */
export async function getDB(): Promise<IDBDatabase> {
  return openDB();
}