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

const castPath='data/candidates/arkpedia-windows-cast-lifecycle-source.json';
const minerTalentsPath='data/candidates/arkpedia-windows-miner-talents-source.json';
const fearSelectorPath='data/candidates/arkpedia-windows-fear-selector-source.json';
const priorityPath='data/candidates/arkpedia-windows-filter-priority-source.json';
const projectilePath='data/candidates/arkpedia-windows-fear-projectile-source.json';
const instructions=method=>method.chunks.flatMap(c=>c.instructions);
const castMethod=(c,type,name)=>{
 const matches=c.methods.filter(m=>m.type===type&&m.name===name);assert.equal(matches.length,1);return matches[0];
};

test('fear projectile source pins complete native methods and exact original script references',()=>{
 const c=read(projectilePath);assert.equal(c.methods.length,66);
 for(const p of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 for(const method of [...c.methods,c.lifeValueLeaf,c.expiryComparisonLeaf])for(const chunk of method.chunks){
  const raw=Buffer.from(chunk.base64,'base64');assert.equal(raw.length,chunk.endRva-chunk.beginRva);assert.equal(sha(raw),chunk.sha256);
 }
 const [simple,hit]=c.prefabScriptBridges;
 assert.equal(simple.scriptIdentity.m_ClassName,'SimpleProjectile');assert.equal(simple.serializedFieldParity,true);
 assert.equal(hit.scriptIdentity.m_ClassName,'HitBehaviour');assert.equal(hit.serializedFieldParity,false);
 assert.deepEqual(hit.unmatchedSerializedFields,{_exceptFlyCharacter:0});
 for(const field of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[field],false);
});

test('ordinary projectile birth preprocesses the existing ability action list before registration',()=>{
 const c=read(projectilePath),p=c.preprocessing;
 assert.equal(p.getActionsSlot.slot,45);assert.equal(p.getActionsSlot.name,'GetProjectileActions');
 assert.equal(p.getActionsSlot.declaringType,'RangedAttack');
 assert.equal(p.preprocessSlot.slot,65);assert.equal(p.preprocessSlot.name,'PreprocessActionsForProjectile');
 assert.equal(p.preprocessSlot.declaringType,'Ability');
 assert.equal(p.actionListField.name,'m_actions');assert.equal(p.actionListField.offset,0x1f8);
 assert.equal(p.independentDamageNodePerProjectileVerified,false);
 for(const binding of p.interfaceBindings){
  assert.equal(binding.encodedUsage>>>29,1);assert.equal(binding.namespace,'Torappu.Battle.Action');
  assert.equal(binding.name,'IDamageOrHealSourceNode');
  assert.deepEqual(binding.methods.map(m=>m.name),['get_purposeMask','PreprocessForProjectile']);
 }
 const calls=(m,rva)=>instructions(m).some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+rva).toString(16));
 const create=castMethod(c,'BattleController','CreateProjectile');
 assert.ok(calls(castMethod(c,'RangedAttack','CreateProjectile'),create.entryRva));
 const root=c.methods.find(m=>m.type==='Projectile'&&m.name==='Init'&&m.entryRva===p.rootInitEntryRva);
 assert.ok(root);assert.ok(calls(create,root.entryRva));
 const init=castMethod(c,'ActionController','Init'),register=castMethod(c,'ActionController','RegisterActions');
 assert.ok(calls(root,init.entryRva));
 const at=(m,rva,op)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===op));
 at(init,0x6a1563,'ecx, 0x2d');at(init,0x6a1571,'0x18000e9b0');
 at(init,0x6a157e,'r8, rax');assert.ok(calls(init,register.entryRva));
 const get=castMethod(c,'RangedAttack','GetProjectileActions');
 at(get,0xbfb79d,'edi, edi');at(get,0xbfb7ba,'rdi, qword ptr [rbx + 0x1f8]');
 at(get,0xbfb7ce,'rdx, rdi');at(get,0xbfb7db,'qword ptr [rax + 0x548]');
 at(get,0xbfb7e1,'rax, qword ptr [rbx + 0x1f8]');
 const preprocess=castMethod(c,'Ability','PreprocessActionsForProjectile');
 assert.ok(calls(preprocess,castMethod(c,'Ability','get_owner').entryRva));
 at(preprocess,0x390fc2e,'ecx, 1');at(preprocess,0x390fc33,'r9, r15');
 at(preprocess,0x390fc39,'0x180004cc0');
 const explicit=castMethod(c,'Projectile','RegisterActions');
 at(explicit,0x67b315,'byte ptr [rsp + 0x90], r14b');
 at(explicit,0x67b31d,'0x18067b3fc');
 assert.ok(calls(explicit,castMethod(c,'Projectile','get_source').entryRva));
 at(explicit,0x67b3dd,'ecx, 1');at(explicit,0x67b3e8,'0x180004cc0');
 assert.ok(calls(explicit,register.entryRva));
 assert.ok(!calls(register,preprocess.entryRva));
 assert.ok(!instructions(register).some(i=>i.operands==='0x180004cc0'));
});

test('movement evidence retains full chained ranges and separates both bounded switch tables from code',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-movement-source.json');
 assert.equal(c.methods.length,31);
 for(const p of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 const component=c.component,native=JSON.parse(component.originalJson);
 assert.equal(component.scriptIdentity.m_ClassName,'AdvancedMovement');assert.equal(component.serializedFieldParity,false);
 assert.equal(sha(component.originalJson),component.componentSha256);
 assert.equal(native._moveType,1);assert.equal(native._speed,10);assert.equal(native._useDynamicSpeed,0);
 assert.equal(c.moveType.fields.find(f=>f.value===1).name,'TRACE_TARGET_WITH_SPEED');
 assert.deepEqual(component.unmatchedSerializedFields,Object.fromEntries([
  '_adjustSourceToTargetArcAngleBySourceFace','_drawFuncTurnAndWaveDebugLine','_fixProjectileHasReached',
  '_fixProjectileZWhenReached','_rotateToTargetOnDelayToStart','_sourceToTargetArcAngle'].map(k=>[k,0])));
 for(const field of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[field],false);
 for(const m of c.methods)for(const ch of m.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(raw.length,ch.endRva-ch.beginRva);assert.equal(sha(raw),ch.sha256);
 }
 for(const [name,chunkCount,tableRva,selectedTarget] of [
  ['OnInit',6,0xa7c780,0xa7c3aa],['OnTick',10,0xa7d598,0xa7ca2c]]){
  const m=castMethod(c,'AdvancedMovement',name);assert.equal(m.chunks.length,chunkCount);
  const chunks=m.chunks.filter(ch=>ch.jumpTable);assert.equal(chunks.length,1);
  const ch=chunks[0],table=ch.jumpTable,raw=Buffer.from(ch.base64,'base64');
  assert.equal(table.beginRva,tableRva);assert.equal(table.endRva,ch.endRva);
  assert.equal(table.count,6);assert.equal(table.entryBytes,4);assert.equal(table.indexBias,-1);
  assert.equal(table.targetRvas[native._moveType-1],selectedTarget);
  const code=raw.subarray(0,ch.codeRange.endRva-ch.beginRva),bytes=raw.subarray(code.length);
  assert.equal(sha(code),ch.codeRange.sha256);assert.equal(sha(bytes),table.sha256);
  assert.equal(bytes.length,24);assert.deepEqual(Array.from({length:6},(_,i)=>bytes.readUInt32LE(i*4)),table.targetRvas);
  const at=new Map(instructions(m).map(i=>[i.rva,i]));
  for(const target of table.targetRvas)assert.ok(at.has(target));
  for(const dispatch of m.dispatcher){const i=at.get(dispatch.rva);assert.equal(i.mnemonic,dispatch.mnemonic);assert.equal(i.operands,dispatch.operands);}
  assert.equal(m.dispatcher.find(i=>i.mnemonic==='cmp').operands,'eax, 5');
  for(const chunk of m.chunks){
   let cursor=chunk.beginRva;
   for(const i of chunk.instructions){assert.equal(i.rva,cursor);cursor+=i.size;}
   assert.equal(cursor,chunk.codeRange?.endRva??chunk.endRva);
  }
 }
});

test('movement arrival dispatch precedes trace clearing and preserves both once-only guards',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-movement-source.json');
 assert.deepEqual(c.resolvedSlots.map(s=>[s.slot,s.declaringType,s.name]),[
  [19,'AdvancedMovement','DoCheckReached'],[21,'BasicMovement','DealReached'],
  [22,'AdvancedMovement','DoCheckReachedInternal'],[23,'BasicMovement','GetTraceTargetMapPosition'],
  [30,'AdvancedMovement','GetSpeed']]);
 const code=(type,name)=>instructions(castMethod(c,type,name));
 const at=(type,name,rva,args)=>assert.ok(code(type,name).some(i=>i.rva===rva&&i.operands===args));
 const check=code('AdvancedMovement','DoCheckReached');
 const index=address=>check.findIndex(i=>i.mnemonic==='call'&&i.operands===address);
 assert.ok(index('0x180662260')>=0&&index('0x180662260')<index('0x180678500'));
 at('BasicMovement','CheckReached',0x66229f,'byte ptr [rbx + 0x64], cl');
 at('BasicMovement','CheckReached',0x6622b2,'ecx, 0x16');
 at('AdvancedMovement','DoCheckReachedInternal',0xa7bb07,'qword ptr [rax + 0x288]');
 at('BasicMovement','DealReached',0x66233f,'byte ptr [rbx + 0x64], cl');
 at('BasicMovement','DealReached',0x66234a,'byte ptr [rbx + 0x64], 1');
 at('BasicMovement','DealReached',0x6624f7,'0x1806a8d50');
 at('Behaviour','Reached',0x6a8de0,'0x18067a800');
 at('Projectile','OnProjectileReached',0x67a8da,'byte ptr [rbx + 0xa6], 0');
 at('Projectile','OnProjectileReached',0x67a8e5,'byte ptr [rbx + 0xa6], 1');
 at('Projectile','OnProjectileReached',0x67a8ef,'0x180678290');
 at('AdvancedMovement','DoCheckReached',0xa7bc34,'r8d, byte ptr [rsi + 0xd4]');
 at('Projectile','EnsureLifeTime',0x6785a9,'bpl, bpl');
 at('Projectile','EnsureLifeTime',0x6785c6,'rcx, [rsi + 0x110]');
 at('BasicMovement','OnProjectileReached',0x6635d9,'byte ptr [rbx + 0x47], 0');
 at('BasicMovement','OnProjectileReached',0x6635df,'byte ptr [rbx + 0x64], 0');
 at('BasicMovement','OnProjectileReached',0x6635e5,'byte ptr [rbx + 0x64], 1');
 assert.equal(c.fields.BasicMovement.find(f=>f.name==='m_reachedTarget').offset,0x64);
 const target=code('BasicMovement','GetTraceTargetMapPosition');
 assert.ok(target.some(i=>i.rva===0x662a93&&i.operands==='0x18477cd80'));
 assert.ok(target.some(i=>i.rva===0x662a9c&&i.operands==='xmm0, qword ptr [rbx + 0x58]'));
 assert.equal(c.fields.BasicMovement.find(f=>f.name==='m_targetPos').offset,0x58);
 at('AdvancedMovement','GetSpeed',0xa7bd7f,'xmm0, xmm6');
});

