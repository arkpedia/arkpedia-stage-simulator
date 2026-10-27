// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {crc64XZ,verifyWindowsManifest,verifyWindowsFile} from '../tools/arkpedia/windows-client-source.mjs';
import {verifyWindowsSettingsManifest} from '../tools/arkpedia/windows-settings-source.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
function fixture(){
 const files=['/GameAssembly.dll','/Arknights_Data/il2cpp_data/Metadata/global-metadata.dat'].map((path,i)=>({path,bytes:i+1,crc64XZ:String(i),sha256:'a'.repeat(64)}));
 const manifest={source:'/Arknights_EN-042.0.0-game',file:files.map(f=>({path:f.path,size:String(f.bytes),hash:f.crc64XZ}))};
 const raw=Buffer.from(JSON.stringify(manifest));return{raw,pin:{source:manifest.source,manifest:{bytes:raw.length,sha256:sha(raw)},files},manifest};
}
function settingsFixture(){
 const f=fixture();f.pin.version='042.0.0';
 const file={path:'/Arknights_Data/globalgamemanagers',bytes:985100,crc64XZ:'16749682563938344243',sha256:'b'.repeat(64)};
 f.manifest.file.push({path:file.path,size:String(file.bytes),hash:file.crc64XZ});
 f.raw=Buffer.from(JSON.stringify(f.manifest));f.pin.manifest={bytes:f.raw.length,sha256:sha(f.raw)};
 return{...f,settings:{version:f.pin.version,source:f.pin.source,file}};
}

test('buff activation context binds event0 target to owner and preserves the complete target dispatch table',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-context-source.json');assert.equal(c.methods.length,9);
 for(const s of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+s.path,import.meta.url))),s.sha256);
 for(const m of c.methods)for(const ch of m.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const start=castMethod(c,'Buff','OnStart');
 at(start,0x39b0187,'r9b, 1');at(start,0x39b018f,'r8d, r8d');at(start,0x39b0195,'0x1839b5370');
 assert.equal(c.buffStartedField.offset,0x1e8);at(start,0x39b019c,'byte ptr [rbx + 0x1e8], 1');
 const run=castMethod(c,'Buff','_RunActions');at(run,0x39b5486,'r14b, r14b');
 at(run,0x39b5495,'0x1839b6ff0');at(run,0x39b54ac,'0x1839eb3e0');
 at(run,0x39b545b,'0x1839eb000');at(run,0x39b5481,'0x1839eb350');
 const chunk=c.targetDispatcher.chunks[0],raw=Buffer.from(chunk.base64,'base64');
 const code=Buffer.from(chunk.codeBase64,'base64'),table=Buffer.from(chunk.jumpTable.base64,'base64');
 assert.equal(sha(raw),chunk.sha256);assert.equal(sha(code),chunk.codeSha256);assert.equal(sha(table),chunk.jumpTable.sha256);
 assert.deepEqual(Buffer.concat([code,table]),raw);assert.equal(raw.length,chunk.endRva-chunk.beginRva);
 assert.equal(code.length,chunk.codeEndRva-chunk.beginRva);assert.equal(table.length,11*4);
 let cursor=chunk.beginRva;for(const i of chunk.instructions){assert.equal(i.rva,cursor);cursor+=i.size;}
 assert.equal(cursor,chunk.codeEndRva);
 for(let i=0;i<11;i++){
  assert.equal(table.readUInt32LE(i*4),chunk.jumpTable.targetRvas[i]);
  assert.ok(chunk.instructions.some(ins=>ins.rva===chunk.jumpTable.targetRvas[i]));
 }
 const value=name=>c.targetType.fields.find(f=>f.name===name).value;
 assert.equal(value('TARGET'),0);assert.equal(value('BUFF_OWNER'),3);
 assert.equal(chunk.jumpTable.targetRvas[value('TARGET')],0xced3d4);
 assert.equal(chunk.jumpTable.targetRvas[value('BUFF_OWNER')],0xced40f);
 at(c.targetDispatcher,0xced3d4,'rax, qword ptr [rbx + 8]');at(c.targetDispatcher,0xced428,'0x1839b6ff0');
 for(const key of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[key],false);
});

test('self-death source binds the original template and native chain-stop versus AlwaysNext behavior',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json');assert.equal(c.methods.length,135);
 for(const s of Object.values(c.sources))assert.equal(sha(readFileSync(new URL('../'+s.path,import.meta.url))),s.sha256);
 assert.equal(sha(c.template.originalJson),c.template.sha256);assert.equal(c.eventKey,0);
 for(const m of c.methods)for(const ch of m.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 assert.deepEqual(c.actions.map(a=>a.$type.split('+').at(-1)),['CheckAbnormalFlag','CheckAbnormalFlag','CheckAbnormalFlag',
  'CheckAbnormalCombo','SwitchMode','CreateBuff','AlwaysNext','InstantKill']);
 for(const a of c.actions.slice(0,4)){assert.equal(a._targetType,'BUFF_OWNER');assert.equal(a._isUnset,true);}
 assert.deepEqual(c.actions.slice(0,3).map(a=>a._abnormalFlag),['LEVITATE','FROZEN','STUNNED']);
 assert.equal(c.actions[3]._abnormalCombo,'SLEEPING');assert.equal(c.actions[4]._targetType,'TARGET');
 assert.equal(c.actions[4]._modeIndex,1);assert.equal(c.actions[4]._restartFSM,true);
 assert.equal(c.actions[5]._buffOwner,'BUFF_OWNER');assert.equal(c.actions[5]._buff.buffKey,'fearpj_die[immunes]');
 assert.deepEqual(c.actions[5]._buff.attributes.abnormalImmunes,['STUNNED','FROZEN','LEVITATE']);
 assert.deepEqual(c.actions[5]._buff.attributes.abnormalComboImmunes,['SLEEPING']);
 assert.equal(c.actions[5]._buff.lifeTimeType,'INFINITY');assert.equal(c.actions[5]._isDerivedBuff,false);
 assert.equal(c.actions[7]._targetType,'TARGET');assert.equal(c.actions[7]._killSource,false);assert.equal(c.actions[7]._noSource,false);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(castMethod(c,'ActionNode','get_executeCondition'),0xce995b,'eax, [rcx + 1]');
 at(castMethod(c,'AlwaysNext','get_executeCondition'),0xd32cac,'eax, eax');
 at(castMethod(c,'AlwaysNext','Execute'),0xd32b63,'al, 1');
 const run=c.methods.find(m=>m.entryRva===0xe44890);
 at(run,0xe449d1,'0x180e43d80');at(run,0xe449d8,'0x180e44a7d');at(run,0xe44a7d,'al, al');
 const check=castMethod(c,'ActionUtil','CheckExecute');
 at(check,0xe43def,'0x180e43e19');at(check,0xe43df4,'0x180e43e0b');at(check,0xe43e19,'al, 1');
 for(const key of ['runtimeDispatchVerified','frameParity','crossVersionParity'])assert.equal(c[key],false);
});

test('mode switch source binds the two original modes, death animation hook and same-state FSM restart',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),mode=c.modeSwitch;
 assert.equal(mode.modeField.name,'m_currentMode');assert.equal(mode.modeField.offset,0x1e8);
 const graph=Object.fromEntries(Object.entries(mode.graph).map(([key,row])=>{
  assert.equal(sha(row.component.originalJson),row.component.sha256);assert.equal(row.binding.componentSha256,row.component.sha256);
  return[key,JSON.parse(row.component.originalJson)];
 }));
 assert.deepEqual(graph.owner._modes.map(r=>r.m_PathID),[mode.graph.mode0.component.pathId,mode.graph.mode1.component.pathId]);
 assert.equal(graph.mode1._attack.m_PathID,'0');assert.equal(graph.mode1._combat.m_PathID,mode.graph.combat1.component.pathId);
 assert.equal(mode.graph.combat1.scriptIdentity.m_ClassName,'EmptyAnimatedAbility');
 assert.equal(graph.mode1._animatorHooker.m_PathID,mode.graph.animatorHooker1.component.pathId);
 assert.deepEqual(graph.animatorHooker1._replaceAnimPairs,[{fromAnimKey:'Die',toAnimKey:'Die_2'}]);
 assert.deepEqual(mode.parameters.find(m=>m.entryRva===0x854d20).parameters.map(p=>p.name),['nextMode','force','isInit','restartFSM']);
 const core=c.methods.find(m=>m.entryRva===0x854d20);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(core,0x854ea2,'0x180850800');at(core,0x854eb8,'qword ptr [rbx + 0x1e8], rsi');at(core,0x854ed8,'0x18084ce40');
 assert.equal(mode.switchSlots.find(s=>s.type==='Enemy').name,'OnSwitchMode');
 const switched=castMethod(c,'Unit','OnSwitchMode');
 at(switched,0x852f7f,'0x18247e0b0');at(switched,0x852f86,'0x180852fb2');
 at(switched,0x852f95,'edi, dword ptr [rcx + 0x48]');at(switched,0x852f9a,'0x18247da40');
 at(switched,0x852fab,'edx, edi');at(switched,0x852fad,'0x18247d9b0');
 assert.equal(mode.fsmStateField.name,'<currentStateId>k__BackingField');assert.equal(mode.fsmStateField.offset,0x48);
 const stop=c.methods.find(m=>m.entryRva===0x247da40);
 assert.deepEqual(instructions(stop).map(i=>[i.mnemonic,i.operands]),[
  ['xor','r9d, r9d'],['mov','r8b, 1'],['lea','edx, [r9 - 1]'],['jmp','0x18247dbe0']]);
 assert.ok(c.methods.some(m=>m.type==='StateMachine'&&m.entryRva===0x247dbe0));
});

test('mode initialization binds general/combat/attack order and the canonical swap-last duplicate removal loop',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),init=c.modeSwitch.abilityInitialization;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const method=castMethod(c,'UnitMode','_InitAbilities');
 at(method,0x870ac1,'rcx, qword ptr [rdi + 0x68]');at(method,0x870b86,'rbx, qword ptr [rdi + 0x38]');
 at(method,0x870bcc,'rbx, qword ptr [rdi + 0x40]');at(method,0x870c2d,'0x183f62c90');
 assert.deepEqual(init.fields.filter(f=>['_generalAbilities','_combat','_attack'].includes(f.name)).map(f=>[f.name,f.offset]),[
  ['_combat',0x38],['_attack',0x40],['_generalAbilities',0x68]]);
 assert.equal(init.addSpecification.declaringType,'List`1');assert.equal(init.addSpecification.definition.name,'Add');
 assert.equal(init.concreteDedupSpecification.definition.name,'RemoveDuplicationsInplace');
 assert.equal(init.concreteDedupSpecification.nativeMapping,null);assert.equal(init.concreteContextVerified,false);
 assert.equal(init.canonicalDedup.instantiations.method.arguments[0].name,'Object');
 for(const load of init.specificationLoads){assert.equal(load.encodedUsage>>>29,6);assert.equal((load.encodedUsage&0x1ffffffe)>>>1,load.specificationIndex);}
 for(const ch of init.canonicalDedup.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 const dedup=init.canonicalDedup;
 at(dedup,0x3f62d92,'0x180005860');at(dedup,0x3f62deb,'0x1800053d0');
 at(dedup,0x3f62e1e,'0x180004fe0');at(dedup,0x3f62e72,'0x180004b40');
 at(dedup,0x3f62e77,'esi');at(dedup,0x3f62e79,'0x183f62d00');
 assert.equal(init.equalsDispatch.metadataIdentityVerified,false);
});

