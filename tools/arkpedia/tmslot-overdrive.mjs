// SPDX-License-Identifier: GPL-3.0-or-later
// Reproduce a selected native term without claiming compiled timing parity.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const source=Object.freeze({repository:'Kengxxiao/ArknightsGameData',commit:'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add',
 path:'zh_CN/gamedata/excel/gamedata_const.json',bytes:57803,gitBlob:'ab3b249f3116650c630859104c97f18289fb1a54',
 sha256:'216985a6185c199ee703eac1fb8c35f51ca6d45141894df9c1fd9397b6c940ee'});
const mapping='The selected forty-second duration is the full two-bar window. Natural overload begins at twenty seconds. A marked target leaving range skips remaining first-phase time and leaves at most twenty seconds. This duration-to-two-bar accounting and compiled ForceEnterSkillOverloadProgress ordering remain explicit local mappings.';
export async function recoverTimeslotOverdrive({read=readFile}={}){
 const b=await read(new URL('../../.cache/arkpedia/cn-operators/char_4236_tmslot/gamedata_const.json',import.meta.url));
 assert.equal(b.length,source.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),source.sha256);
 assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),source.gitBlob);
 const term=JSON.parse(b).termDescriptionDict['ba.overdrive'];assert.equal(term.termId,'ba.overdrive');
 return{schemaVersion:1,source,term,mapping,frameParity:false,enabledOperators:[]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const output=new URL('../../data/arkpedia-tmslot-overdrive-source.json',import.meta.url),bytes=JSON.stringify(await recoverTimeslotOverdrive(),null,2)+'\n';
 if(process.argv.includes('--write'))await writeFile(output,bytes);else assert.equal(await readFile(output,'utf8'),bytes);
 console.log('Original pinned overdrive term reproduced; duration/FSM mapping and game-frame parity remain separate.');
}