test('arrival completion binds its actual delegate and complete stop-or-comeback leaf',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-movement-source.json'),m=c.completionCallback;
 assert.equal(m.name,'<_UpdateAfterReach>b__75_0');assert.equal(m.encodedUsage>>>29,3);
 assert.equal((m.encodedUsage&0x1ffffffe)>>>1,m.index);assert.equal(m.delegateLoadRva,0xa7d83c);
 const ch=m.chunks[0],raw=Buffer.from(ch.base64,'base64');
 assert.equal(ch.unwindRva,null);assert.equal(raw.length,ch.endRva-ch.beginRva);assert.equal(sha(raw),ch.sha256);
 let cursor=ch.beginRva;for(const i of ch.instructions){assert.equal(i.rva,cursor);cursor+=i.size;}
 assert.equal(cursor,ch.endRva);
 assert.deepEqual(ch.instructions.map(i=>i.mnemonic),['cmp','je','cmp','jne','xor','jmp','xor','jmp']);
 assert.equal(ch.instructions[0].operands,'byte ptr [rcx + 0xc0], 0');
 assert.equal(ch.instructions[2].operands,'byte ptr [rcx + 0x108], 0');
 assert.equal(ch.instructions.at(-1).operands,'0x1806a8e00');
 assert.equal(c.fields.AdvancedMovement.find(f=>f.name==='_comeBack').offset,0xc0);
 assert.equal(c.fields.AdvancedMovement.find(f=>f.name==='m_isComeBack').offset,0x108);
 const native=JSON.parse(c.component.originalJson);assert.equal(native._comeBack,0);
 assert.ok(instructions(castMethod(c,'Behaviour','Stop')).some(i=>i.mnemonic==='jmp'&&i.operands==='0x18067c030'));
});

test('completion delay retains its concrete usage, canonical reference bodies and minimum-one-frame float waiter',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-movement-source.json'),d=c.completionDelay;
 assert.equal(d.encodedUsage>>>29,6);assert.equal((d.encodedUsage&0x1ffffffe)>>>1,d.concreteSpecification.index);
 assert.equal(d.concreteSpecification.declaringType,'AsyncUtil');
 assert.equal(d.concreteSpecification.definition.name,'InvokeAsyncFixedSeconds');
 assert.equal(d.concreteSpecification.instantiations.method.arguments[0].name,'AdvancedMovement');
 assert.equal(d.concreteSpecification.nativeMapping,null);assert.equal(d.concreteContextVerified,false);
 assert.equal(d.genericPointerTableRva,0x6ae7d00);assert.equal(d.pointerAnchors.length,2);
 assert.deepEqual(d.canonicalBodies.map(m=>[m.index,m.entryRva]),[
  [207531,0x3f2bbf0],[207539,0x3f2bf40],[2813,0x4695170]]);
 assert.deepEqual(d.canonicalBodies[0].definition,d.concreteSpecification.definition);
 for(const m of d.canonicalBodies){
  assert.equal(Object.values(m.instantiations)[0].arguments[0].name,'Object');
  for(const ch of m.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(raw.length,ch.endRva-ch.beginRva);assert.equal(sha(raw),ch.sha256);}
 }
 const moveNext=instructions(d.canonicalBodies[2]);
 assert.ok(moveNext.some(i=>i.rva===0x469518e&&i.operands==='0x183956c10'));
 assert.ok(moveNext.some(i=>i.rva===0x46951a2&&i.operands==='al, 1'));
 const wait=instructions(castMethod(c,'<WaitForFixedSeconds>d__0','MoveNext'));
 const at=(rva,args)=>assert.ok(wait.some(i=>i.rva===rva&&i.operands===args));
 at(0x396b428,'edi, 1');at(0x396b45d,'xmm6, xmm0');
 at(0x396b46b,'eax, edi');at(0x396b46d,'eax, edi');
 at(0x396b475,'dword ptr [rbx + 0x24], eax');at(0x396b478,'dword ptr [rbx + 0x28], 0');
 at(0x396b485,'dword ptr [rbx + 0x28]');at(0x396b4cc,'eax, dil');
 assert.equal(d.floatWaiterFields.find(f=>f.name==='<frameCnt>5__2').offset,0x24);
 assert.equal(d.floatWaiterFields.find(f=>f.name==='<frameI>5__3').offset,0x28);
});

test('arrival tolerance is a separately image-bound inclusive three-dimensional float32 distance',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-movement-source.json'),t=c.arrivalTolerance;
 assert.equal(t.hex,'cdcccc3d');assert.equal(t.float32,Math.fround(.1));assert.equal(t.dimensions,3);
 const m=castMethod(c,'MathUtil','CheckDistance');assert.equal(m.image,'Torappu.Common.dll');assert.equal(m.entryRva,0x5a40470);
 const code=instructions(m);
 assert.deepEqual(code.filter(i=>['subss','mulss','addss'].includes(i.mnemonic)).map(i=>[i.mnemonic,i.operands]),[
  ['subss','xmm3, xmm1'],['subss','xmm1, dword ptr [rsp + 0x18]'],['subss','xmm2, xmm0'],
  ['mulss','xmm2, xmm2'],['mulss','xmm3, xmm3'],['mulss','xmm1, xmm1'],
  ['addss','xmm2, xmm3'],['mulss','xmm4, xmm4'],['addss','xmm2, xmm1']]);
 assert.ok(code.some(i=>i.mnemonic==='comiss'&&i.operands==='xmm4, xmm2'));
 assert.ok(code.some(i=>i.mnemonic==='setae'&&i.operands==='al'));
});

test('movement mount coordinates bind ILocatable, muzzle enum, owner dispatch and world-to-map conversion',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-movement-source.json'),mapping=c.mountMapping;
 assert.equal(mapping.unitToMountPointMappingVerified,false);
 assert.equal(mapping.locatable.name,'ILocatable');assert.equal(mapping.locatable.namespace,'Torappu.Battle');
 assert.equal(mapping.locatable.encodedUsage>>>29,1);assert.equal(mapping.locatable.methods[1].name,'get_mapPositionV3');
 assert.equal(mapping.castFields._mountPointType.offset,0x210);assert.equal(mapping.castFields._projectileDestination.offset,0x230);
 assert.equal(mapping.enums._mountPointType.fields.find(f=>f.value===2).name,'MUZZLE');
 assert.equal(mapping.enums._projectileDestination.fields.find(f=>f.value===0).name,'TARGET');
 assert.equal(mapping.sourceMountSlot.slot,90);assert.equal(mapping.sourceMountSlot.declaringType,'Unit');
 assert.equal(mapping.sourceMountSlot.entryRva,castMethod(c,'Unit','GetMountPoint').entryRva);
 assert.equal(mapping.entityReferenceFields.mount.name,'m_entity');assert.equal(mapping.entityReferenceFields.mount.offset,0x18);
 assert.deepEqual(mapping.entityReferenceFields.projectile.map(f=>f.name),['m_source','m_traceTarget']);
 for(const field of mapping.entityReferenceFields.projectile)assert.equal(field.typeData,mapping.entityReferenceFields.mount.typeData);
 const init=instructions(castMethod(c,'BasicMovement','OnInit'));
 assert.ok(init.some(i=>i.rva===0x662e8e&&i.operands==='edx, [rcx + 1]'));
 assert.ok(init.some(i=>i.rva===0x662e98&&i.operands==='0x18000c2e0'));
 assert.ok(init.some(i=>i.rva===0x662edd&&i.operands==='0x18000c2e0'));
 const calls=(type,name,target)=>assert.ok(instructions(castMethod(c,type,name)).some(i=>i.mnemonic==='call'&&i.operands===target));
 calls('MountPoint','get_mapPositionV3','0x1808831c0');calls('MapUtil','WorldToMapPosV3','0x18063bb10');
 const launch=instructions(castMethod(read(projectilePath),'RangedAttack','CreateProjectile'));
 assert.ok(launch.some(i=>i.rva===0xbfb055&&i.operands==='ebp, dword ptr [rbx + 0x210]'));
 assert.ok(launch.some(i=>i.rva===0xbfb080&&i.operands==='rax, qword ptr [r8 + 0x6d8]'));
});