test('buff pool identity source binds the shared counter and UID/validity allocation and recycle writes',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),identity=c.modeSwitch.buffNotification.poolIdentity;
 assert.equal(identity.counterField.name,'s_globalCounter');assert.equal(identity.counterField.offset,0);assert.equal((identity.counterField.typeBits>>>16)&255,9);
 assert.equal(identity.uidField.offset,0x208);assert.equal(identity.validityField.name,'m_isValid');assert.equal(identity.validityField.offset,0x1ef);
 assert.equal(identity.poolMembershipVerified,false);assert.equal(identity.liveAllocationPolicyVerified,false);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const allocate=castMethod(c,'Buff','OnAllocate');at(allocate,identity.allocateCounterIncrementRva,'ebx');
 at(allocate,identity.allocateCounterWriteRva,'dword ptr [rax], ebx');at(allocate,identity.allocateUidWriteRva,'dword ptr [rdi + 0x208], ebx');
 at(allocate,identity.allocateValidityWriteRva,'byte ptr [rdi + 0x1ef], 1');
 const recycle=castMethod(c,'Buff','OnRecycle');at(recycle,identity.recycleUidSetterCallRva,'0x1839b7df0');
 at(recycle,0x39afb7a,'edx, edx');at(recycle,identity.recycleValidityWriteRva,'byte ptr [rbx + 0x1ef], 0');
 assert.ok(castMethod(c,'Buff','set_instanceUid'));
 for(const method of identity.canonicalPoolMethods)for(const ch of method.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 const context=identity.staticRecycleContext;assert.equal(context.definitionStride,16);assert.equal(context.length,29);assert.equal(context.concreteRuntimeContextVerified,false);
 assert.deepEqual(context.bindings.map(row=>[row.slot,row.declaringType,row.definition.name]),[
  [19,'HashSet`1','Remove'],[20,'ObjectPool`1','_RecycleInternal'],[26,'Stack`1','Push'],[18,'ObjectPool`1','_SendNotification'],
  [1,'Stack`1','get_Count'],[6,'Options','Prepare'],[11,'Stack`1','Pop'],[12,'ObjectPool`1','get_allLoadedCnt'],[13,'ObjectPool`1','_CreateNew'],[16,'HashSet`1','Add']]);
 for(const binding of context.bindings){
  const raw=Buffer.from(binding.definitionBase64,'base64');assert.equal(raw.length,16);assert.equal(sha(raw),binding.sha256);
  assert.equal(raw.readUInt32LE(0),3);assert.equal(binding.genericArgumentKind,19);assert.equal(binding.genericParameterIndex,248);
  assert.equal(Buffer.from(binding.dataHex,'hex').readInt32LE(0),binding.methodSpecificationIndex);
 }
 assert.deepEqual(identity.notificationInterface.slots.map(row=>[row.slot,row.name]),[[0,'OnAllocate'],[1,'OnRecycle']]);
 assert.deepEqual([identity.notificationInterface.namespace,identity.notificationInterface.name],['Torappu.ObjectPool','IReusable']);
 const recyclePool=identity.canonicalPoolMethods.find(m=>m.definition.name==='Recycle'),internal=identity.canonicalPoolMethods.find(m=>m.definition.name==='_RecycleInternal');
 at(recyclePool,0x477b64b,'0x18477b6a2');at(recyclePool,0x477b661,'r8, qword ptr [r9 + 0x98]');
 at(internal,0x477b9fc,'rax, qword ptr [r9 + 0xd0]');at(internal,0x477ba0d,'r8d, 1');at(internal,0x477ba1d,'rax, qword ptr [rcx + 0x90]');
});

test('default buff allocation source binds100 preload, prepared signed capacity and disabled auto reuse',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),pool=c.modeSwitch.buffNotification.poolIdentity,a=pool.defaultAllocation;
 assert.deepEqual(a.selectedOptions,{preloadSize:100,maxCapacityBeforePrepare:0,maxCapacity:2147483647,allowPoolAutoReuse:false});
 assert.equal(a.constructorSpecification.instantiations.class.arguments[0].name,'Buff');assert.equal(a.constructorSpecification.nativeMapping,null);
 assert.equal(a.nativeConstructorEffectsVerified,false);assert.equal(a.liveAllocationPhaseVerified,false);
 assert.deepEqual([a.constructedType.namespace,a.constructedType.name],['Torappu.Battle','Buff']);
 assert.equal(a.constructedType.encodedUsage>>>29,1);assert.equal(a.metadataLoads[0].index,253089);assert.equal(a.metadataLoads[1].index,56747);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const battle=castMethod(c,'BattleController','.ctor');at(battle,0x3990432,'qword ptr [rbp - 0x20], rax');
 at(battle,0x3990439,'dword ptr [rbp - 0x20], 0x64');at(battle,0x3990440,'byte ptr [rbp - 0x18], al');
 at(battle,0x3990475,'0x18477bac0');at(battle,0x399047a,'rcx, [rbx + 0x90]');
 for(const ch of a.prepare.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,14);}
 assert.deepEqual(instructions(a.prepare).map(i=>[i.mnemonic,i.operands]),[['cmp','dword ptr [rcx + 4], 0'],['jg','0x1828a710d'],
  ['mov','dword ptr [rcx + 4], 0x7fffffff'],['ret','']]);
 const allocate=pool.canonicalPoolMethods.find(m=>m.definition.name==='Allocate');at(allocate,0x477b4bb,'0x18477b50c');
 at(allocate,0x477b4de,'0x18477b5a5');at(allocate,0x477b54a,'rax, qword ptr [rdx + 0x80]');at(allocate,0x477b588,'r8d, r8d');
 at(castMethod(c,'BuffContainer','CreateBuff'),0x39bfed1,'0x1839b5fc0');assert.ok(castMethod(c,'Buff','.ctor'));
});

test('delayed recycle source binds UInt32 exact-frame buckets and a second frame sample before removal',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.recycleQueue;
 assert.equal(q.frameField.name,'s_fixedFrameCnt');assert.equal(q.frameField.offset,0x14);assert.equal((q.frameField.typeBits>>>16)&255,9);
 assert.equal(q.queueField.offset,0x20);assert.equal(q.poolField.offset,0x90);assert.equal((q.keyTypeBits>>>16)&255,9);
 assert.deepEqual([q.containerType.namespace,q.containerType.name],['Torappu','ListDict`2']);
 assert.equal(q.nativeTickPhaseVerified,false);assert.equal(q.poolRecycleEffectsVerified,false);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const enqueue=castMethod(c,'BattleController','RecycleBuffNextFrame');at(enqueue,q.enqueueFrameCallRva,'0x183991a80');
 at(enqueue,q.enqueueNextFrameRva,'edx, [rdi + 1]');
 const update=castMethod(c,'BattleController','_UpdateDelayToRecycleBuffContainer');at(update,q.updateFrameCallRva,'0x183991a80');
 at(update,q.updateLookupCallRva,'0x1844fb910');at(update,0x398ee2c,'0x18398ef63');
 at(update,q.pointerValidityCallRva,'0x18477cd80');at(update,q.pointerLockCallRva,'0x18477cad0');
 at(update,q.poolRecycleCallRva,'0x18477b630');at(update,q.removalFrameCallRva,'0x183991a80');at(update,q.removeBucketCallRva,'0x1844f9650');
 const tick=castMethod(c,'BattleController','OnTick');at(tick,q.nativeTickCounterIncrementRva,'dword ptr [rcx + 0x14]');
 at(tick,q.nativeTickQueueCallRva,'0x18398ed00');assert.ok(q.nativeTickCounterIncrementRva<q.nativeTickQueueCallRva);
 at(castMethod(c,'BattleController','ManualFrameTick'),q.manualTickDispatchRva,'0x18397e260');
 for(const ch of q.listMoveNext.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 at(q.listMoveNext,0x4dd3258,'dword ptr [rbx + 0xc], eax');at(q.listMoveNext,0x4dd32b8,'0x184dd32c1');
 assert.ok(castMethod(c,'BattleController','_RecycleBuffContainerImmediatelly'));
});

test('immediate recycle source enumerates stored pairs and pointer lists before clearing the queue',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.recycleQueue.immediateFlush;
 const m=castMethod(c,'BattleController','_RecycleBuffContainerImmediatelly');
 const at=(method,rva,args)=>assert.ok(instructions(method).some(i=>i.rva===rva&&i.operands===args));
 at(m,q.outerGetEnumeratorCallRva,'0x184511980');at(m,q.outerMoveNextCallRva,'0x184dd4140');
 at(m,q.innerGetEnumeratorCallRva,'0x184511980');at(m,q.innerMoveNextCallRva,'0x184dd3240');
 at(m,q.pointerValidityCallRva,'0x18477cd80');at(m,q.pointerLockCallRva,'0x18477cad0');at(m,q.poolRecycleCallRva,'0x18477b630');
 at(m,q.clearVersionIncrementRva,'dword ptr [rcx + 0x1c]');at(m,q.clearCountRva,'dword ptr [rcx + 0x18], r14d');
 assert.ok(q.poolRecycleCallRva<q.clearVersionIncrementRva);assert.equal(q.nativeCleanupPhaseVerified,false);
 assert.deepEqual(q.bindings.map(b=>b.specificationIndex),[258725,242227,231699,242404,231747,231746,231698]);
 assert.deepEqual(q.bindings.map(b=>b.definition.name),['IsNullOrEmpty','GetEnumerator','MoveNext','GetEnumerator','MoveNext','Dispose','Dispose']);
 for(const b of q.bindings){assert.equal(b.nativeMapping,null);assert.equal((b.encodedUsage&0x1ffffffe)>>>1,b.specificationIndex);}
 const shape=a=>a.kind===21?[a.definition.name,...a.arguments.map(shape)]:a.name;
 const pair=['KeyValuePair`2','UInt32',['List`1',['ObjectPtr`1','Buff']]];
 for(const i of [0,1,2,6])assert.deepEqual(shape(Object.values(q.bindings[i].instantiations)[0].argument),pair);
 for(const i of [3,4,5])assert.deepEqual(shape(q.bindings[i].instantiations.class.argument),['ObjectPtr`1','Buff']);
 for(const code of [q.outerMoveNext,q.getEnumerator]){
  assert.equal(code.concreteContextVerified,false);
  for(const ch of code.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 }
 at(q.outerMoveNext,0x4dd4158,'dword ptr [rbx + 0xc], eax');at(q.outerMoveNext,0x4dd41b6,'dword ptr [rbx + 0xc], eax');
 assert.ok(!instructions(m).some(i=>i.mnemonic==='call'&&i.operands==='0x183991a80'),'flush does not filter by current frame');
});

