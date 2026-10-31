// A versioned, crash-safe save slot over a string key-value store (localStorage-shaped).
// Knows nothing about what is saved. No network, no clock.
//
// Write order for key K (localStorage has no rename, so promotion is write-then-clean):
//   1. write K.tmp, read it back and confirm it matches   (a failure here changes nothing)
//   2. copy the current K to K.bak, but only if it is itself a good save
//   3. write K                                             (the "rename")
//   4. remove K.tmp
// So K always holds a good save or nothing, and K.bak keeps the previous good one.

/** The subset of the Web Storage API the slot needs. `window.localStorage` fits. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage for tests and for browsers without localStorage. */
export function memoryStorage(): KeyValueStorage & { dump(): Record<string, string> } {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    dump: () => Object.fromEntries(items),
  };
}

export type SlotData = Record<string, unknown>;

/** Upgrades data saved at version N to version N + 1. */
export type Migration = (data: SlotData) => SlotData;

export interface SlotSpec {
  key: string;
  /** The version this build writes. */
  version: number;
  /** migrations[N] upgrades version N to N + 1. Every step from 1 to version - 1 must exist. */
  migrations: Readonly<Record<number, Migration>>;
  isValid(data: SlotData): boolean;
}

export interface Slot {
  /** Atomically replaces the save. Throws, leaving the previous good save, if it cannot. */
  write(data: SlotData): void;
  /** The newest good save (main, else backup), upgraded to the current version, or null. */
  read(): SlotData | null;
  /** Removes the save, its backup and any leftover temp. */
  clear(): void;
}

const isRecord = (value: unknown): value is SlotData =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function withoutVersion(data: SlotData): SlotData {
  const { version: _version, ...rest } = data;
  return rest;
}

export function createSlot(storage: KeyValueStorage, spec: SlotSpec): Slot {
  for (let from = 1; from < spec.version; from++) {
    if (!spec.migrations[from]) {
      throw new Error(`slot ${spec.key}: no migration from version ${from} to ${from + 1}`);
    }
  }
  const tmpKey = `${spec.key}.tmp`;
  const bakKey = `${spec.key}.bak`;

  /** Parses, runs migrations forward one step at a time, validates. Null if unusable. */
  function decode(text: string): { data: SlotData; migrated: boolean } | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    if (!isRecord(parsed)) return null;
    const saved = parsed.version;
    // A save from a newer build, or with no usable version, is not ours to read.
    if (typeof saved !== "number" || !Number.isInteger(saved) || saved < 1 || saved > spec.version) {
      return null;
    }
    try {
      let data: SlotData = parsed;
      for (let version = saved; version < spec.version; version++) {
        data = { ...spec.migrations[version]!(data), version: version + 1 };
      }
      return spec.isValid(data) ? { data, migrated: saved !== spec.version } : null;
    } catch {
      return null;
    }
  }

  function write(data: SlotData): void {
    const record = { ...data, version: spec.version };
    if (!spec.isValid(record)) throw new Error(`slot ${spec.key}: refusing to write invalid data`);
    const text = JSON.stringify(record);
    try {
      storage.setItem(tmpKey, text);
      if (storage.getItem(tmpKey) !== text) {
        throw new Error(`slot ${spec.key}: write could not be confirmed`);
      }
      const previous = storage.getItem(spec.key);
      // Never let a corrupt main file overwrite the last good backup.
      if (previous !== null && decode(previous) !== null) storage.setItem(bakKey, previous);
      storage.setItem(spec.key, text);
    } finally {
      storage.removeItem(tmpKey);
    }
  }

  function read(): SlotData | null {
    for (const key of [spec.key, bakKey]) {
      const text = storage.getItem(key);
      if (text === null) continue;
      const decoded = decode(text);
      if (decoded === null) continue;
      const data = withoutVersion(decoded.data);
      if (decoded.migrated || key === bakKey) {
        // Upgrade in place, or promote the backup. The data is good either way, so a failed
        // write-back (e.g. storage full) must not lose it.
        try {
          write(data);
        } catch {
          /* keep going with the data we have */
        }
      }
      return data;
    }
    return null;
  }

  function clear(): void {
    storage.removeItem(spec.key);
    storage.removeItem(bakKey);
    storage.removeItem(tmpKey);
  }

  return { write, read, clear };
}