test('selected motion binds complete arithmetic helpers, normalization epsilon and separate delta/speed rounding',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-movement-source.json');
 assert.equal(c.normalizationEpsilon.hex,'acc52737');assert.equal(c.normalizationEpsilon.float32,Math.fround(1e-5));
 const tick=instructions(castMethod(c,'AdvancedMovement','OnTick'));
 for(const m of c.arithmeticHelpers){
  assert.equal(m.metadataIdentityVerified,false);
  assert.ok(tick.some(i=>i.rva===m.callerRva&&i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+m.entryRva).toString(16)));
  for(const ch of m.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(raw.length,ch.endRva-ch.beginRva);assert.equal(sha(raw),ch.sha256);}
 }
 const normalize=instructions(c.arithmeticHelpers.find(m=>m.role==='normalize'));
 assert.ok(normalize.some(i=>i.rva===0x5112fb&&i.mnemonic==='ja'&&i.operands==='0x18051133e'));
 assert.equal(normalize.filter(i=>i.mnemonic==='divss').length,3);
 assert.deepEqual(tick.filter(i=>i.rva>=0xa7cea7&&i.rva<=0xa7cec3).map(i=>[i.mnemonic,i.operands]),[
  ['mulss','xmm2, xmm10'],['mulss','xmm3, xmm10'],['movsd','qword ptr [rbp - 0x59], xmm0'],
  ['mulss','xmm1, xmm10'],['mulss','xmm3, xmm7'],['mulss','xmm2, xmm7'],['mulss','xmm1, xmm7']]);
 assert.ok(tick.some(i=>i.rva===0xa7ce63&&i.mnemonic==='jae'&&i.operands==='0x180a7cef3'));
});

test('finite expiry binds signed FP greater-or-equal before behaviours and stop guards before destruction',()=>{
 const c=read(projectilePath),leaf=c.expiryComparisonLeaf;
 assert.equal(leaf.image,'Torappu.Common.dll');assert.equal(leaf.type,'FP');assert.equal(leaf.name,'op_GreaterThanOrEqual');
 assert.deepEqual(instructions(leaf).map(i=>[i.mnemonic,i.operands]),[['cmp','rcx, rdx'],['setge','al'],['ret','']]);
 const raw=Buffer.from(leaf.chunks[0].base64,'base64');assert.equal(raw.length,7);assert.equal(sha(raw),leaf.chunks[0].sha256);
 assert.equal(leaf.chunks[0].unwindRva,null);
 const at=(type,name,rva,args)=>assert.ok(instructions(castMethod(c,type,name)).some(i=>i.rva===rva&&i.operands===args));
 at('Projectile','OnTick',0x67af5a,'0x1851df0b0');at('Projectile','OnTick',0x67af61,'0x18067af95');
 at('Projectile','ExtraCheckToFinish',0x67614f,'al, 1');
 at('Projectile','StopMe',0x67c06f,'byte ptr [rbx + 0xa4], cl');
 at('Projectile','StopMe',0x67c077,'byte ptr [rbx + 0xa4], 1');
 at('Projectile','StopMe',0x67c09b,'qword ptr [rax + 0x468]');
 at('Projectile','StopMe',0x67c0ab,'0x1839980f0');
 const stop=instructions(castMethod(c,'Projectile','OnProjectileStop'));
 const call=target=>stop.findIndex(i=>i.mnemonic==='call'&&i.operands===target);
 assert.ok(call('0x18067c970')>=0&&call('0x18067c970')<call('0x1806a1b60'));
 at('Projectile','OnProjectileStop',0x67a9c5,'byte ptr [rbx + 0xa5], cl');
 at('Projectile','OnProjectileStop',0x67a9cb,'0x18067ab67');
 const native=JSON.parse(c.prefabScriptBridges[0].originalJson);
 assert.equal(native._alwaysHitTraceTargetInTheEnd,1);assert.equal(native._alwaysReachInTheEnd,0);
 assert.equal(c.stopSlots.find(s=>s.slot===51).name,'OnProjectileStop');
 assert.equal(c.stopSlots.find(s=>s.slot===41).name,'get_alwaysHitTraceTargetInTheEnd');
 assert.equal(c.stopSlots.find(s=>s.slot===43).name,'get_alwaysReachInTheEnd');
});

test('forced final trace hit keeps deduplication before the cap and count increment after actions',()=>{
 const c=read(projectilePath),native=JSON.parse(c.prefabScriptBridges[0].originalJson);
 assert.equal(native._canHitSameTargetMultipleTimes,0);assert.equal(native._keepAlreadyHitTime,-1);
 const at=(name,rva,args)=>assert.ok(instructions(castMethod(c,'Projectile',name)).some(i=>i.rva===rva&&i.operands===args));
 at('_DealHitTraceTarget',0x67c9bb,'byte ptr [rbx + 0xa7], cl');
 at('_DealHitTraceTarget',0x67c9e6,'byte ptr [rbx + 0xa7], 1');
 at('_DealHitTraceTarget',0x67c9f8,'r8b, 1');at('_DealHitTraceTarget',0x67ca06,'0x180678120');
 at('DealHitTarget',0x67819a,'rax');at('DealHitTarget',0x6781a4,'sil, sil');
 at('DealHitTarget',0x6781af,'dword ptr [rbx + 0xa8], eax');
 at('DealHitTarget',0x6781c6,'0x180005620');at('DealHitTarget',0x6781cb,'dword ptr [rbx + 0xa8]');
 assert.equal(c.stopSlots.find(s=>s.slot===53).name,'CheckTargetAlreadyHitAndUpdate');
 at('CheckTargetAlreadyHitAndUpdate',0x677a57,'0x180677aa0');
 at('CheckTargetAlreadyHitAndUpdate',0x677a69,'0x18067c390');
 at('OnHitTarget',0x67a3ec,'0x18067c390');at('OnHitTarget',0x67a412,'0x1806a16e0');
 assert.equal(c.fields.Projectile.find(f=>f.name==='m_targetsAlreadyHit').offset,0x150);
 assert.equal(c.fields.Projectile.find(f=>f.name==='m_keepAlreadyHitTime').offset,0xb0);
});

test('native lifetime arithmetic binds Q32.32 constants, complete integer leaves and float conversion order',()=>{
 const c=read(projectilePath),clock=c.clockArithmetic;
 assert.equal(clock.rawSignedBits,64);assert.equal(clock.fractionalBits,32);
 assert.equal(clock.storageField.name,'_serializedValue');assert.equal(clock.storageField.typeName,'System.Int64');
 assert.equal(clock.storageField.unboxedOffset,0);
 assert.equal(clock.oneRaw,'4294967296');assert.equal(clock.selectedLifeRaw,'42949672960');
 assert.deepEqual(clock.constants.map(k=>[k.hex,k.float32]),[['0000804f',2**32],['0000802f',2**-32]]);
 assert.deepEqual(clock.leaves.map(m=>[m.role,m.aliases.map(r=>r.name)]),[
  ['add',['op_Addition','FastAdd']],['subtract',['op_Subtraction','FastSub']],
  ['fromInt',['op_Implicit']],['multiply',['op_Multiply','FastMul']]]);
 for(const m of clock.leaves){
  assert.equal(m.image,'Torappu.Common.dll');
  for(const ch of m.chunks){
   const raw=Buffer.from(ch.base64,'base64');assert.equal(raw.length,ch.endRva-ch.beginRva);assert.equal(sha(raw),ch.sha256);
   assert.equal(ch.unwindRva,null);let cursor=ch.beginRva;
   for(const i of ch.instructions){assert.equal(i.rva,cursor);cursor+=i.size;}
   assert.equal(cursor,ch.endRva);assert.equal(ch.instructions.at(-1).mnemonic,'ret');
  }
 }
 const mul=instructions(clock.leaves.find(m=>m.role==='multiply'));
 assert.deepEqual(mul.filter(i=>['sar','shr','shl'].includes(i.mnemonic)).map(i=>i.operands),[
  'rdx, 0x20','rcx, 0x20','rax, 0x20','r8, 0x20']);
 const asFloat=castMethod(c,'FP','AsFloat');assert.equal(asFloat.image,'Torappu.Common.dll');
 const convert=instructions(asFloat);
 const integerConversion=convert.findIndex(i=>i.mnemonic==='cvtsi2ss'&&i.operands==='xmm0, rbx');
 const scaleConversion=convert.findIndex(i=>i.rva===0x5a3ad55);
 assert.ok(integerConversion>=0&&integerConversion<scaleConversion);
 const tick=instructions(castMethod(c,'Projectile','OnTick'));
 for(const [rva,target] of [[0x67ae9b,'0x185a3b800'],[0x67aef3,'0x184175da0'],[0x67b05b,'0x185a3b800']])
  assert.ok(tick.some(i=>i.rva===rva&&i.mnemonic==='call'&&i.operands===target));
 assert.equal(clock.movementScaleSlot.slot,14);assert.equal(clock.movementScaleSlot.declaringType,'BasicMovement');
 assert.equal(clock.movementScaleSlot.name,'GetTimeScale');assert.equal(clock.movementScaleField.offset,0x90);
 assert.ok(instructions(castMethod(c,'BasicMovement','GetTimeScale')).some(i=>i.operands==='rax, qword ptr [rbx + 0x90]'));
 const native=JSON.parse(c.prefabScriptBridges[0].originalJson);
 assert.equal(native._lifeTimeType,1);assert.equal(native._lifeTime,10);assert.equal(native._getLifeTimeFromBB,0);
});

test('native arrival ensures remaining lifetime by subtraction before clearing the trace reference',()=>{
 const c=read(projectilePath),movement=read('data/candidates/arkpedia-windows-fear-movement-source.json');
 const sub=c.clockArithmetic.leaves.find(m=>m.role==='subtract');assert.equal(sub.entryRva,0x5a3b9a0);
 assert.deepEqual(instructions(sub).map(i=>[i.mnemonic,i.operands]),[
  ['sub','rcx, rdx'],['mov','rax, rcx'],['ret','']]);
 const ensure=instructions(castMethod(movement,'Projectile','EnsureLifeTime'));
 for(const [rva,args]of [[0x678573,'rdi, qword ptr [rsi + 0x98]'],
  [0x678591,'0x185a3b9a0'],[0x67859f,'0x18067e7c0'],[0x6785c6,'rcx, [rsi + 0x110]']])
  assert.ok(ensure.some(i=>i.rva===rva&&i.operands===args));
 const advanced=JSON.parse(movement.component.originalJson);
 assert.equal(advanced._delayAfterReached,0);assert.equal(advanced._clearTraceTargetWhenReached,1);
});

