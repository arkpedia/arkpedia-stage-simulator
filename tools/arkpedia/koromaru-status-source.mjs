// SPDX-License-Identifier: GPL-3.0-or-later
// Recover numeric facts, not client method bodies, from a pinned field dump.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const STATUS_DUMP_PIN=Object.freeze({repository:'Tim23333/Arknights_timer',commit:'2e5c4306e4949fb6b15f990e34a9c69053be3327',path:'game_data/reference/android_arm64/dump.cs',gitBlob:'7710a073d52ced520aee1e6950dc1132fab70211',bytes:166296,sha256:'0cd60676fa4f3f47bcc5d1b9e3296a28d96d537974956b841050bdc515b2fdb4'});
const digest=(algorithm,b)=>createHash(algorithm).update(b).digest('hex');
export function parseAbnormalFlags(text){
 const matches=[...text.matchAll(/\/\/ Namespace: Torappu\s+public enum AbnormalFlag\s*\{([^}]+)\}/g)];
 assert.equal(matches.length,1,'Exactly one Torappu AbnormalFlag definition required');
 const definitions={};
 for(const line of matches[0][1].trim().split(/\r?\n/)){
  const m=/^\s*public const AbnormalFlag ([A-Z][A-Z0-9_]*) = (\d+);\s*$/.exec(line);assert.ok(m,'Nonliteral enum field');
  assert.equal(Object.hasOwn(definitions,m[1]),false,'Duplicate enum name');assert.equal(Object.values(definitions).includes(+m[2]),false,'Duplicate enum value');definitions[m[1]]=+m[2];
 }
 assert.equal(definitions.E_NUM,Object.keys(definitions).length-1,'Incomplete enum');return definitions;
}
export async function recoverStatus({read=readFile}={}){
 const bytes=await read(new URL('../../.cache/arkpedia/cn-native-source/status-enums-dump.cs',import.meta.url));
 assert.equal(bytes.length,STATUS_DUMP_PIN.bytes);assert.equal(digest('sha256',bytes),STATUS_DUMP_PIN.sha256);
 assert.equal(digest('sha1',Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])),STATUS_DUMP_PIN.gitBlob,'Raw CRLF Git blob must match');
 const all=parseAbnormalFlags(bytes.toString('utf8')),definitions=Object.fromEntries(['STUNNED','TARGET_FREE','BLOCK_FREE','INVINCIBLE','FROZEN','FEARED','E_NUM'].map(k=>[k,all[k]]));
 assert.deepEqual(Object.values(definitions),[0,2,3,5,16,33,46]);
 const raw=await read(new URL('../../data/arkpedia-native-operators/char_4220_kormr.json',import.meta.url));
 assert.equal(digest('sha256',raw),'d1c567412953bbf4e6b71dbe289cc5b079eebb7bb581a660282e6fdc428e1d0b');
 const native=JSON.parse(raw),c=native.characters.char_4220_kormr.flatMap(r=>r.components).find(c=>c.pathId==='-8040428613128700152').data._buffs[0];
 assert.deepEqual(c.attributes.abnormalFlags,[all.INVINCIBLE,all.TARGET_FREE,all.BLOCK_FREE]);assert.deepEqual(c.attributes.abnormalImmunes,[all.STUNNED,all.FROZEN]);
 assert.equal(c.templateKey,'kormr_in_start');assert.equal(native.templates.kormr_in_start.eventToActions.ON_BUFF_START[0]._target,'BUFF_OWNER');
 return{operator:'char_4220_kormr',source:{...STATUS_DUMP_PIN,url:`https://github.com/${STATUS_DUMP_PIN.repository}/blob/${STATUS_DUMP_PIN.commit}/${STATUS_DUMP_PIN.path}`,versionLimit:'The reference describes its input as the current Android APK without a client version. Numeric definitions corroborate the separately pinned Koromaru prefab; this is not proof of identical client version, compiled methods or game frames.'},definitions,foundationSha256:digest('sha256',raw),startup:{component:'-8040428613128700152',flags:c.attributes.abnormalFlags,flagNames:['INVINCIBLE','TARGET_FREE','BLOCK_FREE'],immunes:c.attributes.abnormalImmunes,immuneNames:['STUNNED','FROZEN'],template:c.templateKey,releaseBlockerTarget:'BUFF_OWNER'},enabledOperators:[],frameParity:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const output=new URL('../../data/arkpedia-koromaru-status-source.json',import.meta.url),bytes=JSON.stringify(await recoverStatus(),null,2)+'\n';if(process.argv.includes('--write'))await writeFile(output,bytes);else assert.equal(await readFile(output,'utf8'),bytes);console.log('Pinned status definitions and original Koromaru startup flags verified.');}
