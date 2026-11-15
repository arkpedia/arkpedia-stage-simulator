// SPDX-License-Identifier: GPL-3.0-or-later
// Shared immutable JSON store for stages, operators, summons and model metadata.
export const COMPONENT_BASE = '/data/arkpedia-stage-library/objects/';
export function componentUrl(hash) {
  if (!/^[a-f0-9]{64}$/.test(hash ?? '')) throw Error('Invalid content component reference');
  return `${COMPONENT_BASE}${hash}.json`;
}
/** One bounded cache per loader. Failed requests are evicted and can be retried;
 * concurrent stages share in-flight work. Installed records are independent. */
export function createComponentStore(fetchImpl = fetch, { maxCachedBytes = 16 * 1024 * 1024, concurrency = 6 } = {}) {
  if (!Number.isSafeInteger(maxCachedBytes) || maxCachedBytes < 0 || !Number.isSafeInteger(concurrency) || concurrency < 1)
    throw Error('Invalid component store limits');
  const cache = new Map(), pending = new Map(), queue = [];
  let cachedBytes = 0, active = 0;
  const run = task => new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject }); pump();
  });
  function pump() {
    while (active < concurrency && queue.length) {
      const { task, resolve, reject } = queue.shift(); active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; pump(); });
    }
  }
  async function component(hash) {
    const url = componentUrl(hash), hit = cache.get(hash);
    if (hit) { cache.delete(hash); cache.set(hash, hit); return hit.value; }
    if (pending.has(hash)) return pending.get(hash);
    const request = run(async () => {
      const response = await fetchImpl(url);
      if (!response.ok) throw Error(`Content component unavailable: ${hash}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
      const actual = [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
      if (actual !== hash) throw Error(`Content component checksum mismatch: ${hash}`);
      const value = JSON.parse(new TextDecoder().decode(bytes));
      if (bytes.length <= maxCachedBytes) {
        while (cachedBytes + bytes.length > maxCachedBytes && cache.size) {
          const oldest = cache.keys().next().value; cachedBytes -= cache.get(oldest).bytes; cache.delete(oldest);
        }
        cache.set(hash, { value, bytes: bytes.length }); cachedBytes += bytes.length;
      }
      return value;
    });
    pending.set(hash, request);
    try { return await request; } finally { pending.delete(hash); }
  }
  return { component, stats: () => ({ cachedBytes, cachedObjects: cache.size, pending: pending.size }) };
}