test('Reset context source binds unboxed BuffConfig fallback, character audio virtual dispatch and ordered pointer/flag captures',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetContext;
 const reset=castMethod(c,'Buff','Reset'),effect=castMethod(c,'BuffConfig','GetEffectKey'),priority=castMethod(c,'BuffConfig','GetOnEventPriority');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${m.type}.${m.name} ${rva.toString(16)} ${args}`);
 assert.deepEqual(q.configFields.map(f=>[f.name,f.offset]),[['template',16],['data',24]]);
 assert.deepEqual(q.unboxedConfigFieldOffsets,{template:0,data:8});
 assert.deepEqual(q.templateFields.map(f=>[f.name,f.offset]),[['effectKey',0x18],['onEventPriority',0x20]]);
 at(effect,0x85fa12,'rcx, qword ptr [rcx + 0x58]');at(effect,0x85fa18,'0x1850d34b0');
 at(effect,0x85fa21,'rax, qword ptr [rbx]');at(effect,0x85fa33,'rax, qword ptr [rbx + 8]');at(effect,0x85fa3c,'rax, qword ptr [rax + 0x58]');
 at(priority,0x85fa5d,'byte ptr [rax + 0x60], 0');at(priority,0x85fa63,'eax, dword ptr [rax + 0x64]');at(priority,0x85fa73,'eax, dword ptr [rax + 0x20]');
 at(reset,q.dataWriteRva,'qword ptr [rsi + 0x68], rdx');at(reset,q.containerWriteRva,'qword ptr [rcx], rbx');
 at(reset,q.effectConfigCallRva,'0x18085fa00');at(reset,q.effectSetterCallRva,'0x1839b7c30');at(reset,q.priorityConfigCallRva,'0x18085fa50');
 at(reset,q.directionWriteRva,'byte ptr [rsi + 0x248], bl');at(reset,q.priorityWriteRva,'dword ptr [rsi + 0x24c], ebx');
 at(reset,q.audioInitialSetterCallRva,'0x1839b7b90');at(reset,q.audioSourceValidityCallRva,'0x185ebee90');
 assert.deepEqual(q.metadataLoads.map(x=>x.name),['Character','AudioSignals']);assert.equal(q.audioSignalsField.name,'SIGNALS_WITH_BUFF');assert.equal(q.audioSignalsField.offset,0);
 assert.equal(q.audioVirtualSlot.slot,106);assert.equal(q.audioVirtualSlot.name,'TryHookAudio');assert.equal(q.audioVirtualSlot.entryRva,0x7f2970);
 at(reset,q.audioSignalsReadRva,'rdi, qword ptr [rax]');at(reset,q.audioSubsignalGetterCallRva,'0x1839b6560');at(reset,q.audioHookCallRva,'r10');
 at(reset,0x39b119f,'rcx, r15');at(reset,0x39b11cc,'rdx, qword ptr [rsp + 0x58]');at(reset,q.audioOverrideSetterCallRva,'0x1839b7b90');
 assert.deepEqual(q.parameters.map(p=>p.parameters.map(x=>x.name)),[
  ['config','container','source','ability','extraBlackboard','extraBlackboard2','sourceProjectile'],['signal','subSignal','newSignal','newSubsignal']]);
 for(const rva of q.pointerConstructorCalls)at(reset,rva,'0x184035830');
 for(const rva of q.pointerWrites)at(reset,rva,'xmmword ptr [rcx], xmm0');
 at(reset,q.capabilityDataReadRva,'rcx, qword ptr [r14 + 8]');
 for(const [i,offset] of [0x1e0,0x1e1,0x1e2,0x1e3,0x1e4,0x1e7].entries())at(reset,q.capabilityWrites[i],`byte ptr [rsi + 0x${offset.toString(16)}], al`);
 assert.ok(castMethod(c,'Character','TryHookAudio'));assert.ok(castMethod(c,'Buff','get_audioSignal'));assert.ok(castMethod(c,'Buff','set_audioSignal'));assert.ok(castMethod(c,'Buff','set_effectKey'));
 for(const key of ['nativeAudioSignalArrayValuesVerified','nativeCharacterAudioEffectsVerified','nativeContextPointerCapturesVerified','liveResetContextPhaseVerified'])assert.equal(q[key],false);
});

test('final flag source binds elemental-break iterator disposal and first visible BlockDamage on ON_TAKE_DAMAGE',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.finalFlagInitialization;
 const elemental=castMethod(c,'Buff','_InitIsEpBreakBuff'),shield=castMethod(c,'Buff','_InitShieldSource');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(q.breakDatabaseSpecification.instantiations.class.arguments[0].name,'EPBreakBuffDB');assert.equal(q.breakDatabaseSpecification.nativeMapping,null);
 at(elemental,q.breakGetEnumeratorCallRva,'r8');at(elemental,q.breakMoveNextCallRva,'0x180005250');at(elemental,q.breakCurrentCallRva,'rax');
 at(elemental,q.breakBuffKeysReadRva,'rdi, qword ptr [rdi + 0x18]');at(elemental,q.breakKeyCallRva,'0x1839b6cc0');at(elemental,q.breakContainsCallRva,'0x1845220d0');
 for(const rva of [q.breakFoundDisposeCallRva,q.breakExhaustedDisposeCallRva,q.breakExceptionDisposeCallRva])at(elemental,rva,'0x180005a80');
 assert.equal(q.shieldTypeLoad.name,'BlockDamage');assert.equal(q.shieldEvent.name,'ON_TAKE_DAMAGE');assert.equal(q.shieldEvent.value,10);
 at(shield,q.shieldClearCallRva,'0x1839b7d60');at(shield,q.shieldEventInputRva,'ecx, 0xa');at(shield,q.shieldUIGetterCallRva,'0x180d95600');
 at(shield,q.shieldSetCallRva,'0x1839b7d60');at(shield,q.shieldMaskGetterCallRva,'0x180d955a0');at(shield,q.shieldMaskWriteRva,'dword ptr [r14 + 0x268], eax');
 assert.deepEqual(q.shieldFields.map(f=>[f.name,f.offset]),[['_showShieldUI',0x38],['_damageMask',0x14]]);
 assert.ok(castMethod(c,'BlockDamage','get_showShieldUI'));assert.ok(castMethod(c,'BlockDamage','get_damageMask'));assert.ok(castMethod(c,'Buff','set_hasShield'));
 assert.equal(q.nativeBreakDatabaseEffectsVerified,false);assert.equal(q.nativeShieldCastEffectsVerified,false);assert.equal(q.liveFinalFlagsPhaseVerified,false);
});

test('status initialization source binds private static arrays, byte switch and configured slowdown exclusion',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.statusInitialization;
 assert.deepEqual(q.staticArrays.map(a=>a.values),[[0,16,43,41],[0,16,23,43]]);
 assert.deepEqual(q.staticArrays[0].names,['STUNNED','FROZEN','DOZE','ATTRACTED']);
 for(const a of q.staticArrays){assert.equal(sha(Buffer.from(a.hex,'hex')),a.sha256);assert.equal(a.field.name.length,64);assert.equal(a.encodedUsage>>>29,4);}
 assert.equal(q.autoArrayField.offset,8);assert.equal(q.statusField.offset,0x27);assert.equal(q.slowDownConfigField.name,'slowDownTemplateKey');assert.equal(q.slowDownConfigField.offset,0x30);
 assert.deepEqual(q.switchEnum.fields.map(f=>[f.name,f.value]),[['NO',0],['YES',1],['AUTOMATIC',2]]);
 const init=castMethod(c,'Buff','_InitIsStatusResistable'),auto=castMethod(c,'Buff','_AutoCalcIsStatusResistable'),slow=castMethod(c,'Buff','_InitCanSlowDown');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(init,q.modeReadRva,'edx, byte ptr [rcx + 0x27]');at(init,q.autoMaskCallRva,'0x1839b63e0');at(init,q.autoBitTestRva,'rdi, rdx');at(init,q.autoPositiveBranchRva,'0x1839b3f6f');
 at(auto,q.standaloneAutoMaskCallRva,'0x1839b63e0');at(auto,q.standaloneAutoBitTestRva,'rdi, rdx');
 at(slow,q.slowDownConfigLoadRva,'rdx, qword ptr [rdx + 0x30]');at(slow,q.slowDownStringCompareTailRva,'0x1850d90f0');
 for(const ch of q.stringInequality.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.equal(q.nativeConfigEffectsVerified,false);assert.equal(q.liveStatusPhaseVerified,false);
});

test('priority/stack source binds auto sign,1000 scale, FP rounding and over-cap early return',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.priorityAndStack;
 const priority=castMethod(c,'Buff','_CalculatePriority'),stack=castMethod(c,'Buff','_DoUpdateStack');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(priority,q.autoPredicateCallRva,'0x18225d400');at(priority,q.staticPriorityReadRva,'eax, dword ptr [rdi + 0x98]');
 at(priority,q.attributeCountRva,'ebp, 0x26');at(priority,q.priorityMultiplyCallRva,'0x185a3b800');at(priority,q.roundCallRva,'0x185a42a50');
 at(priority,q.keyLookupCallRva,'0x182166830');at(priority,q.absoluteCallRva,'0x185a5bf20');at(priority,q.sumCallRva,'0x184175da0');
 assert.equal(q.priorityScale.hex,'00007a44');assert.equal(q.priorityScale.value,1000);
 const fpInit=c.methods.find(m=>m.type==='FP'&&m.name==='.cctor');assert.equal(fpInit.image,'Torappu.Common.dll');
 at(fpInit,q.maxValueConstantRva,'rax, 0x7ffffffffffffffe');at(fpInit,q.maxValueWriteRva,'qword ptr [rcx + 0x10], rax');
 at(stack,q.stackCapReadRva,'eax, dword ptr [rbx + 0x90]');at(stack,q.stackCountCompareRva,'dword ptr [rbx + 0x8c], eax');at(stack,q.overCapBranchRva,'0x1839b351b');
 at(stack,q.stackAttributeLoadCallRva,'0x1839b4460');at(stack,q.stackOwnerCallRva,'0x1839b6ff0');at(stack,q.stackOwnerAttributesCallRva,'0x183a29330');
 at(stack,q.stackMaskCallRva,'0x1839b64e0');at(stack,q.stackDirtyCallRva,'0x183957f70');
 assert.ok(instructions(castMethod(c,'BuffData','get_isAutoPriority')).some(i=>i.mnemonic==='shr'&&i.operands==='eax, 0x1f'));
 for(const m of q.math)for(const ch of m.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.equal(q.nativeOwnerDirtyEffectsVerified,false);assert.equal(q.livePriorityPhaseVerified,false);assert.equal(q.liveStackPhaseVerified,false);
});

test('attribute loader source binds status masks,38 entries, source conversion and snapshot ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.attributeLoading;
 const m=castMethod(c,'Buff','_LoadAttributesModifier'),at=(method,rva,args)=>assert.ok(instructions(method).some(i=>i.rva===rva&&i.operands===args));
 for(const rva of q.flagMaskCalls)at(m,rva,'0x1839b2f10');for(const rva of q.comboMaskCalls)at(m,rva,'0x1839b2ce0');
 at(m,q.clearMaskCallRva,'0x1839b7b00');at(m,q.arrayCountRva,'ebx, 0x26');
 for(const rva of q.arrayZeroWrites)assert.ok(instructions(m).some(i=>i.rva===rva&&i.mnemonic==='mov'));
 at(m,q.scalerOneWriteRva,'qword ptr [rdi + rsi*8 + 0x20], rax');at(m,q.defaultConversionCallRva,'0x185a3da20');
 at(m,q.blackboardLookupCallRva,'0x182167390');at(m,q.stackMultiplyCallRva,'0x185a3b800');at(m,q.sourceLockCallRva,'0x18477cad0');
 at(m,q.sourceValidityCallRva,'0x185ebec60');at(m,q.sourceAttributeCallRva,'0x183957db0');at(m,q.accumulateCallRva,'0x184175da0');
 at(m,q.attributeBitRva,'rbx, rcx');at(m,q.scalerMultiplyCallRva,'0x185a3b800');at(m,q.snapshotSourceLockCallRva,'0x18477cad0');at(m,q.snapshotCallRva,'0x1806d3aa0');
 at(castMethod(c,'Buff','_CalcAbnormalMask'),q.maskFlagBitRva,'r14, rax');at(castMethod(c,'Buff','_CalcAbnormalCombo'),q.maskComboBitRva,'r14, rax');
 assert.deepEqual(q.formulaType.fields.map(f=>[f.name,f.value]),[['ADDITION',0],['MULTIPLIER',1],['FINAL_ADDITION',2],['FINAL_SCALER',3]]);
 assert.equal(q.initialScalerConstant.hex,'0000803f');assert.equal(q.initialScalerConstant.value,1);
 for(const code of q.math)for(const ch of code.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.equal(q.nativeSourceSnapshotEffectsVerified,false);assert.equal(q.nativeModifierCollectionVerified,false);assert.equal(q.liveAttributePhaseVerified,false);
});

test('buff action loader source binds104 cleared slots, separate dictionary reads and identity event conversion',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.actionLoading;
 const m=castMethod(c,'Buff','_LoadActions'),at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(q.clearSlotCount,104);at(q.clearWriteRva,'qword ptr [rcx], rdi');at(q.clearLimitRva,'ebx, 0x68');at(q.countCallRva,'0x184ab9030');
 at(q.firstEntryCallRva,'0x184ab9220');at(q.eventConvertCallRva,'0x1828a66d0');at(q.secondEntryCallRva,'0x184ab9220');
 at(q.actionArrayReadRva,'rbx, qword ptr [rbx + 0x10]');at(q.assignabilityCallRva,'0x18040ffa0');at(q.eventWriteRva,'qword ptr [rcx], rbx');
 assert.deepEqual(q.specifications.map(s=>s.definition.name),['get_Count','get_Item','Convert']);assert.ok(q.specifications.every(s=>s.nativeMapping===null));
 assert.deepEqual(q.specifications[0].instantiations.class.arguments.map(a=>a.name),['Event','EventToAction']);
 const chunk=q.conversion.chunks[0],raw=Buffer.from(chunk.base64,'base64');assert.equal(raw.toString('hex'),'8bc1c3');assert.equal(sha(raw),chunk.sha256);
 assert.equal(q.nativeDictionaryEffectsVerified,false);assert.equal(q.nativeArrayAssignabilityVerified,false);assert.equal(q.liveActionLoadingPhaseVerified,false);
});

test('ordinary pair assignment source binds empty-destination AddRange and raw whole-pair replacement',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.blackboardPairAssignments;
 const m=c.methods.find(m=>m.type==='Blackboard'&&m.entryRva===0x21653b0),at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(q.emptyDestinationBranchRva,'0x182165782');at(q.emptyDestinationAddRangeTailRva,'0x18450dea0');at(q.sourcePairReadCallRva,'r10');
 at(q.sourcePairCopyRva,'xmm0, xmmword ptr [rax]');at(q.internalCompareCallRva,'0x1850cd8b0');at(q.internalReplaceCallRva,'0x184520160');
 at(q.internalAppendVersionRva,'dword ptr [rdi + 0x1c]');at(q.internalAppendPairCopyRva,'xmmword ptr [rcx], xmm0');
 assert.equal(q.addRangeSpecification.declaringType,'List`1');assert.equal(q.addRangeSpecification.definition.name,'AddRange');
 assert.equal(q.addRangeSpecification.instantiations.class.arguments[0].name,'DataPair');
 assert.ok(instructions(castMethod(c,'Blackboard','ContainsKey')).some(i=>i.rva===q.containsCompareCallRva&&i.operands==='0x1850cd8b0'));
 assert.equal(q.arrayProjectionVerified,false);assert.equal(q.nativeListVersioningVerified,false);assert.equal(q.liveAssignmentPhaseVerified,false);
});