test('ordinary projectile initialization resets its fixed-point lifetime clock before behaviour setup',()=>{
 const c=read(projectilePath),init=castMethod(c,'Projectile','_InitInline');
 const root=c.methods.find(m=>m.type==='Projectile'&&m.name==='Init'&&m.entryRva===c.preprocessing.rootInitEntryRva);
 assert.ok(instructions(root).some(i=>i.rva===0x678ce9&&i.operands==='0x18067ccc0'));
 const code=instructions(init);
 assert.ok(code.some(i=>i.rva===0x67cde4&&i.mnemonic==='xor'&&i.operands==='ecx, ecx'));
 assert.ok(code.some(i=>i.rva===0x67cde6&&i.operands==='0x185a3da10'));
 assert.ok(code.some(i=>i.rva===0x67cdf4&&i.operands==='0x18067e7c0'));
 assert.ok(instructions(castMethod(c,'Projectile','set_currentTime')).some(i=>i.operands==='qword ptr [rdi + 0x158], rbx'));
});

test('arrival-area evidence binds the authored circle and explicit nested field differences',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-area-source.json');assert.equal(c.methods.length,30);
 for(const p of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 for(const m of [...c.methods,c.layerMaskLeaf])for(const ch of m.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(raw.length,ch.endRva-ch.beginRva);assert.equal(sha(raw),ch.sha256);
 }
 for(const row of Object.values(c.geometry))assert.equal(sha(row.originalJson),row.sha256);
 const collider=JSON.parse(c.geometry.collider.originalJson),transform=JSON.parse(c.geometry.transform.originalJson);
 assert.equal(c.geometry.collider.componentType,'CircleCollider2D');assert.equal(collider.m_Radius,1);
 assert.deepEqual(collider.m_Offset,{x:0,y:0});assert.equal(collider.m_IsTrigger,true);assert.equal(collider.m_Enabled,1);
 assert.deepEqual(transform.m_LocalScale,{x:1,y:1,z:1});
 assert.equal(collider.m_GameObject.m_PathID,c.geometry.gameObject.pathId);
 const [range,hit]=c.prefabScriptBridges;
 assert.equal(range.scriptIdentity.m_ClassName,'CircleRange');assert.equal(hit.scriptIdentity.m_ClassName,'HitBehaviour');
 assert.deepEqual(range.unmatchedSerializedFields,{_useBlackboardRangeId:0});assert.equal(range.serializedFieldParity,false);
 assert.deepEqual(hit.unmatchedSerializedFields,{_exceptFlyCharacter:0});assert.equal(hit.serializedFieldParity,false);
 assert.deepEqual(c.unmatchedTargetOptions,{ignoreMotionMode:0});assert.equal(c.targetOptionParity,false);
 for(const field of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[field],false);
});

test('source motion snapshot retains live alive-or-dying lookup and independent initialization fallback',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-area-source.json'),snapshot=c.sourceMotionSnapshot;
 assert.equal(snapshot.concreteContextVerified,false);
 assert.equal(snapshot.snapshotType.name,'SourceSnapshot');assert.equal(snapshot.snapshotType.fields[0].name,'sourceMotionMode');
 assert.equal(snapshot.snapshotType.allocationLoadRva,0x787917);assert.equal(snapshot.snapshotType.encodedUsage>>>29,1);
 assert.deepEqual(snapshot.concreteSpecifications.map(s=>[s.callerLoadRva,s.declaringType,s.definition.name]),[
  [0x7878fb,'PtrObjRef`1','.ctor'],[0x787a5c,'BattleUtil','ValidAndAliveOrDying'],[0x787ab7,'PtrObjRef`1','Get']]);
 for(const spec of snapshot.concreteSpecifications){
  assert.equal(spec.nativeMapping,null);assert.equal(Object.values(spec.instantiations)[0].arguments[0].name,'Entity');
 }
 for(const m of snapshot.canonicalBodies)for(const ch of m.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 assert.deepEqual(snapshot.aliveOrDyingSlots.map(s=>[s.slot,s.name,s.declaringType]),[
  [39,'get_aliveOrDying','Entity'],[39,'get_aliveOrDying','Entity'],[39,'get_aliveOrDying','Character']]);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const init=castMethod(c,'TargetOptions','_InitSourceSnapshot');
 at(init,0x787947,'0x183a29e20');at(init,0x78794c,'dword ptr [rdi + 0x10], eax');
 const lookup=castMethod(c,'TargetOptions','_TryGetSourceMotionMode');
 at(lookup,0x787a66,'0x183f4ec20');at(lookup,0x787a78,'dword ptr [rbx], 2');
 at(lookup,0x787a89,'eax, dword ptr [rax + 0x10]');at(lookup,0x787ac3,'0x1847b7720');at(lookup,0x787ad2,'0x183a29e20');
 const validity=snapshot.canonicalBodies.find(m=>m.definition.name==='ValidAndAliveOrDying');
 at(validity,0x3f4ecb7,'0x1847b7720');at(validity,0x3f4ed0c,'rax, qword ptr [rdx + 0x3a8]');
 const hit=castMethod(c,'HitBehaviour','Init');at(hit,0xa7377f,'0x18067e3d0');at(hit,0xa73795,'0x180787580');
});

test('arrival verification retains motion/category and source-relative advanced gates',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-area-source.json');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const verify=castMethod(c,'TargetOptions','VerifyTargetWithoutCheckingTargetSide');
 at(verify,0x7877a1,'0x1808779e0');at(verify,0x7877c6,'0x180787af0');
 const basic=castMethod(c,'BattleUtil','VerifyTarget');
 at(basic,0x877a3d,'0x183a29e20');at(basic,0x877a42,'eax, 0x1f');
 at(basic,0x877a4f,'edi, edx');at(basic,0x877a7e,'esi, eax');
 const advanced=castMethod(c,'TargetOptions','_VerifyAdvanced');
 for(const [rva,args]of [[0x787b40,'byte ptr [rbx + 0xc], sil'],[0x787b66,'eax, dword ptr [rbx + 0x38]'],
  [0x787b8a,'0x183a2d970'],[0x787ba2,'0x180787a00'],[0x787bab,'ecx, 0x54'],
  [0x787bbb,'r8d, [rcx - 0x28]'],[0x787bb7,'r9d, [rcx - 0x52]'],[0x787bbf,'0x1800158d0'],
  [0x787c44,'0x183a2c460'],[0x787d9d,'0x180874850']])at(advanced,rva,args);
 const profession=castMethod(c,'BattleUtil','CheckProfessionMask');
 at(profession,0x87489a,'sil, sil');at(profession,0x87489f,'ebx, ebx');at(profession,0x8748a3,'al, 1');
 const dispatch=c.motionTargetFreeDispatch;
 assert.equal(dispatch.metadataIdentityVerified,false);
 assert.deepEqual(dispatch.slots.map(s=>[s.type,s.slot,s.declaringType,s.name]),[
  ['Entity',84,'Entity','isStillMotionTargetFreeWithImmuneFlag'],
  ['Enemy',84,'Entity','isStillMotionTargetFreeWithImmuneFlag'],
  ['Character',84,'Character','isStillMotionTargetFreeWithImmuneFlag']]);
 for(const ch of dispatch.chunks)assert.equal(sha(Buffer.from(ch.base64,'base64')),ch.sha256);
 const native=JSON.parse(c.prefabScriptBridges[1].originalJson)._targetOptions;
 assert.equal(native.enableAdvancedOptions,1);assert.equal(native.targetMotion,1);assert.equal(native.targetCategory,1);
 for(const key of ['checkUnitType','ignoreTargetFree','ignoreAllyTargetFree','onlyIgnoreSomeOfTargetFreeCase',
  'excludeSomeAbnormalFlags','containSomeAbnormalFlags','purposeMask','professionMask'])assert.equal(native[key],0);
});

test('native area query filters and caps before deterministic sorting and source notification before hits',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-area-source.json'),query=instructions(castMethod(c,'Box2dPhysicsUtil','FindTargets_DISPOSE'));
 assert.equal(c.queryLimit,128);
 const at=(code,rva,args)=>assert.ok(code.some(i=>i.rva===rva&&i.operands===args));
 at(query,0x731add,'0x180787570');at(query,0x731c10,'0x1807325f0');
 at(query,0x731cf5,'edx, dword ptr [rbx + 0x18]');
 at(query,0x731d13,'0x180787770');at(query,0x731d92,'dword ptr [rbp + 0x18], 0x80');
 at(query,0x731d99,'0x180731db5');
 assert.equal(c.deterministicSort.declaringType,'List`1');assert.equal(c.deterministicSort.definition.name,'Sort');
 assert.equal(c.deterministicSort.instantiations.class.arguments[0].name,'Entity');
 assert.equal(c.deterministicSort.parameterCount,0);assert.equal(c.deterministicSort.concreteContextVerified,false);
 assert.equal(c.deterministicSort.callerLoadRva,0x731dd5);
 const layer=instructions(c.layerMaskLeaf);
 assert.deepEqual(layer.map(i=>[i.mnemonic,i.operands]),[
  ['mov','ecx, dword ptr [rcx + 0x44]'],['xor','edx, edx'],['jmp','0x180876380']]);
 assert.equal(c.targetOptionFields.find(f=>f.name==='m_targetSideMask').unboxedOffset,0x44);
 const arrival=instructions(castMethod(c,'HitBehaviour','OnProjectileReached'));
 at(arrival,0xa73cfa,'0x1807319f0');at(arrival,0xa73e7e,'0x183a21980');at(arrival,0xa73f1c,'qword ptr [r10 + 0x228]');
 const native=JSON.parse(c.prefabScriptBridges[1].originalJson);
 assert.equal(native._onlyCheckHitWhenReachTarget,1);assert.equal(native._ignoreCamouflage,1);
 for(const field of ['_exceptSource','_exceptTraceTarget','_onlyTraceTarget'])assert.equal(native[field],0);
});

