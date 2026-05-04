import type { TrackerState, ValidationError } from "../types/index";
import type { Result } from "../types/result";
import { validateImport } from "./ValidationService";

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = "task-tracker-db";
const DB_VERSION = 1;
const STORE_NAME = "state";
const STATE_KEY = "tracker";
const ASSIGNEE_KEY = "assignee";

// ─── isStorageAvailable ───────────────────────────────────────────────────────

/**
 * Whether IndexedDB is available in the current environment.
 * Detected once at module initialization.
 * May be false in private browsing mode or when storage is disabled.
 */
export const isStorageAvailable: boolean = (() => {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
})();

// ─── loadError ────────────────────────────────────────────────────────────────

/**
 * Set to `true` when `load()` encounters a parse/validation failure.
 * Reset to `false` on a successful load.
 */
export let loadError: boolean = false;

// ─── DB helpers ───────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// ─── load ─────────────────────────────────────────────────────────────────────

/**
 * Read and deserialize the tracker state from IndexedDB.
 * Returns `null` if no data is stored or if validation fails.
 * Sets `loadError` accordingly.
 */
export async function load(): Promise<TrackerState | null> {
  if (!isStorageAvailable) {
    return null;
  }

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    loadError = true;
    return null;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);

    request.onsuccess = (event) => {
      const raw = (event.target as IDBRequest).result;
      db.close();

      if (raw === undefined || raw === null) {
        resolve(null);
        return;
      }

      // raw is already a JS object (IDB stores structured-clone data natively)
      const result = validateImport(raw);
      if (!result.ok) {
        loadError = true;
        resolve(null);
        return;
      }

      loadError = false;
      resolve(result.value);
    };

    request.onerror = () => {
      db.close();
      loadError = true;
      resolve(null);
    };
  });
}

// ─── save ─────────────────────────────────────────────────────────────────────

/**
 * Persist the tracker state to IndexedDB.
 * Returns a promise that resolves when the write completes.
 * Errors are surfaced via the returned Result.
 */
export async function save(
  state: TrackerState
): Promise<{ ok: boolean; error?: "QUOTA_EXCEEDED" | "WRITE_ERROR" }> {
  if (!isStorageAvailable) {
    return { ok: false, error: "WRITE_ERROR" };
  }

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return { ok: false, error: "WRITE_ERROR" };
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(state, STATE_KEY);

    request.onsuccess = () => {
      db.close();
      resolve({ ok: true });
    };

    request.onerror = (event) => {
      db.close();
      const err = (event.target as IDBRequest).error;
      // QuotaExceededError surfaces as a DOMException
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        resolve({ ok: false, error: "QUOTA_EXCEEDED" });
      } else {
        resolve({ ok: false, error: "WRITE_ERROR" });
      }
    };
  });
}

// ─── clearDB ──────────────────────────────────────────────────────────────────

/**
 * Delete all data from the IndexedDB store.
 * Used for corrupt-data recovery (reset to empty state).
 */
export async function clearDB(): Promise<void> {
  if (!isStorageAvailable) return;

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      db.close();
      resolve();
    };

    request.onerror = () => {
      db.close();
      resolve();
    };
  });
}

export async function loadAssignee(): Promise<string | null> {
  if (!isStorageAvailable) return null;

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(ASSIGNEE_KEY);

    request.onsuccess = (event) => {
      db.close();
      const raw = (event.target as IDBRequest).result;
      resolve(typeof raw === "string" ? raw : null);
    };

    request.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}

export async function saveAssignee(value: string | null): Promise<void> {
  if (!isStorageAvailable) return;

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = value && value.trim() ? store.put(value.trim(), ASSIGNEE_KEY) : store.delete(ASSIGNEE_KEY);

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      resolve();
    };
  });
}

// ─── exportJSON ───────────────────────────────────────────────────────────────

/**
 * Serialize the tracker state to a human-readable, formatted JSON string.
 */
export function exportJSON(state: TrackerState): string {
  return JSON.stringify(state, null, 2);
}

// ─── importJSON ───────────────────────────────────────────────────────────────

/**
 * Parse a JSON string and validate it as a TrackerState.
 * Returns a Result containing the parsed state or a list of validation errors.
 * On JSON parse failure, returns a single INVALID_JSON error.
 */
export function importJSON(
  json: string
): Result<TrackerState, ValidationError[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      error: [{ field: "root", message: "Invalid JSON", code: "INVALID_JSON" }],
    };
  }

  return validateImport(parsed);
}