test('blackboard scalar conversion source binds floor finite branches and exact scalar constants',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.blackboardReads.scalarConversions;
 assert.deepEqual(q.constants.map(v=>v.value),[-1,1,4294967296]);assert.equal(q.selectedScalarResultVerified,true);
 assert.equal(q.nativeExceptionStateVerified,false);assert.equal(q.nanTailEffectsVerified,false);
 for(const m of [q.floor,q.floatToFP])for(const ch of m.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.equal(instructions(q.floor).length,44);assert.equal(instructions(q.floor).at(-1).rva,0x4d0173);
 assert.ok(instructions(q.floor).some(i=>i.rva===0x4d016b&&i.mnemonic==='subsd'));
 assert.deepEqual(instructions(q.floatToFP).map(i=>i.mnemonic),['mulss','cvttss2si','ret']);
});

test('blackboard numeric read source binds numeric filtering and found/out conversion ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.blackboardReads;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const number=castMethod(c,'Blackboard','_TryGetNumber');at(number,q.numberCompareCallRva,'0x1850cd8b0');at(number,q.numberPredicateCallRva,'0x181cdfdb0');
 at(number,q.numberValueReadRva,'xmm0, dword ptr [rsp + 0x50]');at(number,q.numberMissingOutWriteRva,'dword ptr [rsi], 0');at(number,q.numberFoundOutWriteRva,'dword ptr [rsi], xmm0');
 const fp=castMethod(c,'Blackboard','TryGetFP');at(fp,q.fpNumberCallRva,'0x182167b50');at(fp,q.fpConversionCallRva,'0x185a3da20');at(fp,q.fpOutWriteRva,'qword ptr [rbx], rax');
 const fpDefault=castMethod(c,'Blackboard','GetFpOrDefault');at(fpDefault,q.fpDefaultNumberCallRva,'0x182167b50');at(fpDefault,q.fpDefaultConversionCallRva,'0x185a3da20');
 const integer=castMethod(c,'Blackboard','TryGetInt');at(integer,q.intNumberCallRva,'0x182167b50');at(integer,q.intMissingOutWriteRva,'dword ptr [rbx], 0');
 at(integer,q.intFloorCallRva,'0x1804d00c4');at(integer,q.intConversionRva,'eax, xmm0');at(integer,q.intOutWriteRva,'dword ptr [rbx], eax');
 at(castMethod(c,'Blackboard','GetIntOrDefault'),q.intDefaultTryCallRva,'0x182167520');
 const predicate=castMethod(c,'DataPair','get_isNumericValue');assert.ok(instructions(predicate).some(i=>i.mnemonic==='jmp'&&i.operands==='0x1850d34b0'));
 assert.equal(q.nativeNumberConversionVerified,false);assert.equal(q.liveReadPhaseVerified,false);
});

test('blackboard write source binds key lowering, original-key comparison and whole-pair replacement',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.blackboardWrites;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const numeric=c.methods.find(m=>m.type==='Blackboard'&&m.entryRva===0x21659a0),string=c.methods.find(m=>m.type==='Blackboard'&&m.entryRva===0x2165800);
 at(numeric,q.numericLowerCallRva,'0x1850d8500');at(numeric,q.numericPairConstructorCallRva,'0x182262300');
 at(numeric,q.numericIgnoreCaseInputRva,'r8b, 1');at(numeric,q.numericCompareCallRva,'0x1850cd8b0');
 at(numeric,q.numericAppendCallRva,'0x18001b340');at(numeric,q.numericReplaceCallRva,'0x184520160');
 at(string,q.stringLowerCallRva,'0x1850d8500');at(string,q.stringPairConstructorCallRva,'0x1822622c0');
 at(string,q.stringIgnoreCaseInputRva,'r8b, 1');at(string,q.stringCompareCallRva,'0x1850cd8b0');
 at(string,q.stringAppendCallRva,'0x18001b340');at(string,q.stringReplaceCallRva,'0x184520160');
 const numberPair=c.methods.find(m=>m.type==='DataPair'&&m.entryRva===0x2262300),stringPair=c.methods.find(m=>m.type==='DataPair'&&m.entryRva===0x22622c0);
 at(numberPair,q.numericPairValueWriteRva,'dword ptr [rbx + 8], xmm6');at(numberPair,q.numericPairStringClearRva,'qword ptr [rcx], 0');
 at(stringPair,q.stringPairValueClearRva,'dword ptr [rbx + 8], 0');at(stringPair,q.stringPairStringWriteRva,'qword ptr [rcx], rdi');
 const lower=castMethod(c,'String','ToLower'),compare=castMethod(c,'String','Compare');assert.equal(lower.image,'mscorlib.dll');assert.equal(compare.image,'mscorlib.dll');
 assert.ok(instructions(compare).some(i=>i.mnemonic==='jmp'&&i.operands==='0x1850cda20'));
 assert.equal(compare.tailTargetRva,0x50cda20);assert.equal(compare.tailTargetBodyRetained,false);
 assert.equal(q.nativeCultureEffectsVerified,false);assert.equal(q.nativeListVersioningVerified,false);assert.equal(q.liveWritePhaseVerified,false);
});