test('native overlap resolves Entity on the collider itself and miner root owns the trigger',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-area-source.json');
 assert.deepEqual(c.componentQueries.map(q=>[q.callerLoadRva,q.declaringType,q.definition.name,
  q.instantiations.method.arguments[0].name]),[
  [0x731c53,'Component','GetComponent','Entity'],
  [0x81152d,'Component','GetComponent','Rigidbody2D'],
  [0x8115e3,'Component','GetComponent','Collider2D']]);
 for(const query of c.componentQueries){assert.equal(query.encodedUsage>>>29,6);assert.equal(query.concreteContextVerified,false);}
 const owner=c.minerColliderOwnership,g=owner.geometry;
 for(const row of Object.values(g))assert.equal(sha(row.originalJson),row.sha256);
 const native=Object.fromEntries(Object.entries(g).map(([key,row])=>[key,JSON.parse(row.originalJson)]));
 assert.equal(owner.entityScript.m_ClassName,'Enemy');assert.equal(owner.entityScript.m_Namespace,'Torappu.Battle');
 assert.equal(owner.entityBinding.componentSha256,g.entity.sha256);
 assert.ok(owner.enemyLineage.some(t=>t.name==='Entity'&&t.namespace==='Torappu.Battle'));
 for(const key of ['trigger','rigidbody','entity'])assert.equal(native[key].m_GameObject.m_PathID,g.root.pathId);
 assert.equal(native.root.m_Layer,28);assert.equal(native.trigger.m_Radius,Math.fround(.1));
 assert.equal(native.trigger.m_IsTrigger,true);assert.equal(native.trigger.m_Enabled,1);
 assert.deepEqual(native.trigger.m_Offset,{x:0,y:0});
 assert.equal(native.collisionTransform.m_Father.m_PathID,g.transform.pathId);
 assert.deepEqual(new Set(native.collisionHolder.m_Component.map(r=>r.component.m_PathID)),
  new Set([g.collisionTransform.pathId,g.collisionCapsule.pathId]));
 assert.equal(owner.worldGeometryVerified,false);assert.equal(owner.physicsOverlapParity,false);
 const init=instructions(castMethod(c,'Enemy','_InitPhysics'));
 assert.ok(init.some(i=>i.rva===0x81168d&&i.operands==='0x185f1e240'));
 assert.ok(init.some(i=>i.rva===0x8116ae&&i.operands==='0x185a3da20'));
 assert.ok(init.some(i=>i.rva===0x8116b8&&i.operands==='qword ptr [rsi + 0x3f0], rax'));
 assert.ok(instructions(castMethod(c,'Enemy','get_ColliderRadius')).some(i=>
  i.rva===0x813974&&i.operands==='rax, qword ptr [rbx + 0x3f0]'));
 assert.ok(instructions(castMethod(c,'Map','WorldToMapPositionV3')).some(i=>
  i.rva===0x63bba4&&i.operands==='0x185ece320'));
});

test('native projectile source lock checks cached UID and destroyed/null state across allocation and recycling',()=>{
 const c=read(projectilePath),ref=c.sourceReference;
 assert.equal(ref.method.name,'Lock');assert.equal(ref.encodedUsage>>>29,6);
 assert.equal(ref.typeArgument.namespace,'Torappu.Battle');assert.equal(ref.typeArgument.name,'Entity');
 assert.equal(ref.interface.name,'IPtrObject');assert.deepEqual(ref.interface.methods.map(m=>m.name),['get_instanceUid']);
 assert.deepEqual(ref.declaredFields.map(f=>f.name),['obj','cachedUid']);
 assert.equal(ref.instanceUidField.offset,0x18);assert.equal(ref.concreteContextVerified,false);
 for(const m of [ref.lock,ref.validity])for(const ch of m.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 const thunk=Buffer.from(ref.validityThunk.base64,'base64');assert.equal(thunk.length,5);assert.equal(thunk[0],0xe9);assert.equal(sha(thunk),ref.validityThunk.sha256);
 assert.equal(ref.validityThunk.entryRva+5+thunk.readInt32LE(1),ref.validity.entryRva);
 const valid=instructions(ref.validity),nullCheck=castMethod(c,'ObjectExtensions','IsDestroyedOrNull');
 assert.equal(nullCheck.image,'Torappu.Common.dll');
 assert.ok(valid.some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+nullCheck.entryRva).toString(16)));
 assert.ok(valid.some(i=>i.rva===0x477cdfe&&i.mnemonic==='cmp'&&i.operands==='eax, dword ptr [rbx + 8]'));
 const allocate=instructions(castMethod(c,'BObject','OnAllocate')),recycle=instructions(castMethod(c,'BObject','OnRecycle'));
 assert.ok(allocate.some(i=>i.rva===0x399825a&&i.operands==='dword ptr [rbx + 0x18], eax'));
 assert.ok(recycle.some(i=>i.rva===0x3998334&&i.operands==='dword ptr [rbx + 0x18], 0'));
});

test('uncached-only false selects ordinary ApplyDamage with a live source path and cached no-source fallback',()=>{
 const c=read(projectilePath),graph=read('data/candidates/arkpedia-ch16-fear-projectile-source.json');
 const cast=JSON.parse(Object.values(graph.prefabs)[0].find(r=>r.pathId==='4729572091462136098').originalJson);
 assert.equal(cast._useCachedAtkOnly,0);assert.equal(cast._atkScale,1);assert.equal(cast._damageType,2);
 assert.equal(c.damageNodeSlot.slot,106);assert.equal(c.damageNodeSlot.name,'NewDamageNode');assert.equal(c.damageNodeSlot.declaringType,'RangedAttack');
 const node=instructions(castMethod(c,'RangedAttack','NewDamageNode'));
 const normal=castMethod(c,'AbstractAnimatedAbility','NewDamageNode');
 assert.ok(node.some(i=>i.rva===0xbfbb06&&i.operands==='byte ptr [rdi + 0x23a], cl'));
 assert.ok(node.some(i=>i.mnemonic==='jmp'&&i.operands==='0x'+(c.imageBase+normal.entryRva).toString(16)));
 assert.ok(instructions(normal).some(i=>i.mnemonic==='call'&&i.operands==='0x180d7a420'));
 assert.equal(c.damageFields.find(f=>f.name==='m_cachedAtk').offset,0x28);
 const preprocess=instructions(castMethod(c,'ApplyDamage','PreprocessForProjectile'));
 assert.ok(preprocess.some(i=>i.mnemonic==='call'&&i.operands==='0x183a29060'));
 assert.ok(preprocess.some(i=>i.rva===0xd7a196&&i.operands==='qword ptr [rdi + 0x28], rax'));
 const evaluate=instructions(castMethod(c,'ApplyDamage','CreateDamageModifier'));
 for(const name of ['CalculateDamageBySource','CalculateDamageByAtkNoSource']){
  const m=castMethod(c,'BattleUtil',name);assert.ok(evaluate.some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+m.entryRva).toString(16)));
 }
 assert.ok(instructions(castMethod(c,'BattleUtil','CalculateDamageBySource')).some(i=>i.mnemonic==='call'&&i.operands==='0x183a29060'));
});

test('native impact attaches active buffs before attachments and action execution',()=>{
 const c=read(projectilePath),code=instructions(castMethod(c,'ActionController','OnHitTarget'));
 const order=[['ActionController','_AttachBuffs'],['AbilityAttachment','Apply'],['ActionController','_RunActions']];
 const addresses=order.map(([type,name])=>new Set(c.methods.filter(m=>m.type===type&&m.name===name).map(m=>'0x'+(c.imageBase+m.entryRva).toString(16))));
 const calls=addresses.map(set=>code.findIndex(i=>i.mnemonic==='call'&&set.has(i.operands)));
 assert.ok(calls[0]>=0&&calls[0]<calls[1]&&calls[1]<calls[2]);
 const native=JSON.parse(c.prefabScriptBridges[0].originalJson)._actionController;
 assert.equal(native._dontAddBuffs,0);assert.equal(native._onlyAddBuffsToTraceTarget,0);assert.equal(native._onlyAddBuffsToTargetOnce,0);
 assert.deepEqual(native._extraBuffsInTheEnd,[]);
});

