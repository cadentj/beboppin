import type { Lock, QueueEntry, StateAdapter } from "chat";

type StoredValue = {
  expiresAt?: number;
  value: unknown;
};

export function createMemoryState(): StateAdapter {
  const values = new Map<string, StoredValue>();
  const lists = new Map<string, StoredValue[]>();
  const queues = new Map<string, QueueEntry[]>();
  const locks = new Map<string, Lock>();
  const subscriptions = new Set<string>();

  return {
    async acquireLock(threadId, ttlMs) {
      const existing = locks.get(threadId);
      if (existing && existing.expiresAt > Date.now()) return null;

      const lock = { threadId, token: crypto.randomUUID(), expiresAt: Date.now() + ttlMs };
      locks.set(threadId, lock);
      return lock;
    },

    async appendToList(key, value, options) {
      const list = lists.get(key)?.filter(isFresh) ?? [];
      list.push({ value, expiresAt: expiry(options?.ttlMs) });
      const maxLength = options?.maxLength;
      lists.set(key, maxLength ? list.slice(-maxLength) : list);
    },

    async connect() {},

    async delete(key) {
      values.delete(key);
      lists.delete(key);
    },

    async dequeue(threadId) {
      const queue = queues.get(threadId) ?? [];
      const now = Date.now();
      while (queue.length > 0) {
        const entry = queue.shift();
        if (entry && entry.expiresAt > now) return entry;
      }
      return null;
    },

    async disconnect() {},

    async enqueue(threadId, entry, maxSize) {
      const queue = queues.get(threadId) ?? [];
      queue.push(entry);
      const trimmed = queue.slice(-maxSize);
      queues.set(threadId, trimmed);
      return trimmed.length;
    },

    async extendLock(lock, ttlMs) {
      const existing = locks.get(lock.threadId);
      if (!existing || existing.token !== lock.token) return false;
      existing.expiresAt = Date.now() + ttlMs;
      return true;
    },

    async forceReleaseLock(threadId) {
      locks.delete(threadId);
    },

    async get<T = unknown>(key: string): Promise<T | null> {
      const stored = values.get(key);
      if (!stored || !isFresh(stored)) {
        values.delete(key);
        return null;
      }
      return stored.value as T;
    },

    async getList<T = unknown>(key: string): Promise<T[]> {
      const list = lists.get(key)?.filter(isFresh) ?? [];
      lists.set(key, list);
      return list.map((item) => item.value as T);
    },

    async isSubscribed(threadId) {
      return subscriptions.has(threadId);
    },

    async queueDepth(threadId) {
      return queues.get(threadId)?.length ?? 0;
    },

    async releaseLock(lock) {
      const existing = locks.get(lock.threadId);
      if (existing?.token === lock.token) locks.delete(lock.threadId);
    },

    async set(key, value, ttlMs) {
      values.set(key, { value, expiresAt: expiry(ttlMs) });
    },

    async setIfNotExists(key, value, ttlMs) {
      const existing = values.get(key);
      if (existing && isFresh(existing)) return false;
      values.set(key, { value, expiresAt: expiry(ttlMs) });
      return true;
    },

    async subscribe(threadId) {
      subscriptions.add(threadId);
    },

    async unsubscribe(threadId) {
      subscriptions.delete(threadId);
    },
  };
}

function expiry(ttlMs?: number): number | undefined {
  return ttlMs === undefined ? undefined : Date.now() + ttlMs;
}

function isFresh(stored: StoredValue): boolean {
  return stored.expiresAt === undefined || stored.expiresAt > Date.now();
}