test('blackboard prefix source binds OrdinalIgnoreCase, key substring and separate numeric/string writes',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.blackboardPrefix;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const numeric=castMethod(c,'Blackboard','AssignByPrefix'),string=castMethod(c,'Blackboard','AssignValueStrByPrefix');
 at(numeric,q.numericComparisonInputRva,'r8d, [rcx + 5]');at(numeric,q.numericStartsWithCallRva,'0x1850d7620');at(numeric,q.numericSubstringCallRva,'0x1850d7a60');
 at(numeric,q.numericWriteCallRva,'0x1821659a0');at(numeric,q.numericLoopIncrementRva,'ebp');
 at(string,q.stringComparisonInputRva,'r8d, [rcx + 5]');at(string,q.stringStartsWithCallRva,'0x1850d7620');at(string,q.stringSubstringCallRva,'0x1850d7a60');
 at(string,q.stringPredicateCallRva,'0x180c8e070');at(string,q.stringWriteCallRva,'0x182165800');at(string,q.stringLoopIncrementRva,'r14d');
 const predicate=castMethod(c,'DataPair','get_isStringValue');assert.equal(predicate.typeIndex,q.dataPairTypeIndex);
 assert.deepEqual(q.dataPairFields.map(f=>[f.name,f.offset]),[['key',0x10],['value',0x18],['valueStr',0x20]]);
 assert.ok(instructions(predicate).some(i=>i.mnemonic==='call'&&i.operands==='0x1850d34b0'));
 assert.equal(q.nativeStringComparisonVerified,false);assert.equal(q.destinationWritesVerified,false);assert.equal(q.livePrefixPhaseVerified,false);
});

test('Reset blackboard source binds virtual equality copies, prefix operations and duration fallback ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetBlackboard;
 const m=castMethod(c,'Buff','Reset'),at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(q.prefixFormat.value,'{0}.');at(q.firstEqualsCallRva,'0x180005860');at(q.secondEqualsCallRva,'0x180005860');
 at(q.firstCopyCallRva,'0x182167de0');at(q.secondCopyCallRva,'0x182167de0');at(q.firstKeyCallRva,'0x1839b6cc0');at(q.secondKeyCallRva,'0x1839b6cc0');
 at(q.formatCallRva,'0x1850d1db0');for(const rva of q.prefixAssignCalls)at(rva,'0x182164c20');
 for(const rva of q.prefixValueAssignCalls)at(rva,'0x182164f60');at(q.prefixDataAssignCallRva,'0x1821653b0');at(q.containsDurationCallRva,'0x182165b40');
 at(q.firstDurationCallRva,'0x182167390');at(q.secondDurationCallRva,'0x182167390');at(q.assignDurationCallRva,'0x1821652f0');
 for(const rva of q.ordinaryAssignCalls)at(rva,'0x1821653b0');
 assert.ok(q.secondDurationCallRva<q.assignDurationCallRva);assert.ok(q.firstCopyCallRva<0x39b1341&&q.secondCopyCallRva<0x39b1341);
 for(const ch of q.equalsDispatch.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.equal(q.equalsDispatch.concreteEqualsVerified,false);assert.equal(q.nativeBlackboardEffectsVerified,false);assert.equal(q.fullResetEffectsVerified,false);
});

test('final lifetime modifier binds Enemy mass level and LEVITATE rather than generic status resistance',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.lifetimeModifier;
 const m=castMethod(c,'Buff','_ModifyLifeTimeFinally'),at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(q.ownerFirstCallRva,'0x1839b6ff0');at(q.ownerFirstValidityCallRva,'0x185ebec60');at(q.ownerSecondCallRva,'0x1839b6ff0');
 at(q.enemyValidityCallRva,'0x185ebee90');assert.equal(q.enemyTypeLoad.definitionIndex,q.massLevelSlot.typeIndex);
 assert.equal(q.massLevelSlot.type,'Enemy');assert.equal(q.massLevelSlot.slot,198);assert.equal(q.massLevelSlot.name,'get_massLevel');
 assert.equal(q.levitate.name,'LEVITATE');assert.equal(q.levitate.value,25);at(q.levitateInputRva,'edx, 0x19');at(q.containsCallRva,'0x183f5f300');
 at(q.massLevelInputRva,'ecx, 0xc6');at(q.massLevelCallRva,'0x1800057b0');at(q.massThresholdRva,'eax, 3');
 at(q.divisorInputRva,'ecx, [rdx + 2]');at(q.divisionCallRva,'0x185a3d680');at(q.lifetimeWriteRva,'qword ptr [rdi + 0x70], rax');
 for(const ch of q.division.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.ok(castMethod(c,'Buff','get_owner'));assert.ok(castMethod(c,'Enemy','get_massLevel'));
 assert.equal(q.nativeOwnerFlagEffectsVerified,false);assert.equal(q.liveModifierPhaseVerified,false);
});

test('Reset lifetime source binds captured duration lookup, infinity sentinel and post-modifier state copies',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetLifetime;
 const m=castMethod(c,'Buff','Reset'),at=(method,rva,args)=>assert.ok(instructions(method).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(q.durationLiteral.value,'duration');assert.equal(q.infinityField.offset,0x18);
 assert.deepEqual(q.dataFields.map(f=>[f.name,f.offset]),[['durationKey',0x78],['lifeTime',0x80],['lifeTimeType',0x70]]);
 const init=castMethod(c,'Buff','.cctor');at(init,q.infinityIntInputRva,'ecx, [rdx - 1]');at(init,q.infinityConversionCallRva,'0x185a3da10');at(init,q.infinityWriteRva,'qword ptr [rdx + 0x18], rax');
 at(m,q.lookupCallRva,'0x182167390');at(m,q.fallbackConversionCallRva,'0x185a3da20');at(m,q.fallbackWriteRva,'qword ptr [rsi + 0x70], rax');
 at(m,q.conditionalCallRva,'0x18402c5b0');at(m,q.selectedLifetimeWriteRva,'qword ptr [rsi + 0x70], rax');at(m,q.modifyCallRva,'0x1839b4e50');
 at(m,q.remainingWriteRva,'qword ptr [rsi + 0x78], rax');at(m,q.existingWriteRva,'qword ptr [rsi + 0x80], rax');
 assert.ok(q.modifyCallRva<q.remainingWriteRva&&q.remainingWriteRva<q.existingWriteRva);
 const ch=q.conditional.chunks[0],raw=Buffer.from(ch.base64,'base64');assert.equal(raw.length,20);assert.equal(sha(raw),ch.sha256);
 assert.deepEqual(instructions(q.conditional).map(i=>i.mnemonic),['test','je','cmp','je','mov','ret','mov','ret','xor','ret']);
 assert.ok(castMethod(c,'Buff','_ModifyLifeTimeFinally'));assert.equal(q.modifierEffectsVerified,false);assert.equal(q.fullResetEffectsVerified,false);assert.equal(q.liveLifetimePhaseVerified,false);
});

test('Reset trigger source binds exact blackboard literals and byte-conditional count selection',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetTriggers;
 assert.deepEqual(q.literals.map(l=>l.value),['interval','trig_cnt','first_trigger_interval']);
 assert.deepEqual(q.dataFields.map(f=>[f.name,f.offset]),[['triggerLifeType',0x84],['triggerCnt',0x88],['triggerInterval',0x8c],['waitFirstTriggerInterval',0x90],['firstTriggerInterval',0x94]]);
 const m=castMethod(c,'Buff','Reset'),at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(q.conditionalCallRva,'0x18402c5d0');at(q.initialCountWriteRva,'dword ptr [rsi + 0x88], eax');
 at(q.intervalLookupCallRva,'0x182166830');at(q.countLookupCallRva,'0x182166990');at(q.overrideCountWriteRva,'dword ptr [rsi + 0x88], eax');
 at(q.firstLookupCallRva,'0x182166830');at(q.triggerableCompareRva,'dword ptr [rsi + 0x88], ebp');at(q.triggerableCallRva,'0x1839b81f0');
 const ch=q.conditional.chunks[0],raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,18);
 assert.deepEqual(instructions(q.conditional).map(i=>i.mnemonic),['test','je','cmp','cmovne','mov','ret','xor','ret']);
 assert.ok(castMethod(c,'Blackboard','GetFpOrDefault'));assert.ok(castMethod(c,'Blackboard','GetIntOrDefault'));assert.ok(castMethod(c,'Buff','set_triggerable'));
 assert.equal(q.fullResetEffectsVerified,false);assert.equal(q.liveTriggerSchedulingVerified,false);
});

test('Reset timing source binds PeriodicTimer invalidation, initial wait and signed min/max operations',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetTiming;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(q.timerFields.map(f=>[f.name,f.offset]),[['m_periodTime',0x10],['m_remainingTime',0x18]]);
 const reset=castMethod(c,'Buff','Reset');at(reset,q.markInvalidCallRva,'0x181c5d670');at(reset,q.resetCallRva,'0x181c5d990');at(reset,q.setRemainingCallRva,'0x181c5dbb0');
 const timerReset=castMethod(c,'PeriodicTimer','Reset');at(timerReset,q.resetMaxCallRva,'0x185a5c940');
 at(timerReset,q.resetPeriodWriteRva,'qword ptr [rsi + 0x10], rax');at(timerReset,q.resetRemainingWriteRva,'qword ptr [rsi + 0x18], rax');
 const invalid=castMethod(c,'PeriodicTimer','MarkInvalid');at(invalid,q.invalidRemainingWriteRva,'qword ptr [rbx + 0x18], rax');at(invalid,q.invalidPeriodWriteRva,'qword ptr [rbx + 0x10], rax');
 at(invalid,0x1c5d6ac,'ecx, [rdx - 1]');at(invalid,0x1c5d6af,'0x185a3da10');
 const remaining=castMethod(c,'PeriodicTimer','SetRemainingTime');at(remaining,q.remainingMinCallRva,'0x185a5ca50');at(remaining,q.remainingWriteRva,'qword ptr [rsi + 0x18], rax');
 for(const m of q.math)for(const ch of m.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.equal(instructions(q.math[2])[1].mnemonic,'setg');assert.equal(instructions(q.math[3])[1].mnemonic,'setl');
 assert.equal(q.fullResetEffectsVerified,false);assert.equal(q.liveTimerSchedulingVerified,false);
});

test('Reset source binds lifecycle clearing independently of allocation UID and validity',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetLifecycle;
 const m=castMethod(c,'Buff','Reset'),at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(m.entryRva,0x39b0d60);assert.equal(instructions(m).length,896);
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['m_started',0x1e8],['m_isFinished',0x1e9],['m_needRemove',0x1eb],
  ['m_isActuallyEnabled',0x1ec],['m_isLateEnabled',0x1ed],['m_isManuallyEnabled',0x1ee],['m_isActuallyFinished',0x1ea],['m_derivedBuffs',0x260]]);
 at(q.startedFinishedWriteRva,'word ptr [rsi + 0x1e8], bp');at(q.removeEnabledWriteRva,'dword ptr [rsi + 0x1eb], ebp');
 at(q.actuallyFinishedWriteRva,'byte ptr [rsi + 0x1ea], bpl');at(q.derivedNullTestRva,'rcx, rcx');
 at(q.derivedVersionIncrementRva,'dword ptr [rcx + 0x1c]');at(q.derivedCountWriteRva,'dword ptr [rcx + 0x18], ebp');
 at(q.derivedClearArrayCallRva,'0x1851ce000');assert.equal(q.fullResetEffectsVerified,false);assert.equal(q.liveResetPhaseVerified,false);
});

