// SPDX-License-Identifier: GPL-3.0-or-later
// Retain exact event clocks from one or several skeletons in a verified CN bundle.
// --enemies enemy_id=object_id,enemy_id=object_id extracts a family in one load.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CN_NATIVE_PIN, parsePinnedCNManifest } from './cn-native-source.mjs';
import { parseSkel } from '../assets/skel.mjs';
import { writeJSONAtomic } from './write-json.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((arg, at, all) => arg.startsWith('--') ? [arg.slice(2), all[at+1]] : []).filter(row=>row.length));
for(const key of ['bundle','out']) if(!args[key])throw Error(`Missing --${key}`);
if (args.enemies && (args.enemy || args['skeleton-data'])) throw Error('Use --enemies or --enemy/--skeleton-data');
const specs = args.enemies ? args.enemies.split(',').map(pair => pair.split('=')) : [[args.enemy, args['skeleton-data']]];
if (!specs.length || new Set(specs.map(p => p[0])).size !== specs.length
  || specs.some(p => p.length !== 2 || !/^(?:enemy|trap)_[\w]+$/.test(p[0] ?? '') || !/^-?\d+$/.test(p[1] ?? '')))
  throw Error('Invalid or duplicate enemy/object identity');
const cache=join(root,'.cache/arkpedia/cn-native-source');
const manifest=parsePinnedCNManifest(await readFile(join(cache,'hot_update_list.json')));
const row=manifest.abInfos.find(row=>row.name===args.bundle);
if(!row || row.name.split('/').some(part=>part==='..'))throw Error('Bundle is not in the pinned manifest');
const path=join(cache,'bundles',row.name),raw=await readFile(path);
const hash=(alg,bytes)=>createHash(alg).update(bytes).digest('hex');
if(raw.length!==row.abSize || hash('md5',raw)!==row.md5)throw Error('Original animation bundle hash mismatch');
const script=String.raw`
import sys,json,base64
sys.path.insert(0,sys.argv[1]);import aklz4,UnityPy
by={o.path_id:o for o in UnityPy.load(sys.argv[2]).objects}
out=[]
for name,obj in json.loads(sys.argv[3]):
 asset=by[int(obj)].read_typetree()
 assert asset['m_Name']==name+'_SkeletonData'
 ref=asset['skeletonJSON'];assert ref['m_FileID']==0
 text=by[ref['m_PathID']].read();assert text.m_Name in (name+'.skel',name)
 raw=text.m_Script.encode('utf8','surrogateescape') if isinstance(text.m_Script,str) else text.m_Script
 out.append({'skeletonPathId':str(ref['m_PathID']),'base64':base64.b64encode(raw).decode()})
print(json.dumps(out))
`;
const extracted=JSON.parse(execFileSync(process.env.ARKPEDIA_PYTHON??'python3',['-c',script,
  join(root,'tools/local-extract'),path,JSON.stringify(specs)],{encoding:'utf8',maxBuffer:16*1024*1024}));
// A JSON skeleton (newer bundles ship some enemies this way): a clip lasts until its last key; its events are listed.
function parseJsonSkeleton(bytes){
  const doc=JSON.parse(bytes.toString('utf8')),exactDurations={},eventPayloads={};
  const last=v=>Array.isArray(v)?v.reduce((n,x)=>Math.max(n,last(x)),0):v&&typeof v==='object'?Object.entries(v).reduce((n,[k,x])=>Math.max(n,k==='time'&&typeof x==='number'?x:last(x)),0):0;
  for(const [name,clip] of Object.entries(doc.animations??{})){
    exactDurations[name]=last(clip);
    if(clip.events?.length)eventPayloads[name]=clip.events.map(e=>({time:e.time??0,name:e.name,int:e.int??0,float:e.float??0,string:e.string??''}));
  }
  return {version:doc.skeleton?.spine,exactDurations,eventPayloads};
}
const enemies = Object.fromEntries(specs.map(([enemy, object], i) => {
  const bytes=Buffer.from(extracted[i].base64,'base64');
  const parsed=bytes[0]===0x7b?parseJsonSkeleton(bytes):parseSkel(bytes,undefined,{includeEventPayloads:true,includeExactDurations:true});
  return [enemy, {schemaVersion:1,enemy,
    source:{...CN_NATIVE_PIN,bundle:{path:row.name,bytes:raw.length,md5:row.md5,sha256:hash('sha256',raw)},
      skeletonDataPathId:object,skeletonPathId:extracted[i].skeletonPathId,bytes:bytes.length,sha256:hash('sha256',bytes)},
    scope:'Exact original skeleton event payloads and durations; no claim of compiled controller or client-frame parity.',
    version:parsed.version,durations:parsed.exactDurations,events:parsed.eventPayloads}];
}));
const result = args.enemies ? { schemaVersion: 1, enemies } : enemies[args.enemy];
if (process.argv.includes('--check')) {
  if (JSON.stringify(JSON.parse(await readFile(resolve(args.out), 'utf8'))) !== JSON.stringify(result))
    throw Error(`Changed ${specs.map(p => p[0]).join(", ")} event clocks`);
} else await writeJSONAtomic(resolve(args.out), result);
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Retained'} ${specs.map(p => p[0]).join(', ')} event clocks`);