test('raw byte LifeType and the complete two-return helper prevent a false single-target cap',()=>{
 const c=read(projectilePath);assert.equal(c.lifeType.underlyingType,'System.Byte');
 assert.deepEqual(c.lifeType.fields.map(f=>[f.name,f.value]),[['IMMEDIATELY',0],['LIMITED',1],['INFINITY',2],['CUSTOM',3]]);
 assert.deepEqual(c.lifeType.fields.map(f=>f.encodedHex),['00','01','02','03'],'unsigned byte enum values are not signed-int zigzag');
 const simple=JSON.parse(c.prefabScriptBridges[0].originalJson);
 assert.equal(simple._maxHitNum,1);assert.equal(simple._hitNumType,2);assert.equal(simple._getMaxHitNumFromBB,0);assert.equal(simple._limitedMaxHitNumToSourceBlockedCnt,0);
 const limited=instructions(castMethod(c,'SimpleProjectile','get_limitedHitNum'));
 assert.ok(limited.some(i=>i.rva===0x6b78fc&&i.mnemonic==='cmp'&&i.operands==='byte ptr [rbx + 0x191], 2'));
 assert.ok(limited.some(i=>i.rva===0x6b7903&&i.mnemonic==='setne'));
 const max=instructions(castMethod(c,'SimpleProjectile','GetMaxHitNum'));
 assert.ok(max.some(i=>i.rva===0x6b763c&&i.operands==='r8d, 0x80'));
 assert.ok(max.some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+c.lifeValueLeaf.entryRva).toString(16)));
 assert.equal(c.lifeValueLeaf.name,'GetLifeValue');assert.equal(c.lifeValueLeaf.typeArgument.name,'Int32');
 assert.equal(c.lifeValueLeaf.encodedUsage>>>29,6);assert.equal(c.lifeValueLeaf.chunks[0].unwindRva,null);
 const leaf=instructions(c.lifeValueLeaf);assert.deepEqual(leaf.map(i=>i.mnemonic),['test','je','cmp','cmovne','mov','ret','xor','ret']);
 let cursor=c.lifeValueLeaf.entryRva;for(const i of leaf){assert.equal(i.rva,cursor);cursor+=i.size;}
 assert.equal(cursor,c.lifeValueLeaf.chunks[0].endRva);assert.equal(leaf[1].operands,'0x18402c5df');
 assert.equal(leaf[3].operands,'r8d, ecx');assert.equal(leaf[4].operands,'eax, r8d');
});

test('fear projectile source death uses the explicit stop switch while finite lifetime remains independent',()=>{
 const c=read(projectilePath),simple=JSON.parse(c.prefabScriptBridges[0].originalJson);
 assert.equal(simple._stopWhenSourceInvalid,0);assert.equal(simple._managedBySource,0);
 assert.equal(simple._lifeTimeType,1);assert.equal(simple._lifeTime,10);assert.equal(simple._getLifeTimeFromBB,0);
 assert.equal(simple._stopAfterFirstHit,0);assert.equal(simple._stopAfterMaxHit,0);
 assert.equal(c.resolvedSlots.find(s=>s.slot===40).name,'get_stopWhenSourceInvalid');
 const tick=instructions(castMethod(c,'Projectile','OnTick'));
 assert.ok(tick.some(i=>i.rva===0x67af63&&i.operands==='ecx, 0x28'));
 assert.ok(tick.some(i=>i.rva===0x67af72&&i.mnemonic==='je'&&i.operands==='0x18067afc4'));
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_10128_fearpj.policy,null);
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
});

test('priority filtering binds generic definitions and reference-sharing without inventing a concrete native mapping',()=>{
 const c=read(priorityPath);assert.equal(c.genericMethods.length,3);assert.equal(c.methods.length,6);
 for(const p of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 for(const method of [...c.methods,...c.genericMethods])for(const chunk of method.chunks){
  const raw=Buffer.from(chunk.base64,'base64');assert.equal(raw.length,chunk.endRva-chunk.beginRva);assert.equal(sha(raw),chunk.sha256);assert.ok(chunk.unwindRva>0);
 }
 const concrete=c.concreteFilterSpecification,canonical=c.genericMethods[0];
 assert.equal(concrete.declaringType,'FilterUtil');assert.equal(concrete.definition.name,'Filter');
 assert.deepEqual(concrete.definition,canonical.definition);assert.equal(concrete.nativeMapping,null);
 assert.equal(concrete.instantiations.method.arguments[0].name,'Entity');assert.equal(canonical.instantiations.method.arguments[0].name,'Object');
 assert.equal(c.genericPointerTableRva,0x6ae7d00);
 assert.equal(c.pointerAnchors[0].definition.name,'Filter');assert.equal(c.pointerAnchors[1].definition.name,'Max');
 for(const flag of ['runtimeDispatchVerified','concreteContextVerified','frameParity','crossVersionParity'])assert.equal(c[flag],false);
 assert.equal(c.unresolvedWeightComparison.bodyRetained,false);assert.equal(c.unresolvedWeightComparison.metadataIdentityVerified,false);
});

test('native priority comparator retains gap quantization, interface tie and UID source separately',()=>{
 const c=read(priorityPath);assert.equal(c.hatredGap.field.name,'HATRED_WEIGHT_SMALL_ENOUGH_GAP');assert.equal(c.hatredGap.field.offset,8);
 assert.equal(c.hatredGap.hex,'cdcccc3d');assert.equal(c.hatredGap.float32,Math.fround(.1));
 const comparator=instructions(c.genericMethods.find(m=>m.definition.name==='CompareTo'));
 for(const [type,name] of [['FP','op_Division'],['TSMath','Floor'],['MathUtil','Equals']]){
  const target=castMethod(c,type,name),address='0x'+(c.imageBase+target.entryRva).toString(16);
  assert.ok(comparator.some(i=>i.mnemonic==='call'&&i.operands===address));
 }
 assert.ok(comparator.some(i=>i.rva===0x4a5edd2&&i.mnemonic==='call'&&i.operands==='r9'),'equal weights retain interface dispatch, not an invented distance tie');
 assert.equal(c.instanceUidField.name,'<instanceUid>k__BackingField');assert.equal(c.instanceUidField.offset,0x18);
 assert.equal((c.instanceUidField.typeBits>>>16)&255,9,'native instance UID is unsigned 32-bit');
 const tie=instructions(castMethod(c,'Entity','CompareTo'));
 assert.ok(tie.some(i=>i.rva===0x3a197ae&&i.operands==='eax, dword ptr [rdi + 0x18]'));
 assert.ok(tie.some(i=>i.rva===0x3a197ba&&i.operands==='edx, dword ptr [rbx + 0x18]'));
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_10128_fearpj.policy,null);
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
});

test('fear selector retains complete native chunks and exact CN script identity with explicit layout differences',()=>{
 const c=read(fearSelectorPath);assert.equal(c.methods.length,24);
 for(const p of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 for(const method of [...c.methods,c.filterDispatcher])for(const chunk of method.chunks){
  const raw=Buffer.from(chunk.base64,'base64');assert.equal(raw.length,chunk.endRva-chunk.beginRva);assert.equal(sha(raw),chunk.sha256);
  assert.ok(chunk.unwindRva>0);
 }
 assert.equal(c.selector.scriptIdentity.m_ClassName,'AdvancedSelector');assert.equal(c.selector.serializedFieldParity,false);
 assert.deepEqual(c.selector.unmatchedSerializedFields,{_ignoreMotionMode:0});
 const bindings=read('data/candidates/arkpedia-ch16-script-bindings-source.json');
 const binding=bindings.bindings.find(b=>b.componentPathId===c.selector.componentPathId&&b.prefab===c.selector.prefab);
 assert.equal(binding.scriptPathId,c.selector.scriptPathId);assert.equal(binding.componentSha256,sha(c.selector.originalJson));
 for(const field of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[field],false);
});

test('native filter dispatch retains every byte as decoded code or a bounded instruction-aligned jump table',()=>{
 const c=read(fearSelectorPath),dispatcher=c.filterDispatcher;assert.equal(dispatcher.entryRva,0x769490);
 assert.equal(dispatcher.chunks.length,1);const chunk=dispatcher.chunks[0],raw=Buffer.from(chunk.base64,'base64');
 const code=chunk.codeRange,table=chunk.jumpTable;
 assert.equal(code.beginRva,chunk.beginRva);assert.equal(code.endRva,table.beginRva);assert.equal(table.endRva,chunk.endRva);
 assert.equal(table.count,79);assert.equal(table.entryBytes,4);assert.equal(table.endRva-table.beginRva,table.count*4);
 const codeBytes=raw.subarray(0,code.endRva-code.beginRva),dataBytes=raw.subarray(codeBytes.length);
 assert.equal(sha(codeBytes),code.sha256);assert.equal(sha(dataBytes),table.sha256);
 let cursor=code.beginRva;for(const i of chunk.instructions){assert.equal(i.rva,cursor);cursor+=i.size;}assert.equal(cursor,table.beginRva);
 const starts=new Set(chunk.instructions.map(i=>i.rva));
 for(let n=0;n<table.count;n++){assert.equal(dataBytes.readUInt32LE(n*4),table.targetRvas[n]);assert.ok(starts.has(table.targetRvas[n]));}
 const at=rva=>chunk.instructions.find(i=>i.rva===rva);
 assert.deepEqual([at(0x76990e).mnemonic,at(0x76990e).operands],['cmp','ebp, 0x4e']);
 assert.deepEqual([at(0x76991e).mnemonic,at(0x76991e).operands],['mov','ecx, dword ptr [rdx + rbp*4 + 0x76b648]']);
 assert.deepEqual([at(0x769928).mnemonic,at(0x769928).operands],['jmp','rcx']);
 const selected=dispatcher.selectedCase;assert.equal(selected.value,4);assert.equal(selected.targetRva,table.targetRvas[4]);
 assert.equal(selected.encodedUsage>>>29,3);assert.equal((selected.encodedUsage&0x1ffffffe)>>>1,selected.method.index);
 assert.equal(selected.method.name,'_Filter_HatredDes');
 assert.equal(selected.hatredSlot.slot,46);assert.equal(selected.hatredSlot.declaringType,'Enemy');assert.equal(selected.hatredSlot.name,'get_hatred');
 const getter=castMethod(c,'Enemy','get_hatred');assert.equal(getter.entryRva,selected.hatredSlot.entryRva);
 const key=instructions(castMethod(c,'FilterUtil','_Filter_HatredDes'));
 assert.ok(key.some(i=>i.mnemonic==='mov'&&i.operands==='rax, qword ptr [rdx + 0x418]'));
});

test('fear selector abnormal values are retained under their actual disabled branch conditions',()=>{
 const c=read(fearSelectorPath),native=JSON.parse(c.selector.originalJson),fields=c.fields.TargetOptions.fields;
 assert.equal(native._ignoreTargetFree,0);assert.equal(native._onlyIgnoreSomeOfTargetFreeCase,0);assert.equal(native._excludeSomeAbnormalFlags,0);
 assert.equal(native._abnormalFlag,42);assert.equal(native._abnormalCombo,2);assert.equal(native._excludeAbnormalFlag,46);
 for(const [name,offset] of [['ignoreTargetFree',0xd],['onlyIgnoreSomeOfTargetFreeCase',0x2c],['abnormalFlag',0x30],['abnormalCombo',0x34],['excludeSomeAbnormalFlags',0x11],['excludeAbnormalFlag',0x14]]){
  const f=fields.find(f=>f.name===name);assert.equal(f.unboxedOffset,offset);assert.equal(f.offset,offset+16);
 }
 const code=instructions(castMethod(c,'TargetOptions','_VerifyAdvanced'));
 for(const [rva,operands] of [[0x787bcc,'byte ptr [rbx + 0xd], sil'],[0x787bd2,'byte ptr [rbx + 0x2c], sil'],[0x787c59,'byte ptr [rbx + 0x11], sil']])
  assert.ok(code.some(i=>i.rva===rva&&i.mnemonic==='cmp'&&i.operands===operands));
 assert.ok(code.some(i=>i.rva===0x787bd0&&i.mnemonic==='je'&&i.operands==='0x180787c30'));
 assert.ok(code.some(i=>i.rva===0x787bd6&&i.mnemonic==='je'&&i.operands==='0x180787c30'));
 assert.ok(code.some(i=>i.rva===0x787c5d&&i.mnemonic==='je'&&i.operands==='0x180787c91'));
 for(const [slot,name] of [[31,'get_onlyIgnoreSomeOfTargetFreeCase'],[32,'get_abnormalFlag'],[33,'get_abnormalCombo'],[35,'get_excludeSomeAbnormalFlags'],[36,'get_excludeAbnormalFlag']])
  assert.equal(c.resolvedSlots.find(r=>r.slot===slot).name,name);
});

test('selector enums describe only the pinned Windows version and preserve the earlier CN admission hold',()=>{
 const c=read(fearSelectorPath),value=(key,name)=>c.enums[key].fields.find(f=>f.name===name).value;
 assert.equal(value('_abnormalFlag','FEARED_PRIVATE'),42);assert.equal(value('_abnormalFlag','E_NUM'),44);
 assert.equal(value('_abnormalCombo','E_NUM'),2);assert.equal(value('_postFilter','HATRED_DES'),4);
 assert.equal(c.enums._postFilter.partial,true);assert.equal(c.enums._postFilter.fields.length,1);
 assert.equal(value('_targetSide','ENEMY'),2);assert.equal(value('_targetMotion','WALK_ONLY'),1);assert.equal(value('_targetCategory','DEFAULT'),1);
 assert.equal(c.methods.filter(m=>m.type==='AdvancedSelector'&&m.name==='OnPostFilter').length,2);
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_10128_fearpj.policy,null);
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
});