test('runtime cleanup source binds subsystem order around immediate delayed-buff recycling',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.recycleQueue.runtimeCleanup;
 const m=castMethod(c,'BattleController','ClearRunTimeData'),at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(q.globalBuffField.name,'m_globalBuffs');assert.equal(q.globalBuffField.offset,0x68);
 assert.equal(q.liveLifecyclePhaseVerified,false);assert.equal(q.subsystemEffectsVerified,false);
 for(const[key,target]of [['loggerClearCallRva',0x3a35060],['runeGetterCallRva',0x3993d90],['runeClearCallRva',0x9ffb50],
  ['initialCountCallRva',0x3f64f60],['readGlobalBuffCallRva',0x4527e70],['objectValidityCallRva',0x5a445f0],
  ['recycleGlobalBuffCallRva',0x28a91e0],['loopCountCallRva',0x3f64f60],['blackboardGetterCallRva',0x3991d60],
  ['blackboardResetCallRva',0x39a5400],['environmentRemoveAllCallRva',0x5718a0],['shaderResetCallRva',0x3968e00],
  ['resourcesClearCallRva',0x3986e30],['immediateFlushCallRva',0x398e200],['staticClearTailRva',0x3987060]])at(q[key],'0x'+(0x180000000+target).toString(16));
 at(q.clearGlobalBuffCountRva,'dword ptr [rcx + 0x18], 0');
 assert.deepEqual(q.effects.map(e=>[e.type,e.definition.name]),[
  ['BattleLogger','ClearAll'],['RuneManager','Clear'],['PoolManager','Recycle'],['BattleGlobalBlackboard','Reset'],
  ['GlobalEnvSystemController','RemoveAll'],['SpineShaderManager','ResetAllSpineShaders'],
  ['BattleController','_ClearResourcesInHolder'],['BattleController','_ClearStaticVariables']]);
 assert.ok(q.clearGlobalBuffCountRva<q.blackboardResetCallRva&&q.resourcesClearCallRva<q.immediateFlushCallRva&&q.immediateFlushCallRva<q.staticClearTailRva);
 assert.ok(castMethod(c,'BattleController','get_runeManager'));assert.ok(castMethod(c,'BattleController','get_globalBlackboard'));
});

test('finish effects bind UID-map removal, MarkFinish/OnFinish flags and delayed recycle queue after native completion',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),effects=c.modeSwitch.buffNotification.finishEffects;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(effects.selectedFlags,{updateOverrideMap:true,delayToRecycle:true,immediatelyFinishEffect:false});assert.equal(effects.nativeQueueTimingVerified,false);
 assert.deepEqual(effects.parameters.find(m=>m.name==='_FinishBuff').parameters.map(p=>p.name),['buff','updateOverrideMap','delayToRecycle','immediatelyFinishEffect']);
 assert.deepEqual(effects.parameters.find(m=>m.name==='MarkFinish').parameters.map(p=>p.name),['updateOverrideMap']);
 assert.deepEqual(effects.parameters.find(m=>m.name==='OnFinish').parameters.map(p=>p.name),['immediatelyFinishEffect']);
 const remove=castMethod(c,'BuffContainer','_FinishAndRemoveBuff');at(remove,effects.uidMapRemoveCallRva,'0x184c53dd0');
 at(remove,0x39d7c6d,'r9b, 1');at(remove,0x39d7c79,'r8d, r9b');at(remove,0x39d7c7d,'byte ptr [rsp + 0x20], 0');
 at(remove,effects.finishBuffCallRva,'0x1839d7ce0');
 const finish=castMethod(c,'BuffContainer','_FinishBuff');at(finish,effects.markFinishCallRva,'0x1839aaf00');at(finish,effects.onFinishCallRva,'0x1839ade40');
 at(finish,0x39d7d8d,'0x1839d7e2d');at(finish,effects.queueRecycleCallRva,'0x1839805b0');
 const group=castMethod(c,'OverrideGroup','Remove');at(group,0x39deff6,'0x1839df002');at(group,0x39deffd,'0x1839df770');
 assert.ok(castMethod(c,'BattleController','RecycleBuffNextFrame'));assert.ok(castMethod(c,'OverrideGroup','_DoUpdateInternal'));
});

test('finished buff source binds reverse traversal and override cleanup after finish/remove',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),cleanup=c.modeSwitch.buffNotification.finishedCleanup;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const check=castMethod(c,'BuffContainer','_CheckFinishedBuffs');assert.equal(cleanup.concreteContextVerified,false);
 at(check,cleanup.reverseIteratorCallRva,'0x184d96d10');at(check,cleanup.finishRemoveCallRva,'0x1839d7a50');
 at(check,cleanup.firstOverrideKeyCallRva,'0x1839b6f70');at(check,cleanup.secondOverrideKeyCallRva,'0x1839b6f70');
 at(check,cleanup.overrideLookupCallRva,'0x184c0e320');at(check,cleanup.groupRemoveCallRva,'0x1839defb0');
 at(check,cleanup.sawNullBranchRva,'r15b, 1');at(check,cleanup.cleanupGateRva,'0x1839d6c7d');
 for(const method of cleanup.canonicalReverseMethods)for(const ch of method.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 const find=name=>cleanup.canonicalReverseMethods.find(m=>m.definition.name===name);
 const move=find('MoveNext');assert.equal(move.entryRva,0x4aa4460);
 assert.deepEqual(instructions(move).map(i=>[i.mnemonic,i.operands]),[['mov','eax, dword ptr [rcx + 0x18]'],['dec','eax'],
  ['mov','dword ptr [rcx + 0x18], eax'],['shr','eax, 0x1f'],['xor','al, 1'],['ret','']]);
 at(find('GetInversedEnumerator'),0x4d96d64,'word ptr [rbx + 0x20], ax');at(find('GetInversedEnumerator'),0x4d96d6b,'0x184d96db5');
 at(find('.ctor'),0x4aa45c3,'dword ptr [rbx + 0x18], eax');
 assert.ok(castMethod(c,'BuffContainer','_FinishAndRemoveBuff'));assert.ok(castMethod(c,'OverrideGroup','Remove'));
});

test('buff ObjectPtr source separates null/UID identity from enabled or finished state and retains both constructor samples',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),pointer=c.modeSwitch.buffNotification.pointer;
 assert.deepEqual(pointer.fields.map(f=>f.name),['obj','cachedUid']);assert.equal(pointer.concreteContextVerified,false);
 assert.deepEqual(pointer.buffLineage.map(t=>[t.namespace,t.name]),[['Torappu.Battle','Buff'],['System','Object']]);
 for(const spec of pointer.concreteSpecifications){assert.equal(spec.nativeMapping,null);assert.equal(spec.instantiations.class.arguments[0].name,'Buff');}
 for(const method of pointer.canonicalMethods)for(const ch of method.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 const find=name=>pointer.canonicalMethods.find(m=>m.definition.name===name),at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const ctor=find('.ctor');at(ctor,0x477cc69,'0x180005250');at(ctor,0x477cc70,'0x18477ccd2');
 at(ctor,0x477ccbf,'0x180005250');at(ctor,0x477ccc4,'dword ptr [rdi + 8], eax');
 at(ctor,0x477ccd4,'qword ptr [rdi], rax');at(ctor,0x477ccd7,'dword ptr [rdi + 8], eax');
 const valid=find('get_isValid');at(valid,0x477cdd2,'0x185a445f0');at(valid,0x477cdfe,'eax, dword ptr [rbx + 8]');
 const lock=find('Lock');at(lock,0x477cafc,'0x1800b9be0');at(lock,0x477cb05,'rax, qword ptr [rbx]');
 assert.ok(castMethod(c,'ObjectExtensions','IsDestroyedOrNull'));
});

test('buff list mutation binds event priority insertion, reverse UID removal and loop-gated invalid cleanup',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),list=c.modeSwitch.buffNotification.listMutation;
 assert.equal(list.uidField.offset,0x208);assert.equal((list.uidField.typeBits>>>16)&255,9);
 assert.equal(list.priorityField.offset,0x24c);assert.equal((list.priorityField.typeBits>>>16)&255,17);
 assert.equal(list.priorityType.name,'OnEventPriority');assert.equal((list.priorityType.underlyingField.typeBits>>>16)&255,8);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const add=castMethod(c,'SortedDoubleBufferedBuffList','Add'),remove=castMethod(c,'DoubleBufferedBuffList','Remove');
 assert.equal(add.entryRva,list.addMethodRva);assert.equal(remove.entryRva,list.removeMethodRva);
 at(add,0x39dfb42,'0x184d966a0');at(add,0x39dfbdf,'0x1839b6e50');at(add,0x39dfc31,'0x1839b6e50');
 at(add,0x39dfc36,'ebp, eax');at(add,0x39dfc38,'0x1839dfc83');at(add,0x39dfc97,'edx, [rbx + 1]');
 at(remove,0x39ded08,'0x1839b6970');at(remove,0x39ded14,'0x1839b6970');at(remove,0x39ded1b,'0x1839ded3d');
 at(remove,0x39ded1d,'edi, 1');at(remove,0x39ded4f,'0x184515c00');
 const clear=castMethod(c,'DoubleBufferedBuffList','ClearInvalidElementsIfNotLoop');assert.equal(clear.entryRva,list.clearInvalidMethodRva);
 at(clear,0x39de98e,'0x184d97fd0');at(clear,0x39de995,'0x1839dea0f');at(clear,0x39dea00,'0x184515c00');
 at(castMethod(c,'Buff','get_instanceUid'),0x39b69c4,'eax, dword ptr [rbx + 0x208]');
 at(castMethod(c,'Buff','get_onEventPriority'),0x39b6ea7,'eax, dword ptr [rbx + 0x24c]');
 assert.ok(c.modeSwitch.buffNotification.forwardIteration.canonicalMethods.some(m=>m.definition.name==='get_isInLoop'&&m.entryRva===0x4d980a0));
 assert.equal(list.isInLoopCall.specificationIndex,229767);assert.equal(list.isInLoopCall.definitionIndex,23977);
 assert.equal(list.isInLoopCall.entryRva,0x4d97fd0);assert.equal(list.isInLoopCall.nativeMapping,null);assert.equal(list.isInLoopCall.concreteContextVerified,false);
 for(const ch of list.isInLoopCall.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
});

