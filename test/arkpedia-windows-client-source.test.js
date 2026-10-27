// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {crc64XZ,verifyWindowsManifest,verifyWindowsFile} from '../tools/arkpedia/windows-client-source.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
function fixture(){
 const files=['/GameAssembly.dll','/Arknights_Data/il2cpp_data/Metadata/global-metadata.dat'].map((path,i)=>({path,bytes:i+1,crc64XZ:String(i),sha256:'a'.repeat(64)}));
 const manifest={source:'/Arknights_EN-042.0.0-game',file:files.map(f=>({path:f.path,size:String(f.bytes),hash:f.crc64XZ}))};
 const raw=Buffer.from(JSON.stringify(manifest));return{raw,pin:{source:manifest.source,manifest:{bytes:raw.length,sha256:sha(raw)},files},manifest};
}
test('CRC64/XZ matches the published check vector and official tiny app-info receipt',()=>{
 assert.equal(crc64XZ(Buffer.alloc(0)),'0');
 assert.equal(crc64XZ(Buffer.from('123456789')),String(0x995dc9bbdf1939fan));
 assert.equal(crc64XZ(Buffer.from('Yostar\nArknights_EN')),'17703643929757122021');
});
test('manifest verification accepts only the two exact native evidence entries',()=>{
 const {pin,raw,manifest}=fixture();assert.deepEqual(verifyWindowsManifest(pin,raw),manifest);
});
for(const invalid of ['bytes','hash','source','size','crc','sha','extraFile','duplicate','traversal'])test('manifest rejects '+invalid+' without trusting another file identity',()=>{
 const {pin,raw}=fixture();
 if(invalid==='bytes')pin.manifest.bytes++;
 else if(invalid==='hash')pin.manifest.sha256='0'.repeat(64);
 else if(invalid==='source')pin.source='/../../another';
 else if(invalid==='size')pin.files[0].bytes++;
 else if(invalid==='crc')pin.files[0].crc64XZ='changed';
 else if(invalid==='sha')pin.files[0].sha256='invalid';
 else if(invalid==='extraFile')pin.files.push({...pin.files[0],path:'/Arknights.exe'});
 else if(invalid==='duplicate')pin.files[1]={...pin.files[0]};
 else pin.files[0].path='/../GameAssembly.dll';
 assert.throws(()=>verifyWindowsManifest(pin,raw));
});
test('native bytes need all three independent size, publisher CRC and retained SHA checks',()=>{
 const raw=Buffer.from('native fixture'),pin={bytes:raw.length,crc64XZ:crc64XZ(raw),sha256:sha(raw)};
 verifyWindowsFile(pin,raw);
 for(const field of ['bytes','crc64XZ','sha256'])assert.throws(()=>verifyWindowsFile({...pin,[field]:field==='bytes'?pin.bytes+1:'changed'},raw));
 const changed=Buffer.from(raw);changed[0]^=1;assert.throws(()=>verifyWindowsFile(pin,changed));
});
test('static extraction binds wrapper field type, enum values and complete native method chunks',()=>{
 const c=read('data/candidates/arkpedia-windows-ability-events-source.json');
 for(const p of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 assert.equal(c.metadataVersion,29);assert.equal(c.event.owner,'Torappu.Battle.AbilityStandard');
 assert.equal(c.event.fields.find(f=>f.name==='ON_SPELL_END').value,5);
 const field=c.wrapper.fields.find(f=>f.name==='_runActionOnEvent');assert.equal(field.typeData,c.event.typeIndex);assert.equal(field.offset,48);
 assert.equal(c.wrapper.hotfixEventField.name,'__Hotfix0_OnEvent');assert.equal(c.wrapper.hotfixEventField.offset,24);
 const native=JSON.parse(c.wrapper.nativeOriginalJson);assert.equal(native._runActionOnEvent,5);assert.equal(native._extraCondition,0);assert.equal(native._onlyRunOnce,0);
 assert.equal(native._buffs[0].buffKey,'fearpj_m0_t[switch_to_die]');
 for(const method of c.methods)for(const chunk of method.chunks){const raw=Buffer.from(chunk.base64,'base64');assert.equal(raw.length,chunk.endRva-chunk.beginRva);assert.equal(sha(raw),chunk.sha256);}
 const handler=c.methods.find(m=>m.type==='BuffToOwner'&&m.name==='OnEvent');
 assert.ok(handler.chunks.length>1,'chained hot/cold ranges must not be truncated to the first unwind entry');
 const instructions=handler.chunks.flatMap(c=>c.instructions);
 assert.ok(instructions.some(i=>i.mnemonic==='cmp'&&i.operands==='ebp, dword ptr [rbx + 0x30]'));
 const add=c.methods.find(m=>m.type==='BuffToOwner'&&m.name==='_AddBuffs');
 assert.ok(instructions.some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+add.entryRva).toString(16)));
});
test('new compiled evidence grants neither runtime/frame parity nor enemy/stage admission',()=>{
 const c=read('data/candidates/arkpedia-windows-ability-events-source.json');
 for(const field of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[field],false);
 const support=read('data/candidates/arkpedia-ch16-enemy-support.json'),stages=read('data/arkpedia-stages.json');
 assert.equal(support.enemies.enemy_10128_fearpj.policy,null);assert.equal(support.enemies.enemy_3010_mcreep_a,undefined);
 assert.equal(stages.stages.some(s=>s.code==='16-9'),false);
});