test('miner talent evidence pins complete native methods and exact source inputs without admission',()=>{
 const c=read(minerTalentsPath);assert.equal(c.methods.length,28);
 for(const p of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 for(const method of [...c.methods,c.genericTimerMaximum])for(const chunk of method.chunks){
  const raw=Buffer.from(chunk.base64,'base64');assert.equal(raw.length,chunk.endRva-chunk.beginRva);assert.equal(sha(raw),chunk.sha256);
  assert.ok(chunk.unwindRva>0);assert.ok(chunk.instructions.length>0);
 }
 for(const field of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[field],false);
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_3010_mcreep_a,undefined);
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
});

test('miner timer maximum resolves the actual generic method specification and float threshold',()=>{
 const c=read(minerTalentsPath),max=c.genericTimerMaximum;
 assert.equal(max.type,'MathUtil');assert.equal(max.name,'Max');assert.equal(max.encodedUsage>>>29,6);
 assert.equal((max.encodedUsage&0x1ffffffe)>>>1,max.methodSpecIndex);
 assert.equal(max.classInstantiation,-1);assert.equal(max.typeArgument.name,'System.Single');
 assert.equal((max.typeArgument.typeBits>>>16)&255,12);
 const code=instructions(max),compare=c.methods.find(m=>m.entryRva===0x51d7130);
 assert.equal(compare.type,'Single');assert.equal(compare.name,'CompareTo');assert.equal(compare.image,'mscorlib.dll');
 assert.ok(code.some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+compare.entryRva).toString(16)));
 assert.ok(code.some(i=>i.mnemonic==='js'&&i.operands==='0x18400df1b'));
 assert.equal(c.shadowThreshold.hex,'6f12833a');assert.equal(c.shadowThreshold.value,Math.fround(.001));
 const state=instructions(castMethod(c,'Mainline16Manager','_isShadowTileInShadowState'));
 assert.ok(state.some(i=>i.rva===0x60067a&&i.mnemonic==='comiss'&&i.operands==='xmm1, xmm0'));
 assert.ok(state.some(i=>i.rva===0x60067d&&i.mnemonic==='jbe'&&i.operands==='0x1806006db'));
});

test('miner talents follow the exact default-mode transform hierarchy and mode attachment setter',()=>{
 const c=read(minerTalentsPath),g=read('data/candidates/arkpedia-ch16-miner-source.json');
 const rows=Object.fromEntries(Object.values(g.prefabs)[0].map(r=>[r.pathId,JSON.parse(r.originalJson)]));
 assert.deepEqual(c.minerModeTalents.map(t=>t.name),['FearLoseBlood','GetHeal','TileEscapeShadowManager']);
 for(const t of c.minerModeTalents){
  assert.equal(t.defaultModeIndex,-1);assert.equal(t.modeIndex,0);
  assert.equal(rows[t.gameObjectPathId].m_Name,t.name);
  for(let i=0;i<t.transformPathIds.length;i++){
   const transform=rows[t.transformPathIds[i]];assert.equal(transform.m_GameObject.m_PathID,t.gameObjectPathIds[i]);
   if(i+1<t.transformPathIds.length)assert.equal(transform.m_Father.m_PathID,t.transformPathIds[i+1]);
  }
  assert.ok(rows[t.gameObjectPathIds.at(-1)].m_Component.some(ref=>ref.component.m_PathID===t.nearestModeComponentPathId));
 }
 const slot=c.modeInitializationSlot;assert.equal(slot.slot,6);assert.equal(slot.name,'InitOnce');
 const once=instructions(castMethod(c,'UnitMode','InitOnce')),collect=castMethod(c,'UnitMode','_InitTalents');
 assert.ok(once.some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+collect.entryRva).toString(16)));
 const setter=castMethod(c,'BasicTalent','SetParentMode');
 assert.ok(instructions(collect).some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+setter.entryRva).toString(16)));
});

test('native miner duration reads the exact times literal with a zero fallback and forwards the result',()=>{
 const c=read(minerTalentsPath),action=instructions(castMethod(c,'Main16ChangeTileShadowViaRange','Execute'));
 assert.deepEqual(c.literals.map(l=>[l.instructionRva,l.value]),[[0xdd1871,'times'],[0xdd184a,'range_id']]);
 for(const literal of c.literals){assert.equal(literal.encodedUsage>>>29,5);assert.equal((literal.encodedUsage&0x1ffffffe)>>>1,literal.literalIndex);}
 const at=rva=>action.find(i=>i.rva===rva);
 assert.deepEqual([at(0xdd187b).mnemonic,at(0xdd187b).operands],['xorps','xmm2, xmm2']);
 const target=method=>'0x'+(c.imageBase+method.entryRva).toString(16);
 assert.equal(at(0xdd1886).operands,target(castMethod(c,'Blackboard','GetFloatOrDefault')));
 assert.equal(at(0xdd18b8).operands,target(castMethod(c,'Mainline16Manager','ChangeShadowTileEscapeTimeViaRangeId')));
 assert.deepEqual([at(0xdd1890).operands,at(0xdd18ac).operands],['xmm6, xmm0','dword ptr [rsp + 0x20], xmm6']);
 const fallback=instructions(castMethod(c,'Blackboard','GetFloatOrDefault'));
 assert.ok(fallback.some(i=>i.rva===0x2166652&&i.operands==='xmm6, xmm2'));
 assert.ok(fallback.some(i=>i.rva===0x21666f7&&i.operands==='xmm0, xmm6'));
});

