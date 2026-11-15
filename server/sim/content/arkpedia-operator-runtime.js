// SPDX-License-Identifier: GPL-3.0-or-later
import { OPERATOR_RUNTIME_INDEX } from './arkpedia-operator-runtime-index.js';
import { OPERATOR_SERVICE_INDEX } from './arkpedia-operator-service-index.js';
const selectedBy = (entry, ids) => entry.ids ? entry.ids.some(id => ids.has(id)) : !entry.id || ids.has(entry.id);
const serviceFallbacks = Object.freeze({ noop: () => undefined, zero: () => 0, cost: (_battle, _id, cost) => cost,
  required: () => { throw Error('Operator service requires its selected owner'); } });

/** Loading is asynchronous; dispatch stays synchronous and preserves source
 * registration order. No missing adapter can silently fall back to a generic kit. */
export function createOperatorRuntime(index = [...OPERATOR_RUNTIME_INDEX, ...OPERATOR_SERVICE_INDEX]) {
  const loaded = new Map(), pending = new Map();
  const load = entry => {
    if (loaded.has(entry.key)) return Promise.resolve();
    if (pending.has(entry.key)) return pending.get(entry.key);
    const promise = Promise.resolve().then(entry.load).then(module => {
      for (const name of [...Object.values(entry.hooks), ...Object.keys(entry.services ?? {})]) if (typeof module[name] !== 'function')
        throw Error(`Missing operator runtime export: ${entry.key}/${name}`);
      loaded.set(entry.key, module);
    }).finally(() => pending.delete(entry.key));
    pending.set(entry.key, promise); return promise;
  };
  const invoke = (entry, hook, context) => {
    const id = context.id ?? context.def?.charId ?? context.def?.id;
    if (!entry.hooks[hook] || entry.id && entry.id !== id || entry.ids && !entry.ids.includes(id)) return;
    const module = loaded.get(entry.key);
    if (!module) throw Error(`Operator runtime must be prepared: ${entry.key}`);
    module[entry.hooks[hook]](context);
  };
  const adapters = Object.freeze(index.map(entry => Object.freeze({ key: entry.key,
    ...Object.fromEntries(Object.keys(entry.hooks).map(hook => [hook, context => invoke(entry, hook, context)])) })));
  const runtime = {
    async prepare(ids) {
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw Error('Expected operator runtime identities');
      const selected = new Set(ids);
      await Promise.all(index.filter(entry => selectedBy(entry, selected)).map(load));
      return runtime;
    },
    assertPrepared(ids) {
      const selected = new Set(ids);
      for (const entry of index) if (selectedBy(entry, selected)
        && !loaded.has(entry.key)) throw Error(`Operator runtime must be prepared: ${entry.key}`);
    },
    servicesFor(ids) {
      const selected = new Set(ids), services = {};
      for (const entry of index) for (const [name, fallback] of Object.entries(entry.services ?? {})) {
        if (Object.hasOwn(services, name)) throw Error(`Duplicate operator service: ${name}`);
        if (!serviceFallbacks[fallback]) throw Error(`Unknown operator service fallback: ${fallback}`);
        if (selectedBy(entry, selected)) {
          const module = loaded.get(entry.key);
          if (!module) throw Error(`Operator runtime must be prepared: ${entry.key}`);
          services[name] = module[name];
        } else services[name] = serviceFallbacks[fallback];
      }
      // Bind to this squad, not the cumulative browser module cache. A previous
      // selection must never give the next battle its squad-wide talents.
      return Object.freeze(services);
    },
    adapters,
    customize: context => { for (const adapter of adapters) adapter.customize?.(context); },
    install: context => { for (const adapter of adapters) adapter.install?.(context); },
    stats: () => ({ loaded: [...loaded.keys()], pending: pending.size }),
  };
  return Object.freeze(runtime);
}

// Node callers retain the synchronous constructor used by compiler tools and
// tests. Browsers/workers explicitly prepare selected adapters before battle.
// A dynamic import keeps this eager compatibility path out of the browser graph.
const eager = typeof process !== 'undefined' && process.versions?.node
  ? await import('./arkpedia-operator-runtime-eager.js') : null;
const eagerServices = eager ? createOperatorRuntime(OPERATOR_SERVICE_INDEX) : null;
if (eagerServices) await eagerServices.prepare(OPERATOR_SERVICE_INDEX.flatMap(entry => entry.ids));
const browserRuntime = createOperatorRuntime();
export function operatorServicesFor(ids, runtime = null) {
  return (runtime ?? eagerServices ?? browserRuntime).servicesFor(ids);
}
export const REGULAR_OPERATOR_ADAPTERS = eager?.REGULAR_OPERATOR_ADAPTERS ?? browserRuntime.adapters;
export const prepareRegularOperatorRuntime = ids => browserRuntime.prepare(ids);
export function customizeRegularOperator(context) {
  const runtime = context.battle?.operatorRuntime;
  if (runtime) runtime.customize(context);
  else if (eager) eager.customizeRegularOperator(context);
  else browserRuntime.customize(context);
}
export function installRegularOperator(context) {
  const runtime = context.battle?.operatorRuntime;
  if (runtime) runtime.install(context);
  else if (eager) eager.installRegularOperator(context);
  else browserRuntime.install(context);
}
