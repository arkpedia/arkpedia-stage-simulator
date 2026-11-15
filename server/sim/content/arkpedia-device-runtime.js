// SPDX-License-Identifier: GPL-3.0-or-later
import {DEVICE_RUNTIME_INDEX} from './arkpedia-device-runtime-index.js';
/** Cache modules across stages, but decide controller ownership anew for every
 * battle. Previous selections never install their hooks into the next battle. */
export function createDeviceRuntime(index=DEVICE_RUNTIME_INDEX){
  const entries=new Map(),loaded=new Map(),pending=new Map();
  for(const entry of index){if(entries.has(entry.key))throw Error(`Duplicate device runtime: ${entry.key}`);entries.set(entry.key,entry);}
  const load=entry=>{
    if(loaded.has(entry.key))return Promise.resolve();
    if(pending.has(entry.key))return pending.get(entry.key);
    const promise=Promise.resolve().then(entry.load).then(module=>{
      if(typeof module[entry.exportName]!=='function')throw Error(`Missing device runtime export: ${entry.key}/${entry.exportName}`);
      loaded.set(entry.key,module);
    }).finally(()=>pending.delete(entry.key));
    pending.set(entry.key,promise);return promise;
  };
  const runtime={
    async prepare(stage){await Promise.all(index.filter(e=>e.selected(stage)).map(load));return runtime;},
    async prepareAll(){await Promise.all(index.map(load));return runtime;},
    assertPrepared(stage){for(const e of index)if(e.selected(stage)&&!loaded.has(e.key))throw Error(`Device runtime must be prepared: ${e.key}`);},
    create(key,b,stage){
      const entry=entries.get(key);if(!entry)throw Error(`Unknown device runtime: ${key}`);
      if(!entry.selected(stage))return null;
      const module=loaded.get(key);if(!module)throw Error(`Device runtime must be prepared: ${key}`);
      return entry.create(module,b,stage);
    },
    stats:()=>({loaded:[...loaded.keys()],pending:pending.size}),
  };
  return Object.freeze(runtime);
}
const defaultRuntime=createDeviceRuntime();
if(typeof process!=='undefined'&&process.versions?.node)await defaultRuntime.prepareAll();
export const deviceRuntimeFor=runtime=>runtime??defaultRuntime;
export const prepareRegularDeviceRuntime=stage=>defaultRuntime.prepare(stage);