test('native enemy initialization retains explicit talent validity and attachment calls',()=>{
 const c=read(minerTalentsPath),init=instructions(castMethod(c,'Enemy','OnInit'));
 for(const name of ['CheckRootOrValidModeTalent','Attach']){
  const method=castMethod(c,'BasicTalent',name),address='0x'+(c.imageBase+method.entryRva).toString(16);
  assert.ok(init.some(i=>i.mnemonic==='call'&&i.operands===address));
 }
 const assign=instructions(castMethod(c,'Enemy','_AssignTalent'));
 assert.ok(assign.some(i=>i.mnemonic==='call'&&i.operands==='0x182167ea0'),'fresh blackboard allocation remains in the retained assignment path');
 assert.ok(assign.some(i=>i.mnemonic==='call'&&i.operands==='0x18247e330'),'fresh TalentData allocation remains in the retained assignment path');
 const update=instructions(castMethod(c,'Mainline16Manager','_UpdateOneTileEscapeTime'));
 const state=castMethod(c,'Mainline16Manager','_UpdateTileState');
 assert.ok(update.some(i=>i.mnemonic==='jmp'&&i.operands==='0x'+(c.imageBase+state.entryRva).toString(16)));
});
test('cast evidence resolves common-library tokens in their own image and preserves every native chunk',()=>{
 const c=read(castPath);assert.equal(c.methods.length,43);
 for(const p of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+p.path,import.meta.url))),p.sha256);
 assert.deepEqual(c.codeGenModules.map(m=>m.name),['Assembly-CSharp.dll','Torappu.Common.dll','spine-unity.dll']);
 for(const method of [...c.methods,...c.virtualHelpers])for(const chunk of method.chunks){
  const raw=Buffer.from(chunk.base64,'base64');assert.equal(raw.length,chunk.endRva-chunk.beginRva);assert.equal(sha(raw),chunk.sha256);
 }
 const division=castMethod(c,'FP','op_Division');assert.equal(division.image,'Torappu.Common.dll');
 assert.notEqual(c.codeGenModules[0].methodPointerTableRva,c.codeGenModules[1].methodPointerTableRva);
 const leaf=castMethod(c,'FP','op_Implicit');assert.equal(leaf.chunks.length,1);assert.equal(leaf.chunks[0].unwindRva,null);
 assert.deepEqual(instructions(leaf).map(i=>i.mnemonic),['mulss','cvttss2si','ret']);
});
test('bounded wait uses the actual entity attack-event enum, FP fields and fixed-point waiter',()=>{
 const c=read(castPath);
 assert.equal(c.entityEvent.fields.find(f=>f.name==='ON_ATTACK_EVENT').value,19);
 assert.equal(c.timeMode.fields.find(f=>f.name==='FROM_ATTACK_SPEED').value,0);
 const fields=c.fields.EasyToStartAbility.fields;
 for(const [name,offset] of [['m_cachedDuration',0x118],['m_receivedEvent',0x120],['m_realStartTime',0x128]])assert.equal(fields.find(f=>f.name===name).offset,offset);
 assert.equal(fields.find(f=>f.name==='m_cachedDuration').typeData,c.methods.find(m=>m.type==='FP').typeIndex);
 assert.equal((fields.find(f=>f.name==='m_receivedEvent').typeBits>>>16)&255,2,'event receipt is a Boolean, not an event-ID integer');
 const waiter=instructions(castMethod(c,'<WaitWhileForFixedSeconds>d__6','MoveNext'));
 for(const [type,name] of [['FP','op_Division'],['MathUtil','RoundToInt']]){
  const target='0x'+(c.imageBase+castMethod(c,type,name).entryRva).toString(16);
  assert.ok(waiter.some(i=>i.mnemonic==='call'&&i.operands===target));
 }
 assert.ok(waiter.some(i=>i.mnemonic==='cmovl'&&i.operands==='eax, esi'),'minimum one yielded frame is retained');
 assert.ok(waiter.some(i=>i.mnemonic==='inc'&&i.operands==='dword ptr [rdi + 0x34]'));
});
test('virtual dispatch helpers bind metadata slots instead of guessing a class vtable offset',()=>{
 const c=read(castPath);
 for(const [type,name,slot] of [['AbilityStandard','OnEvent',73],['AbilityStandard','OnSpellStart',80],['AbilityStandard','OnWaitForPreDelay',77],['AbilityStandard','OnWaitForPostDelay',78],['EasyToStartAbility','GetDuration',101],['AbstractAnimatedAbility','get_cooldown',17]]){
  const rows=c.virtualBindings.filter(b=>b.type===type&&b.name===name);assert.equal(rows.length,1);assert.equal(rows[0].slot,slot);
 }
 const getter=c.virtualHelpers.find(h=>h.entryRva===0x57b0);
 assert.ok(instructions(getter).some(i=>i.operands==='r8, qword ptr [rax + rdx*8 + 0x138]'));
 assert.ok(instructions(getter).some(i=>i.mnemonic==='add'&&i.operands==='rdx, rdx'));
});
test('cached duration retains owner attack-time and animation scale paths rather than fabricating a marker',()=>{
 const c=read(castPath),cooldown=instructions(castMethod(c,'AbstractAnimatedAbility','get_cooldown'));
 assert.ok(cooldown.some(i=>i.mnemonic==='call'&&i.operands==='0x183a29180'));
 const duration=instructions(castMethod(c,'AbstractAnimatedAbility','GetDuration'));
 assert.ok(duration.some(i=>i.mnemonic==='mov'&&i.operands==='rax, qword ptr [rbx + 0x1a8]'));
 const speed=instructions(castMethod(c,'AbstractAnimatedAbility','UpdatePlaybackSpeed'));
 assert.ok(speed.some(i=>i.mnemonic==='minss'&&i.operands==='xmm0, xmm6'));
 assert.ok(speed.some(i=>i.mnemonic==='mov'&&i.operands==='qword ptr [rdi + 0x1a8], rax'));
 for(const field of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[field],false);
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_10128_fearpj.policy,null);
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
});

test('exact CN script references identify the cast classes without inventing full cross-version field parity',()=>{
 const c=read(castPath),bindings=read('data/candidates/arkpedia-ch16-script-bindings-source.json');
 assert.equal(bindings.bindings.length,173);assert.equal(Object.keys(bindings.scripts).length,33);
 for(const row of Object.values(bindings.graphs))assert.equal(sha(readFileSync(new URL('../'+row.path,import.meta.url))),row.sha256);
 for(const script of Object.values(bindings.scripts)){
  assert.equal(sha(script.originalJson),script.sha256);assert.equal(script.serializedFile,'CAB-658d74aab777086fc32b93f385be999a');
 }
 for(const [id,name] of [['4729572091462136098','RangedAttack'],['-4003912029476114142','BuffToOwner'],['-5930072227765702366','EmptyAnimatedAbility']]){
  const bridge=c.prefabScriptBridges.find(b=>b.componentPathId===id);
  assert.equal(bridge.scriptIdentity.m_ClassName,name);assert.equal(bridge.scriptIdentity.m_Namespace,'Torappu.Battle.Abilities');
  assert.equal(bridge.scriptIdentity.m_AssemblyName,'Assembly-CSharp.dll');assert.equal(bridge.serializedFieldParity,true);
  assert.deepEqual(bridge.unmatchedSerializedFields,{});
  const binding=bindings.bindings.find(b=>b.graph===bridge.graph&&b.prefab===bridge.prefab&&b.componentPathId===id);
  assert.equal(binding.scriptPathId,bridge.scriptPathId);assert.equal(binding.componentSha256,bridge.componentSha256);
 }
 const animator=c.prefabScriptBridges.find(b=>b.scriptIdentity.m_ClassName==='SingleSpineAnimator');
 assert.equal(animator.serializedFieldParity,false);
 assert.deepEqual(Object.keys(animator.unmatchedSerializedFields).sort(),['_neverImmediatelyFaceSwitcher','_shadowTransform']);
 const enemy=c.prefabScriptBridges.find(b=>b.scriptIdentity.m_ClassName==='Enemy');assert.equal(enemy.serializedFieldParity,false);
 assert.deepEqual(Object.keys(enemy.unmatchedSerializedFields),['_groundBoundHeightZOffset']);
});
test('anonymous shared script intake retains complete official checksums without treating a short tag as MD5',()=>{
 const c=read('data/candidates/arkpedia-ch16-script-bindings-source.json'),recipe=read('data/arkpedia-cn-mono-script-source.json');
 assert.equal(c.source.checksumProof.kind,'pinned-official-archive');assert.equal(c.source.checksumProof.nativeManifestShortTagVerified,false);
 assert.equal(c.source.checksumProof.nativeManifestTag,'1cc3');assert.equal(recipe.nativeRow.md5,'1cc3');
 assert.match(recipe.archive.md5,/^[a-f0-9]{32}$/);assert.match(recipe.bundle.md5,/^[a-f0-9]{32}$/);
 assert.equal(c.source.checksumProof.sha256,sha(readFileSync(new URL('../'+c.source.checksumProof.recipe,import.meta.url))));
 assert.equal(c.source.sha256,recipe.bundle.sha256);assert.equal(recipe.identity.scriptCount,6916);
 for(const field of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[field],false);
});
test('enemy animation dispatch reaches inherited Unit and Spine time divided by configured speed',()=>{
 const c=read(castPath);
 for(const [type,slot,declaringType,name] of [['Enemy',103,'Unit','GetAnimationTime'],['SingleSpineAnimator',46,'SpineAnimator','GetAnimationTimeInternal'],['RangedAttack',80,'AbilityStandard','OnSpellStart'],['RangedAttack',116,'RangedAttack','CreateProjectile']]){
  const row=c.resolvedSlots.find(r=>r.type===type&&r.slot===slot);assert.equal(row.declaringType,declaringType);assert.equal(row.name,name);
  assert.equal(row.encodedMethod>>>29,3);
 }
 const fields=c.fields.AnimationData.fields;
 assert.equal(fields.find(f=>f.name==='time').offset,0x2c);assert.equal(fields.find(f=>f.name==='speed').offset,0x24);
 const methods=c.methods.filter(m=>m.type==='SpineAnimator'&&m.name==='GetAnimationTimeInternal');assert.equal(methods.length,2);
 for(const method of methods)assert.ok(instructions(method).some(i=>i.mnemonic==='divss'&&i.operands==='xmm0, dword ptr [rax + 0x24]'));
 const update=instructions(castMethod(c,'SpineAnimator','UpdateAnimationData'));
 assert.ok(update.some(i=>i.mnemonic==='movss'&&i.operands==='dword ptr [rdi + 0x2c], xmm0'));
 const find=castMethod(c,'SkeletonData','FindAnimation');assert.equal(find.image,'spine-unity.dll');
 assert.ok(update.some(i=>i.mnemonic==='call'&&i.operands==='0x'+(c.imageBase+find.entryRva).toString(16)));
 assert.equal(c.fields.Animation.fields.find(f=>f.name==='duration').offset,0x28);
 assert.ok(update.some(i=>i.mnemonic==='movss'&&i.operands==='xmm0, dword ptr [rax + 0x28]'));
 const end=instructions(castMethod(c,'RangedAttack','OnCastEnd'));
 assert.ok(end.some(i=>i.mnemonic==='cmp'&&i.operands==='byte ptr [rbx + 0x224], 0'));
});