test('buff forward iteration retains mapped canonical code and the separately bound closed ObjectPtr Buff argument',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),f=c.modeSwitch.buffNotification.forwardIteration;
 assert.equal(f.concreteSpecification.index,38599);assert.equal(f.concreteSpecification.definitionIndex,23983);
 assert.equal(f.concreteSpecification.argument,'Torappu.ObjectPtr<Torappu.Battle.Buff>');assert.equal(f.concreteSpecification.nativeMapping,null);
 assert.equal(f.buffLockSpecification.definition.name,'Lock');assert.equal(f.buffLockSpecification.instantiations.class.arguments[0].name,'Buff');
 assert.equal(f.concreteContextVerified,false);assert.equal(f.poolRuntimeVerified,false);
 assert.deepEqual(f.fields.map(field=>field.name),['m_internalList','m_cachedBuffer','m_eCounter','m_forwardEnumeratorPool','m_backwardEnumeratorPool']);
 for(const method of f.canonicalMethods){
  assert.equal(method.instantiations.class.arguments[0].name,'Object');assert.ok(method.nativeMapping);
  for(const chunk of method.chunks){const raw=Buffer.from(chunk.base64,'base64');assert.equal(sha(raw),chunk.sha256);assert.equal(raw.length,chunk.endRva-chunk.beginRva);}
 }
 const find=name=>f.canonicalMethods.find(m=>m.definition.name===name);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(find('GetEnumerator'),0x4d96afd,'ecx, word ptr [rbx + 0x20]');at(find('GetEnumerator'),0x4d96b04,'word ptr [rbx + 0x20], ax');
 at(find('GetEnumerator'),0x4d96b0b,'0x184d96b55');at(find('GetEnumerator'),0x4d96b2c,'qword ptr [rax + 8]');
 at(find('GetEnumerator'),0x4d96b52,'qword ptr [rax + 8]');
 at(find('_ForwardEnumeratorOnDispose'),0x4d974b5,'word ptr [rbx + 0x20], ax');
 at(find('Dispose'),0x432ed30,'byte ptr [rbx + 0x1c], 1');
 at(find('MoveNext'),0x432ed73,'dword ptr [rcx + 0x18], ebx');at(find('MoveNext'),0x432edaa,'rbx, qword ptr [rsp + 0x30]');
});

test('buff mode notification source binds event75 and preserves context target through its action dispatcher',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),n=c.modeSwitch.buffNotification;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(n.event.name,'ON_UNIT_SWITCH_MODE');assert.equal(n.event.value,75);assert.equal(n.event.encodedHex,'8096');
 assert.equal(n.setTargetToOwner,false);assert.equal(n.nativeIteratorRuntimeVerified,false);
 const buff=castMethod(c,'Buff','OnUnitSwitchMode'),container=castMethod(c,'BuffContainer','OnUnitSwitchMode');
 at(container,n.containerProbeCallRva,'0x1839d6660');at(container,n.containerCleanupCallRva,'0x1839d6870');
 at(container,0x39d2bf7,'0x1839d2d90');at(container,0x39d2d00,'0x1839b6a60');
 at(container,0x39d2d12,'0x1839b0c00');at(container,0x39d2d48,'0x180005a80');
 at(buff,n.buffActionCheckCallRva,'0x1839b4170');at(buff,0x39b0c6c,'r9d, r9d');
 at(buff,0x39b0c80,'r8d, [r9 + 0x4b]');at(buff,n.buffRunActionsCallRva,'0x1839b5370');
 const probe=castMethod(c,'BuffContainer','_CheckBuffsActionValid');
 at(probe,0x39d67b2,'0x1839b4170');at(probe,0x39d67d0,'0x180005a80');
 for(const name of ['get_isFinishedOrDisabled','get_isFinished','get_isEnabled','_IsActionValid'])assert.ok(castMethod(c,'Buff',name));
});

test('enemy mode notification source binds Unit range/buff notifications before nonroot skill transitions',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),n=c.modeSwitch.notification;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(n.skillsField.name,'m_skills');assert.equal(n.skillsField.offset,0x498);
 assert.equal(n.skillParentField.name,'<parentMode>k__BackingField');assert.equal(n.skillParentField.offset,0x78);
 for(const slot of n.rangeChangedSlots){assert.equal(slot.slot,127);assert.equal(slot.name,'OnAttackRangeChanged');}
 const unit=castMethod(c,'Unit','OnSwitchMode'),enemy=castMethod(c,'Enemy','OnSwitchMode');
 at(unit,n.rangeChangedCallRva,'qword ptr [rax + 0x928]');at(unit,n.buffCallRva,'0x1839d2b50');
 at(enemy,n.baseCallRva,'0x180852f10');at(enemy,n.rootCallRva,'0x183a05eb0');
 at(enemy,n.nextParentCallRva,'0x183a06160');at(enemy,n.previousParentCallRva,'0x183a06160');
 at(enemy,n.attachCallRva,'0x183a03970');at(enemy,n.detachCallRva,'0x183a04430');
 at(enemy,0x80affb,'0x18080b076');at(enemy,0x80b034,'0x18080b071');
 for(const name of ['get_parentMode','get_isRoot','Attach','Detach'])assert.ok(castMethod(c,'EnemySkill',name));
 assert.ok(castMethod(c,'BuffContainer','OnUnitSwitchMode'));
});

test('mode callback source binds BasicTalent validity and attachment predicates before ordered dynamic ability effects',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),effects=c.modeSwitch.modeEffects;
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(effects.fields.map(f=>[f.name,f.offset]),[['m_dynaimcAbilites',0x98],['<talents>k__BackingField',0xc8]]);
 assert.equal(effects.talentAttachedSlot.slot,6);assert.equal(effects.talentAttachedSlot.name,'get_isAttached');
 const activate=castMethod(c,'UnitMode','OnActivate'),inactive=castMethod(c,'UnitMode','OnInactivate');
 at(activate,effects.activation.validCallRva,'0x180719aa0');at(activate,effects.activation.attachedCallRva,'0x1800057b0');
 at(activate,effects.activation.attachCallRva,'0x180718210');at(activate,effects.activation.dynamicAttachRva,'0x18390e170');
 at(inactive,effects.inactivation.validCallRva,'0x180719aa0');at(inactive,effects.inactivation.attachedCallRva,'0x1800057b0');
 at(inactive,effects.inactivation.detachCallRva,'0x1807186f0');at(inactive,effects.inactivation.dynamicDetachRva,'0x18390e4a0');
 at(activate,0x86fcc3,'0x18086fda3');
 for(const name of ['get_isValid','get_isAttached','Attach','Detach','SetParentMode'])assert.ok(castMethod(c,'BasicTalent',name));
});

test('mode lifecycle binds the initialized ability array and the exact startIniting gate rather than alive state',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),l=c.modeSwitch.lifecycle;
 assert.equal(l.abilityArrayField.name,'m_abilities');assert.equal(l.abilityArrayField.offset,0x90);
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const activate=castMethod(c,'Unit','ActivateMode'),inactive=castMethod(c,'Unit','InactiveMode');
 assert.equal(l.attachGate.method,'get_startIniting');assert.equal(l.attachGate.calleeRva,0x3a2f650);
 at(activate,l.attachGate.callRva,'0x183a2f650');at(activate,0x84cf96,'0x18084d008');
 at(castMethod(c,'Entity','get_startIniting'),0x3a2f6a7,'eax, byte ptr [rbx + 0x89]');
 at(activate,l.attachCall.callRva,'0x18390e170');at(inactive,l.detachCall.callRva,'0x18390e4a0');
 at(inactive,0x850946,'qword ptr [rax + 0x1c8]');at(inactive,0x850968,'0x185eb6b60');
 at(activate,0x84cf85,'0x185eb6b60');at(activate,0x84d02d,'qword ptr [rax + 0x1b8]');
 assert.deepEqual(l.modeSlots.map(s=>[s.slot,s.name]),[[8,'OnActivate'],[9,'OnInactivate']]);
 for(const slot of l.faceSlots){assert.equal(slot.slot,10);assert.equal(slot.name,'get_faceTo');}
 const core=c.methods.find(m=>m.entryRva===0x854d20);
 at(core,l.lastModeResampledAfterInactive.readRva,'r14, qword ptr [rbx + 0x1e8]');
 at(core,l.lastModeResampledAfterInactive.writeRva,'qword ptr [rbx + 0x1e8], rsi');
 at(core,0x854f3d,'0x183a1af00');at(core,0x854f50,'0x183a23fa0');
});

test('selected InstantKill binds Suicide no-source/reborn parameters, suicide mark and SetHpInternal dispatch',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json');
 assert.deepEqual(c.entityParameters.Suicide.map(p=>p.name),['noSource','skipReborn']);
 assert.deepEqual(c.entityParameters.SetHpInternal.map(p=>p.name),['value','force','noSource','skipReborn']);
 assert.equal(c.suicideFlag.name,'m_isSuicide');assert.equal(c.suicideFlag.offset,0xd1);
 for(const slot of c.entitySlots)assert.equal(slot.name,slot.slot===38?'get_alive':'SetHpInternal');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const kill=castMethod(c,'InstantKill','Execute');
 at(kill,0xd9ff96,'edx, byte ptr [rsi + 0x15]');at(kill,0xd9ff8e,'r8d, byte ptr [rsi + 0x18]');
 at(kill,0xd9ff9d,'0x183a25b90');at(kill,0xda0001,'rax, qword ptr [rdx + 0x398]');
 const suicide=castMethod(c,'Entity','Suicide');
 at(suicide,0x3a25c2d,'byte ptr [rbx + 0xd1], 1');at(suicide,0x3a25c4d,'0x185a3da10');
 at(suicide,0x3a25c52,'ecx, 0x6c');at(suicide,0x3a25c5c,'r9b, 1');
 at(suicide,0x3a25c57,'byte ptr [rsp + 0x28], dil');at(suicide,0x3a25c5f,'byte ptr [rsp + 0x20], sil');
 at(suicide,0x3a25c6a,'0x180012f30');
 for(const ch of c.setHpDispatch.chunks)assert.equal(sha(Buffer.from(ch.base64,'base64')),ch.sha256);
 assert.equal(c.setHpDispatch.metadataIdentityVerified,false);
});

test('Unity settings intake binds one bounded file to the same frozen publisher manifest',()=>{
 const f=settingsFixture();assert.deepEqual(verifyWindowsSettingsManifest(f.pin,f.settings,f.raw),f.manifest);
 for(const invalid of ['path','size','crc','sha','version','source','unbounded']){
  const pin=structuredClone(f.settings);
  if(invalid==='path')pin.file.path='/Arknights.exe';
  else if(invalid==='size')pin.file.bytes++;
  else if(invalid==='crc')pin.file.crc64XZ='changed';
  else if(invalid==='sha')pin.file.sha256='invalid';
  else if(invalid==='version')pin.version='043.0.0';
  else if(invalid==='source')pin.source='/another-release';
  else pin.file.bytes=2000001;
  assert.throws(()=>verifyWindowsSettingsManifest(f.pin,pin,f.raw));
 }
});

test('retained original settings bind exact layer indices and query defaults without runtime parity',()=>{
 const c=read('data/candidates/arkpedia-windows-physics-settings-source.json');
 const pinRaw=readFileSync(new URL('../'+c.source.pin,import.meta.url)),pin=JSON.parse(pinRaw);
 assert.equal(sha(pinRaw),c.source.pinSha256);assert.deepEqual(pin.file,c.source.file);
 assert.equal(sha(readFileSync(new URL('../'+pin.nativeSource.path,import.meta.url))),pin.nativeSource.sha256);
 for(const obj of Object.values(c.objects))assert.equal(sha(obj.originalJson),obj.sha256);
 const tags=JSON.parse(c.objects.TagManager.originalJson),physics=JSON.parse(c.objects.Physics2DSettings.originalJson);
 assert.equal(c.unityVersion,'2021.3.39f1');assert.equal(tags.layers.length,32);
 assert.equal(c.objects.TagManager.pathId,'3');assert.equal(c.objects.Physics2DSettings.pathId,'15');
 assert.deepEqual([c.layerIndices.ALLY,c.layerIndices.ENEMY,c.layerIndices.NEUTRAL],[10,9,28]);
 for(const [name,index]of Object.entries(c.layerIndices))assert.equal(tags.layers[index],name);
 assert.equal(physics.m_QueriesHitTriggers,true);assert.equal(physics.m_QueriesStartInColliders,true);
 assert.equal(physics.m_AutoSyncTransforms,true);assert.equal(physics.m_LayerCollisionMatrix.length,32);
 for(const key of ['runtimeOverridesVerified','crossVersionParity','frameParity'])assert.equal(c[key],false);
});
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
 const c=read('data/candidates/arkpedia-windows-fear-area-source.json');assert.equal(c.methods.length,36);
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

test('arrival layer evidence binds named layers and enemy opposition includes neutrals',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-area-source.json'),layers=c.layers;
 assert.equal(layers.runtimeIndicesVerified,false);
 assert.deepEqual(layers.nameLiterals.slice(0,3).map(l=>l.value),['ALLY','ENEMY','NEUTRAL']);
 for(const literal of layers.nameLiterals)assert.equal(literal.encodedUsage>>>29,5);
 assert.deepEqual(layers.sideConstants.map(row=>[row.field.name,row.value]),[
  ['ALL_SIDE_MASK',7],['BOTH_ALLY_AND_ENEMY',3],['ALLY_TO_SAME',1],['ALLY_TO_OPPOSITE',2],
  ['ENEMY_TO_SAME',2],['ENEMY_TO_OPPOSITE',5],['NEUTRAL_TO_SAME',4],['NEUTRAL_TO_OPPOSITE',2]]);
 assert.deepEqual(layers.sameSides,[1,2,4]);assert.deepEqual(layers.oppositeSides,[2,5,2]);
 const ctor=instructions(castMethod(c,'SideTypes','.cctor'));
 for(const row of layers.sideConstants)assert.ok(ctor.some(i=>i.rva===row.instructionRva&&i.operands.endsWith(', '+row.value)));
 for(const m of [layers.indexEqualityLeaf,layers.nameToLayerMethod])for(const ch of m.chunks){
  const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);
 }
 assert.equal(layers.nameToLayerMethod.image,'UnityEngine.CoreModule.dll');assert.equal(layers.nameToLayerMethod.entryRva,0x5ebad60);
 assert.deepEqual(instructions(layers.indexEqualityLeaf).map(i=>[i.mnemonic,i.operands]),[
  ['and','ecx, 0x1f'],['mov','eax, 1'],['shl','eax, cl'],['cmp','eax, edx'],['sete','al'],['ret','']]);
 const opposite=instructions(castMethod(c,'BattleUtil','GetOppositeSideMask'));
 assert.ok(opposite.some(i=>i.rva===0x876687&&i.operands==='0x185a7d4d0'));
 const convert=instructions(castMethod(c,'BattleUtil','ConvertSideType'));
 assert.ok(convert.some(i=>i.rva===0x875451&&i.operands==='eax, ebx'));
 assert.ok(convert.some(i=>i.rva===0x87544c&&i.operands==='0x180876630'));
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
 at(query,0x731ca7,'ecx, 0x26');at(query,0x731caf,'0x1800057b0');
 assert.deepEqual(c.candidateAliveSlots.map(s=>[s.type,s.slot,s.name]),[
  ['Entity',38,'get_alive'],['Enemy',38,'get_alive'],['Character',38,'get_alive']]);
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
 const c=read(castPath);assert.equal(c.methods.length,47);
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
test('cast frame conversion binds rounded division, FP ties-to-even and reserved saturation values',()=>{
 const c=read(castPath),a=c.waitFrameArithmetic;
 assert.equal(a.fractionalBits,32);assert.equal(a.fractionalHalfRaw,'2147483648');
 assert.equal(a.divisionOverflowPositiveRaw,'9223372036854775806');assert.equal(a.divisionOverflowNegativeRaw,'-9223372036854775806');
 assert.equal(a.divisionByZeroRaw,'-4294967296');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const init=castMethod(c,'FP','.cctor');
 at(init,0x5a3d005,'rax, 0x7ffffffffffffffe');at(init,0x5a3d00f,'qword ptr [rcx + 0x10], rax');
 at(init,0x5a3d021,'rax, 0x8000000000000002');at(init,0x5a3d02b,'qword ptr [rcx + 0x18], rax');
 const divide=castMethod(c,'FP','op_Division');
 at(divide,0x5a3d783,'r14');at(divide,0x5a3d7b0,'rax, [r15 + 1]');at(divide,0x5a3d7b4,'rax, 1');
 at(divide,0x5a3d845,'rax, 0xffffffff00000000');
 const round=castMethod(c,'FP','Round');
 at(round,0x5a3c89c,'rdi, rcx');at(round,0x5a3c8a3,'rbx, 0x20');at(round,0x5a3c8a8,'0x185a3c8db');
 at(castMethod(c,'MathUtil','RoundToInt'),0x5a42ac8,'rbx, 0x20');
 const waiter=castMethod(c,'<WaitWhileForFixedSeconds>d__6','MoveNext');
 for(const [rva,args]of [[0x396bd38,'0x183991370'],[0x396bd5a,'0x185a3da20'],
  [0x396bd68,'0x185a3d680'],[0x396bd8f,'0x185a42a50'],[0x396bd96,'eax, esi']])at(waiter,rva,args);
 at(castMethod(c,'BattleController','get_deltaPlayTime'),0x3991401,'0x185a3ad10');
});

test('single-spell native continuation gates spell end after launch and casting validation',()=>{
 const c=read(castPath),sequence=instructions(castMethod(c,'<_DoCast>d__85','MoveNext'));
 const at=(rva,args)=>assert.ok(sequence.some(i=>i.rva===rva&&i.operands===args));
 at(0x391ff1a,'rax');at(0x391ff1e,'0x183920050');at(0x391ff29,'0x183911110');
 at(0x391ff30,'0x183920050');at(0x391ff4b,'0x18390dde0');
 at(0x391ff78,'rax');at(0x391ff85,'ecx, 0x49');at(0x391ff8d,'r8d, [rcx - 0x44]');
 at(0x391ff91,'0x18001cf10');at(0x3920001,'0x1800057b0');
 assert.equal(c.resolvedSlots.find(s=>s.type==='RangedAttack'&&s.slot===73).name,'OnEvent');
 assert.equal(c.resolvedSlots.find(s=>s.type==='RangedAttack'&&s.slot===78).name,'OnWaitForPostDelay');
 assert.equal(c.resolvedSlots.find(s=>s.type==='RangedAttack'&&s.slot===89).name,'CheckAnotherSpell');
 const another=instructions(castMethod(c,'AbilityStandard','CheckAnotherSpell'));
 assert.ok(another.some(i=>i.rva===0x3908725&&i.operands==='al, al'));
});

test('cast start captures virtual GetDuration before the iterator initializes its frame count',()=>{
 const c=read(castPath),slot=c.resolvedSlots.find(s=>s.type==='RangedAttack'&&s.slot===101);
 assert.equal(slot.name,'GetDuration');assert.equal(slot.declaringType,'AbstractAnimatedAbility');
 assert.equal(slot.entryRva,castMethod(c,'AbstractAnimatedAbility','GetDuration').entryRva);
 assert.equal(c.fields.EasyToStartAbility.fields.find(f=>f.name==='m_cachedDuration').offset,0x118);
 const start=instructions(castMethod(c,'EasyToStartAbility','OnCastStart'));
 assert.ok(start.some(i=>i.rva===0xc27a9d&&i.operands==='rax, qword ptr [rdx + 0x788]'));
 assert.ok(start.some(i=>i.rva===0xc27aad&&i.operands==='qword ptr [rbx + 0x118], rax'));
 const waiter=instructions(castMethod(c,'<WaitWhileForFixedSeconds>d__6','MoveNext'));
 assert.ok(waiter.some(i=>i.rva===0x396bd07&&i.operands==='0x18396bdaa'));
 assert.ok(waiter.some(i=>i.rva===0x396bd38&&i.operands==='0x183991370'));
 // Resumption enters the predicate branch, after one-time timing conversion.
 assert.ok(waiter.some(i=>i.rva===0x396bdae&&i.operands==='rcx, qword ptr [rdi + 0x28]'));
});

test('cast event wait binds its selected predicate, mandatory initial yield and handler cleanup',()=>{
 const c=read('data/candidates/arkpedia-windows-cast-lifecycle-source.json');
 assert.deepEqual(c.eventWaitDelegateBindings.map(r=>[r.callerLoadRva,r.name]),[
  [0xc30803,'_CheckNotReceiveEvent'],[0xc30866,'_CheckNotReceiveEventAndTargetAlive'],
  [0xc307af,'_OnReceiveEvent'],[0xc306c7,'_OnReceiveEvent']]);
 for(const binding of c.eventWaitDelegateBindings){
  assert.equal(binding.encodedUsage>>>29,3);assert.equal((binding.encodedUsage&0x1ffffffe)>>>1,binding.index);
 }
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 const next=castMethod(c,'<WaitForNextEvent>d__15','MoveNext');
 at(next,0xc307e2,'byte ptr [rdi + 0x111], 0');at(next,0xc307f0,'0x180c30859');
 at(next,0xc306f4,'0x184305c20');at(next,0xc30702,'byte ptr [rdi + 0x120], 0');
 const waiter=castMethod(c,'<WaitWhileForFixedSeconds>d__6','MoveNext');
 at(waiter,0x396bd99,'rbx, qword ptr [rsp + 0x40]');at(waiter,0x396bda1,'dword ptr [rdi + 0x34], 0');
 at(waiter,0x396bda8,'0x18396bdd3');at(waiter,0x396bdca,'rax');
 at(waiter,0x396bdce,'0x18396be22');at(waiter,0x396bdd0,'dword ptr [rdi + 0x34]');
 const graph=read('data/candidates/arkpedia-ch16-fear-projectile-source.json');
 const rows=graph.prefabs['dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'];
 const native=JSON.parse(rows.find(r=>r.pathId==='4729572091462136098').originalJson);
 assert.equal(native._waitForAttackEvent,1);assert.equal(native._interuptIfTargetDead,0);assert.equal(native._interruptAbilityOnDetach,1);
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
