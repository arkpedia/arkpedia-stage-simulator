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
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json');assert.equal(c.methods.length,222);
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

test('EnsureOverrideGroup source binds populated-queue bypass, STACK blackboard keys and late map/key registration',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.ensureOverrideGroup,m=castMethod(c,'BuffContainer','EnsureOverrideGroup');
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(q.groupFields.map(f=>[f.name,f.offset]),[['m_queue',0x10],['m_type',0x18],['m_maxStackCnt',0x1c],['m_maxValidStackCnt',0x20]]);
 assert.deepEqual(q.dataFields.map(f=>[f.name,f.offset]),[['overrideType',0x40],['maxStackCnt',0x44],['maxValidStackCnt',0x4c]]);
 assert.deepEqual(q.overrideEnum.fields.map(f=>[f.name,f.value]),[['DEFAULT',0],['STACK',1],['UNIQUE',2],['EXTEND',3],['EXTEND_TIME',4]]);
 assert.deepEqual(q.literals.map(x=>x.value),['max_stack_cnt','max_valid_stack_cnt','max_stack_cnt','max_valid_stack_cnt']);
 for(const spec of q.queueSpecifications){assert.equal(spec.encodedUsage>>>29,6);assert.equal(spec.specification.declaringType,'PriorityQueue`1');
  assert.equal(spec.specification.nativeMapping,null);assert.equal(spec.specification.instantiations.class.arguments[0].name,'Buff');}
 assert.equal(q.groupTypeLoad.name,'OverrideGroup');assert.equal(q.groupTypeLoad.encodedUsage>>>29,1);
 at(q.mapCaptureRva,'rbx, qword ptr [rbp + 0x20]');at(q.keyGetterCallRva,'0x1839b6f70');at(q.lookupCallRva,'0x184c0e320');
 at(q.initialQueueReadRva,'rcx, qword ptr [rsi + 0x10]');at(q.queueCountCallRva,'0x1841fcd50');at(q.queueRereadRva,'rcx, qword ptr [rbx + 0x10]');
 at(q.existingQueueCtorCallRva,'0x1847b55d0');at(q.existingQueueWriteRva,'qword ptr [rbx + 0x10], rsi');at(q.clearQueueCallRva,'0x1847b4860');
 at(q.existingTypeWriteRva,'dword ptr [rbx + 0x18], eax');at(q.existingMaxStackCallRva,'0x182166990');at(q.existingMaxValidCallRva,'0x182166990');
 at(q.groupCtorCallRva,'0x180511a50');at(q.newQueueCtorCallRva,'0x1847b55d0');at(q.newQueueWriteRva,'qword ptr [rcx], rsi');
 at(q.newTypeWriteRva,'dword ptr [rbx + 0x18], eax');at(q.newMaxStackCallRva,'0x182166990');at(q.newMaxValidCallRva,'0x182166990');
 at(q.newMaxStackWriteRva,'dword ptr [rbx + 0x1c], eax');at(q.newMaxValidWriteRva,'dword ptr [rbx + 0x20], eax');
 at(q.mapRereadRva,'rbx, qword ptr [rbp + 0x20]');at(q.newKeyGetterCallRva,'0x1839b6f70');at(q.addGroupCallRva,'0x184c0b0d0');
 assert.ok(castMethod(c,'Buff','get_blackboard'));assert.equal(q.nativeQueueConstructionVerified,false);assert.equal(q.nativeGroupConstructionVerified,false);assert.equal(q.liveEnsureGroupPhaseVerified,false);
});

test('override group source distinguishes all merge modes and live first-unfinished activation',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.overrideGroupDispatch;
 const add=castMethod(c,'OverrideGroup','_DoAddInternal'),update=castMethod(c,'OverrideGroup','_DoUpdateInternal');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.equal(q.snapshotField.name,'takeSnapshotWhenExtend');assert.equal(q.snapshotField.offset,0x71);
 assert.deepEqual(q.queueSpecifications.map(s=>s.specification.index),[253541,253539,253536,253540]);
 for(const s of q.queueSpecifications){assert.equal(s.encodedUsage>>>29,6);assert.equal(s.specification.nativeMapping,null);
  assert.equal(s.specification.declaringType,'PriorityQueue`1');assert.equal(s.specification.instantiations.class.arguments[0].name,'Buff');}
 for(const s of q.buffCallees)assert.equal(castMethod(c,'Buff',s.name).entryRva,s.entryRva);
 at(add,q.typeReadRva,'ecx, dword ptr [rbx + 0x18]');at(add,q.defaultAddCallRva,'0x1847b40e0');at(add,q.uniqueEmptyCallRva,'0x18450c4c0');
 at(add,q.extendTimeEmptyCallRva,'0x18450c4c0');at(add,q.extendTimeQueueRereadRva,'rcx, qword ptr [rbx + 0x10]');at(add,q.extendTimeCallRva,'0x1839b3540');
 at(add,q.extendEmptyCallRva,'0x18450c4c0');at(add,q.extendQueueRereadRva,'rcx, qword ptr [rbx + 0x10]');at(add,q.fillCallRva,'0x1839b3810');
 at(add,q.snapshotFlagReadRva,'byte ptr [rax + 0x71], 0');at(add,q.snapshotCallRva,'0x1839b1cb0');at(add,q.blackboardNullTestRva,'qword ptr [rax + 0xa8], 0');at(add,q.assignCallRva,'0x1821653b0');
 at(add,q.stackEmptyCallRva,'0x18450c4c0');at(add,q.stackMaxTestRva,'dword ptr [rbx + 0x1c], 0');at(add,q.stackReadRva,'eax, dword ptr [rax + 0x8c]');
 at(add,q.stackIncrementRva,'eax');at(add,q.stackCompareRva,'eax, dword ptr [rbx + 0x1c]');at(add,q.stackAtMaxCompareRva,'dword ptr [rax + 0x8c], ecx');
 at(add,q.refreshFlagReadRva,'byte ptr [rax + 0x94], 0');
 for(const rva of [q.refreshCapWriteRva,q.incrementCapWriteRva,q.firstCapWriteRva])at(add,rva,'dword ptr [rax + 0x90], ecx');
 at(add,q.refreshCallRva,'0x1839b3730');at(add,q.addStackCallRva,'0x1839b2a80');at(add,q.stackAddCallRva,'0x1847b40e0');
 at(update,q.updateInitialQueueReadRva,'rcx, qword ptr [rdi + 0x10]');at(update,q.updateInitialCountCallRva,'0x1841fcd50');
 at(update,q.updateLoopQueueReadRva,'rax, qword ptr [rdi + 0x10]');at(update,q.updateLiveCountCallRva,'0x1841fcd50');
 at(update,q.updateItemQueueReadRva,'rcx, qword ptr [rdi + 0x10]');at(update,q.updateItemCallRva,'0x1844db610');
 at(update,q.updateFinishedCallRva,'0x1839b6b00');at(update,q.updateSelectedWriteRva,'bpl, 1');at(update,q.updateEnabledCallRva,'0x1839b7e80');
 at(update,q.updateQueueAfterSetterRva,'rax, qword ptr [rdi + 0x10]');
 assert.equal(q.nativeQueueOrderingVerified,false);assert.equal(q.nativeBuffMergeEffectsVerified,false);assert.equal(q.liveGroupDispatchVerified,false);
});

test('native merge timing source binds distinct lifetime and remaining getters, signed arithmetic and notification ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),b=c.modeSwitch.buffNotification,q=b.newBuff.mergeTiming;
 const extend=castMethod(c,'Buff','_ExtendRemainingTime'),fill=castMethod(c,'Buff','_FillRemainingTime'),
  refresh=castMethod(c,'Buff','_FillRemainingTimeWhenStackMax'),stack=castMethod(c,'Buff','_AddStack');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['m_lifeTime',0x70],['m_remainingTime',0x78],['m_existingTime',0x80],['m_stackCnt',0x8c]]);
 assert.equal(q.ownerNotification.type,'Entity');assert.equal(q.ownerNotification.name,'OnBuffExtend');assert.equal(q.ownerNotification.entryRva,0x3a1fd50);
 for(const rva of q.extendLifeGetterCalls)at(extend,rva,'0x1839b6d40');at(extend,q.extendFiniteCompareRva,'0x1851df0b0');
 at(extend,q.extendRemainingReadRva,'rdi, qword ptr [rsi + 0x78]');at(extend,q.extendRemainingWriteRva,'qword ptr [rsi + 0x78], rax');
 at(extend,q.extendLifeReadRva,'rbx, qword ptr [rsi + 0x70]');at(extend,q.extendLifeWriteRva,'qword ptr [rsi + 0x70], rax');
 at(extend,q.extendExistingReadRva,'rbx, qword ptr [rsi + 0x80]');at(extend,q.extendExistingGetterCallRva,'0x1839b6870');at(extend,q.extendExistingWriteRva,'qword ptr [rsi + 0x80], rax');
 for(const rva of q.extendAddCalls)at(extend,rva,'0x184175da0');for(const rva of q.extendOwnerCalls)at(extend,rva,'0x1839b6ff0');
 at(extend,q.extendOwnerValidityCallRva,'0x185ebee90');at(extend,q.extendNotifyTailRva,'0x183a1fd50');
 for(const rva of q.fillLifeGetterCalls)at(fill,rva,'0x1839b6d40');at(fill,q.fillFiniteCompareRva,'0x1851df0b0');
 at(fill,q.fillRemainingReadRva,'rdi, qword ptr [rbp + 0x78]');at(fill,q.fillMaxCallRva,'0x185a5c940');at(fill,q.fillRemainingWriteRva,'qword ptr [rbp + 0x78], rax');
 at(fill,q.fillExistingReadRva,'rbx, qword ptr [rbp + 0x80]');at(fill,q.fillExistingGetterCallRva,'0x1839b6870');
 at(fill,q.fillExistingAddCallRva,'0x184175da0');at(fill,q.fillExistingWriteRva,'qword ptr [rbp + 0x80], rax');
 for(const rva of q.fillOwnerCalls)at(fill,rva,'0x1839b6ff0');at(fill,q.fillOwnerValidityCallRva,'0x185ebee90');at(fill,q.fillNotifyTailRva,'0x183a1fd50');
 at(refresh,q.refreshRemainingReadRva,'rbx, qword ptr [rsi + 0x78]');at(refresh,q.refreshRemainingGetterCallRva,'0x1839b71f0');
 at(refresh,q.refreshMaxCallRva,'0x185a5c940');at(refresh,q.refreshRemainingWriteRva,'qword ptr [rsi + 0x78], rax');
 at(stack,q.addStackIncrementRva,'dword ptr [rsi + 0x8c]');at(stack,q.addStackRemainingReadRva,'rbx, qword ptr [rsi + 0x78]');
 at(stack,q.addStackRemainingGetterCallRva,'0x1839b71f0');at(stack,q.addStackMaxCallRva,'0x185a5c940');
 at(stack,q.addStackRemainingWriteRva,'qword ptr [rsi + 0x78], rax');at(stack,q.addStackUpdateTailRva,'0x1839b3450');
 at(castMethod(c,'Buff','get_lifeTime'),0x39b6d97,'rax, qword ptr [rbx + 0x70]');
 at(castMethod(c,'Buff','get_remainingTime'),0x39b7247,'rax, qword ptr [rbx + 0x78]');
 at(castMethod(c,'Buff','get_existingTime'),0x39b68c7,'rax, qword ptr [rbx + 0x80]');
 const max=b.resetTiming.math.find(m=>m.entryRva===0x5a5c940),add=b.attributeLoading.math.find(m=>m.entryRva===0x4175da0),ge=b.attributeLoading.math.find(m=>m.entryRva===0x51df0b0);
 assert.ok(max);assert.ok(add);assert.ok(ge);at(max,0x5a5c98a,'0x1851df0c0');
 assert.equal(q.nativeOwnerNotificationEffectsVerified,false);assert.equal(q.nativeGetterHotfixDispatchVerified,false);assert.equal(q.liveMergeTimingVerified,false);
});

test('enabled source preserves finished/manual/actual/late fields, suppression ordering and native modifier/action targets',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.enabledUpdate,
  setter=castMethod(c,'Buff','set_isEnabled'),update=castMethod(c,'Buff','_UpdateIsEnabledIfNotFinished');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['m_isSilenceable',0x1e2],['m_isStunnable',0x1e3],['m_isFreezable',0x1e4],['m_isLevitatable',0x1e7],
  ['m_isFinished',0x1e9],['m_isActuallyEnabled',0x1ec],['m_isLateEnabled',0x1ed],['m_isManuallyEnabled',0x1ee]]);
 for(const callee of q.callees)assert.equal(castMethod(c,callee.type,callee.name).entryRva,callee.entryRva);
 assert.deepEqual(q.selectedEvents.fields.map(f=>[f.name,f.value]),[['ON_BUFF_ENABLE',24],['ON_BUFF_DISABLE',25]]);
 assert.deepEqual(q.runActions.parameters.map(p=>p.name),['ev','setMeAsTarget']);assert.equal(q.runActions.entryRva,0x39b5370);
 at(setter,q.setterFinishedTestRva,'byte ptr [rbx + 0x1e9], dil');at(setter,q.setterManualWriteRva,'byte ptr [rbx + 0x1ee], dil');at(setter,q.setterUpdateTailRva,'0x1839b5a70');
 at(update,q.manualCaptureRva,'esi, byte ptr [rbx + 0x1ee]');at(update,q.ownerCaptureCallRva,'0x1839b6ff0');
 for(const [index,offset]of [0x1e2,0x1e3,0x1e4,0x1e7].entries())at(update,q.capabilityTests[index],`byte ptr [rbx + 0x${offset.toString(16)}], 0`);
 for(const rva of q.ownerValidityCalls)at(update,rva,'0x185ebee90');
 for(const [index,entry]of ['0x183a2d560','0x183a2d830','0x183a2cb10','0x183a2cf50'].entries())at(update,q.ownerStatusCalls[index],entry);
 at(update,q.actualCompareRva,'byte ptr [rbx + 0x1ec], sil');at(update,q.disableActualWriteRva,'byte ptr [rbx + 0x1ec], sil');
 at(update,q.enableActualLateWriteRva,'word ptr [rbx + 0x1ec], 0x101');
 at(update,q.disableOwnerCallRva,'0x1839b6ff0');at(update,q.disableAttributesCallRva,'0x183a29330');at(update,q.removeModifierCallRva,'0x1839585b0');
 at(update,q.disableSetMeAsTargetRva,'r9b, 1');at(update,q.disableEventInputRva,'r8d, 0x19');at(update,q.runActionsCallRva,'0x1839b5370');
 at(update,q.enableOwnerCallRva,'0x1839b6ff0');at(update,q.enableAttributesCallRva,'0x183a29330');at(update,q.addModifierCallRva,'0x183957030');
 at(update,q.enableSetMeAsTargetRva,'r9b, 1');at(update,q.enableEventInputRva,'r8d, 0x18');
 assert.equal(q.nativeModifierStorageVerified,false);assert.equal(q.nativeEnabledActionsVerified,false);assert.equal(q.liveEnabledUpdateVerified,false);
});

test('modifier mutation source binds interface slots, concrete membership specifications, Int16 counters and dirty ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.modifierMutation,
  add=castMethod(c,'Attributes','AddModifier'),remove=castMethod(c,'Attributes','RemoveModifier');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['m_abnormalFlagModifiers',0x10],['m_attributeModifiers',0x18],['m_abnormalFlagsCounter',0x20],
  ['m_abnormalImmuneCounter',0x28],['m_abnormalAntiCounter',0x30],['m_abnormalComboMgr',0x38]]);
 assert.equal(q.interface.name,'IAttributesModifier');assert.deepEqual(q.interface.slots.map(s=>[s.name,s.virtualSlot]),[
  ['get_attributeMask',0],['get_abnormalFlagMask',1],['get_abnormalImmuneMask',2],['get_abnormalAntiMask',3],['get_abnormalComboMask',4],['get_abnormalComboImmuneMask',5]]);
 assert.equal(q.interface.typeLoads.length,12);for(const load of q.interface.typeLoads){assert.equal(load.encodedUsage>>>29,1);assert.equal(load.definitionIndex,q.interface.index);}
 assert.deepEqual(q.setSpecifications.map(s=>s.specification.index),[237211,237214]);for(const s of q.setSpecifications){assert.equal(s.encodedUsage>>>29,6);
  assert.equal(s.specification.declaringType,'HashSet`1');assert.equal(s.specification.nativeMapping,null);assert.equal(s.specification.instantiations.class.arguments[0].name,'IAttributesModifier');}
 assert.deepEqual(q.targets.map(t=>[t.name,t.entryRva]),[['PushMask',0x3996140],['PopMask',0x3995fe0],['MarkAttributeDirty',0x3957e90],['_CalculateAbnormalDirtyByModifier',0x3958e30]]);
 at(add,q.addSetCallRva,'0x18434f3f0');at(add,q.addNullModifierTestRva,'r15, r15');
 for(const rva of q.addMaskCalls)at(add,rva,'0x180005250');for(const rva of q.addCounterWrites)at(add,rva,'word ptr [rax + rcx*2 + 0x20]');
 for(const rva of q.addCounterWrites)assert.equal(instructions(add).find(i=>i.rva===rva).mnemonic,'inc');
 at(add,q.addFlagLimitRva,'edx, 0x2c');at(add,q.addComboCaptureRva,'rbx, qword ptr [rsi + 0x38]');at(add,q.pushComboCallRva,'0x183996140');
 at(add,q.addAttributeSetCallRva,'0x18434f3f0');at(add,q.addAttributeLimitRva,'ebx, 0x26');at(add,q.addDirtyCallRva,'0x183957e90');
 at(add,q.addDirtyLimitRva,'ebp, 0x26');at(add,q.addAbnormalDirtyTailRva,'0x183958e30');
 at(remove,q.removeSetCallRva,'0x18436f4c0');at(remove,q.removeNullModifierTestRva,'r15, r15');
 for(const rva of q.removeMaskCalls)at(remove,rva,'0x180005250');for(const rva of q.removeCounterWrites)at(remove,rva,'word ptr [rax + rcx*2 + 0x20]');
 for(const rva of q.removeCounterWrites)assert.equal(instructions(remove).find(i=>i.rva===rva).mnemonic,'dec');
 at(remove,q.removeFlagLimitRva,'edx, 0x2c');at(remove,q.removeComboCaptureRva,'rbx, qword ptr [rsi + 0x38]');at(remove,q.popComboCallRva,'0x183995fe0');
 at(remove,q.removeAttributeSetCallRva,'0x18436f4c0');at(remove,q.removeAttributeLimitRva,'ebx, 0x26');at(remove,q.removeDirtyCallRva,'0x183957e90');
 at(remove,q.removeDirtyLimitRva,'ebp, 0x26');at(remove,q.removeAbnormalDirtyTailRva,'0x183958e30');
 assert.equal(q.nativeSetEqualityVerified,false);assert.equal(q.nativeComboMutationVerified,false);assert.equal(q.nativeDirtyPropagationVerified,false);assert.equal(q.liveModifierMutationVerified,false);
});

test('combo mutation source binds two signed counter entries, state-change-only projection and exact static mappings',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.comboMutation,
  push=castMethod(c,'AbnormalComboManager','PushMask'),pop=castMethod(c,'AbnormalComboManager','PopMask'),
  update=castMethod(c,'AbnormalComboManager','_UpdateAbnormalCombo'),ctor=castMethod(c,'AbnormalComboManager','.cctor');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.deepEqual(q.counterFields.map(f=>[f.name,f.offset,f.elementKind]),[['m_abnormalComboCounter',0x10,6],['m_abnormalComboImmuneCounter',0x18,6]]);
 assert.deepEqual(q.maskFields.map(f=>[f.name,f.offset,(f.typeBits>>>16)&255]),[['m_abnormalComboMask',0x20,10],['m_abnormalFlagMask',0x28,10]]);
 assert.equal(q.mappingField.name,'ABNORMAL_COMBO_TO_FLAG_MASK');assert.equal(q.mappingField.offset,0);assert.equal(q.mappingField.elementKind,10);
 assert.deepEqual(q.mappingValues,[0x80028,0x40028]);at(ctor,q.mappingLengthInputRva,'edx, 2');
 at(ctor,q.mappingWriteRvas[0],'qword ptr [rax + 0x20], 0x80028');at(ctor,q.mappingWriteRvas[1],'qword ptr [rax + 0x28], 0x40028');
 for(const rva of q.pushCounterWrites){at(push,rva,'word ptr [rax + rcx*2 + 0x20]');assert.equal(instructions(push).find(i=>i.rva===rva).mnemonic,'inc');}
 at(push,q.pushUpdateCallRva,'0x1839963b0');at(push,q.pushLimitRva,'ebx, 2');at(push,q.pushChangedTestRva,'bpl, bpl');
 at(push,q.pushComboCaptureRva,'rbp, qword ptr [rdi + 0x20]');at(push,q.pushMappingReadRva,'rcx, qword ptr [rax]');
 at(push,q.pushMappingOrRva,'rsi, qword ptr [rcx + rax*8 + 0x20]');at(push,q.pushFlagMaskWriteRva,'qword ptr [rdi + 0x28], rsi');
 for(const rva of q.popCounterWrites){at(pop,rva,'word ptr [rax + rcx*2 + 0x20]');assert.equal(instructions(pop).find(i=>i.rva===rva).mnemonic,'dec');}
 at(pop,q.popUpdateCallRva,'0x1839963b0');at(pop,q.popLimitRva,'ebx, 2');at(pop,q.popChangedTestRva,'bpl, bpl');
 at(pop,q.popComboCaptureRva,'rbp, qword ptr [rdi + 0x20]');at(pop,q.popMappingReadRva,'rcx, qword ptr [rax]');
 at(pop,q.popMappingOrRva,'rsi, qword ptr [rcx + rax*8 + 0x20]');at(pop,q.popFlagMaskWriteRva,'qword ptr [rdi + 0x28], rsi');
 at(update,q.updateMaskCaptureRva,'r9, qword ptr [rcx + 0x20]');at(update,q.updateActiveCounterCompareRva,'word ptr [r11 + rcx], 0');
 at(update,q.updateImmuneCounterCompareRva,'word ptr [r11 + rax], cx');at(update,q.updatePreviousTestRva,'r8, r9');at(update,q.updatePreviousSignedPositiveRva,'cl');
 at(update,q.updateClearSubtractRva,'r9, rax');at(update,q.updateClearWriteRva,'qword ptr [r10 + 0x20], r9');
 at(update,q.updateSetOrRva,'r9, r8');at(update,q.updateSetWriteRva,'qword ptr [r10 + 0x20], r9');
 assert.equal(q.nativeStaticMappingLifecycleVerified,false);assert.equal(q.liveComboMutationVerified,false);
});

test('abnormal dirty source binds separate flag/combo and immunity passes with live delegates',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.abnormalDirty,m=castMethod(c,'Attributes','_CalculateAbnormalDirtyByModifier');
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(q.delegateFields.map(f=>[f.name,f.offset]),[['onAbnormalFlagDirty',0x70],['onAbnormalComboDirty',0x78]]);
 for(const [index,slot]of [1,4,2,5].entries())at(q.slotInputs[index],`ecx, ${slot}`);
 for(const rva of q.maskCalls)at(rva,'0x180005250');for(const rva of q.conversionCalls)at(rva,'0x1828a66d0');
 for(const [index,args]of ['ebx, 0x2c','ebx, 2','ebx, 0x2c','edi, 2'].entries())at(q.limits[index],args);
 for(const [index,offset]of [0x70,0x78,0x70,0x78].entries())at(q.delegateReads[index],`r9, qword ptr [rbp + 0x${offset.toString(16)}]`);
 for(const rva of q.delegateCalls)at(rva,'qword ptr [r9 + 0x18]');
 assert.equal(q.nativeDelegateInvocationVerified,false);assert.equal(q.liveAbnormalDirtyVerified,false);
});

test('attribute dirty source binds signed dirty bits and forty-byte ObscuredFP copies before captured callbacks',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.attributeDirty,m=castMethod(c,'Attributes','MarkAttributeDirty');
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['m_cachedData',0x50],['m_dirtyMask',0x60],['onAttributeMarkedDirty',0x68]]);
 assert.equal((q.fields[1].typeBits>>>16)&255,10);assert.equal(q.cachedElement.name,'ObscuredFP');assert.equal(q.cachedElement.namespace,'Torappu');
 assert.equal(q.conversion.image,'Torappu.Common.dll');assert.equal(q.conversion.entryRva,0x5a45a80);
 assert.ok(c.methods.some(method=>method.image===q.conversion.image&&method.index===q.conversion.index&&method.entryRva===q.conversion.entryRva));
 at(q.maskCaptureRva,'rbx, qword ptr [rdi + 0x60]');at(q.firstIdentityCallRva,'0x1828a66d0');at(q.delegateCaptureRva,'rbp, qword ptr [rdi + 0x68]');
 at(q.shiftMaskRva,'eax, 0x3f');at(q.setBitRva,'rbx, rax');at(q.maskWriteRva,'qword ptr [rdi + 0x60], rbx');at(q.delegateNullTestRva,'rbp, rbp');
 at(q.cacheCaptureRva,'rbx, qword ptr [rdi + 0x50]');at(q.secondIdentityCallRva,'0x1828a66d0');at(q.cacheBoundsRva,'eax, dword ptr [rbx + 0x18]');
 at(q.cacheStrideRva,'rax, [rax + rax*4]');at(q.copyReads[0],'xmm0, xmmword ptr [rbx + rax*8 + 0x20]');
 at(q.copyReads[1],'xmm1, xmmword ptr [rbx + rax*8 + 0x30]');at(q.copyReads[2],'xmm0, qword ptr [rbx + rax*8 + 0x40]');
 at(q.conversionCallRva,'0x185a45a80');at(q.delegateCallRva,'qword ptr [rbp + 0x18]');
 assert.equal(q.nativeCachedValueConversionVerified,false);assert.equal(q.nativeDirtyDelegateInvocationVerified,false);assert.equal(q.liveAttributeDirtyVerified,false);
});

test('stat snapshot source binds native field layout, source locking and nine FP/int attribute copies',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.statSnapshot,
  m=castMethod(c,'RuntimeAttributesSnapshot','TakeSnapshot'),wrapper=castMethod(c,'Buff','TakeSnapshotToBuffAttribute');
 const at=(method,rva,args)=>assert.ok(instructions(method).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.equal(q.boxedHeaderBytes,16);assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['maxHp',16],['atk',56],['def',96],['magicResistance',136],
  ['cost',176],['blockCnt',196],['attackSpeed',216],['baseAttackTime',256],['respawnTime',296]]);
 assert.deepEqual(q.attributeIndices,[0,1,2,3,4,5,7,8,21]);assert.deepEqual(q.valueByteLengths,[40,40,40,40,20,20,40,40,20]);
 assert.deepEqual(q.buffFields.map(f=>[f.name,f.offset]),[['m_source',0x18],['m_runtimeAttributesSnapshot',0xb0]]);
 assert.equal(q.sourceLock.encodedUsage>>>29,6);assert.equal(q.sourceLock.specification.declaringType,'ObjectPtr`1');
 assert.equal(q.sourceLock.specification.definition.name,'Lock');assert.equal(q.sourceLock.specification.instantiations.class.arguments[0].name,'Entity');
 for(const conversion of q.conversions)assert.ok(c.methods.some(method=>method.image===conversion.image&&method.index===conversion.index&&method.entryRva===conversion.entryRva));
 at(wrapper,q.sourceLockCallRva,'0x18477cad0');at(wrapper,q.sourceValidityCallRva,'0x185ebee90');at(wrapper,q.sourceAttributesCallRva,'0x183a29330');at(wrapper,q.snapshotCallRva,'0x1806d3aa0');
 for(let index=0;index<9;index++){
  const integer=[4,5,8].includes(index);at(m,q.attributeReadCalls[index],integer?'0x183957d40':'0x183957db0');
  at(m,q.conversionCalls[index],integer?'0x18595c350':'0x185a45a50');
 }
 for(const [index,operands]of ['xmmword ptr [rdi], xmm1','xmmword ptr [rdi + 0x28], xmm1','xmmword ptr [rdi + 0x50], xmm1',
  'xmmword ptr [rdi + 0x78], xmm1','xmmword ptr [rdi + 0xa0], xmm0','xmmword ptr [rdi + 0xb4], xmm0',
  'xmmword ptr [rdi + 0xc8], xmm1','xmmword ptr [rdi + 0xf0], xmm1','xmmword ptr [rdi + 0x118], xmm0'].entries())at(m,q.firstCopyWrites[index],operands);
 assert.equal(q.nativeObscuredValueConversionVerified,false);assert.equal(q.nativeSnapshotPointerDispatchVerified,false);assert.equal(q.liveStatSnapshotVerified,false);
});

test('attribute evaluation source binds reusable provider outputs, exact formula and cache/range ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.attributeValues,
  calc=castMethod(c,'Attributes','_CalculateAttributeValue'),get=castMethod(c,'Attributes','GetValue'),round=castMethod(c,'Attributes','GetValueRoundToInt');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['m_attributeModifiers',0x18],['m_rawData',0x40],['m_dataRange',0x48],['m_cachedData',0x50],['m_overrideDataRange',0x58],['m_dirtyMask',0x60]]);
 assert.deepEqual(q.enumerationSpecifications.map(s=>s.specification.index),[237213,233318,233317]);for(const s of q.enumerationSpecifications){assert.equal(s.encodedUsage>>>29,6);assert.equal(s.specification.nativeMapping,null);assert.equal(s.specification.instantiations.class.arguments[0].name,'IAttributesModifier');}
 assert.equal(q.provider.encodedUsage>>>29,1);assert.equal(q.provider.typeName,'IAttributesDataProvider`1');assert.equal(q.provider.argument.name,'AttributeType');
 assert.equal(q.provider.method.name,'GetValue');assert.equal(q.provider.method.virtualSlot,0);
 assert.deepEqual(q.provider.method.parameters.map(p=>p.name),['attributeType','addition','multiplier','finalAddition','finalScaler']);
 assert.deepEqual(q.initialConstants.map(x=>[x.hex,x.value]),[['0000803f',1],['0000803f',1]]);
 at(get,q.getDirtyCaptureRva,'rbx, qword ptr [rsi + 0x60]');at(get,q.getDirtySignedTestRva,'rbx, rdx');at(get,q.getDirtySignedBranchRva,'0x183957e63');assert.equal(instructions(get).find(i=>i.rva===q.getDirtySignedBranchRva).mnemonic,'jg');
 at(get,q.getCacheConversionCallRva,'0x185a45a80');at(get,q.getCalculateTailRva,'0x183959030');at(round,q.roundGetValueCallRva,'0x183957db0');at(round,q.roundTailRva,'0x185a42a50');
 at(calc,q.enumeratorCallRva,'0x184353640');at(calc,q.moveNextCallRva,'0x184dde4d0');at(calc,q.providerCallRva,'r10');
 for(const rva of q.sumCalls)at(calc,rva,'0x184175da0');at(calc,q.scalerProductCallRva,'0x185a3b800');
 at(calc,q.normalDisposeCallRva,'0x180511a50');at(calc,q.exceptionDisposeCallRva,'0x180511a50');at(calc,q.dirtyClearRva,'qword ptr [r13 + 0x60], r8');
 at(calc,q.baseReadCallRva,'0x185a45410');at(calc,q.baseAdditionCallRva,'0x184175da0');at(calc,q.nonnegativeMultiplierCallRva,'0x185a5c940');
 at(calc,q.multiplierProductCallRva,'0x185a3b800');at(calc,q.finalAdditionCallRva,'0x184175da0');at(calc,q.finalProductCallRva,'0x185a3b800');
 at(calc,q.lowerOverrideReadRva,'rdx, qword ptr [r13 + 0x58]');at(calc,q.upperOverrideReadRva,'rdx, qword ptr [r13 + 0x58]');at(calc,q.clampCallRva,'0x185a5c4a0');
 at(calc,q.cacheCaptureRva,'rdi, qword ptr [r13 + 0x50]');at(calc,q.cacheEncodeCallRva,'0x185a45a50');
 at(calc,q.cacheCopyWrites[0],'xmmword ptr [rdi + rcx*8 + 0x20], xmm0');at(calc,q.cacheCopyWrites[1],'xmmword ptr [rdi + rcx*8 + 0x30], xmm1');at(calc,q.cacheCopyWrites[2],'qword ptr [rdi + rcx*8 + 0x40], xmm0');
 at(q.clamp,0x5a5c4f2,'0x1851df0c0');at(q.clamp,0x5a5c51b,'0x1851df0f0');
 assert.equal(q.nativeProviderDispatchVerified,false);assert.equal(q.nativeRangeStorageVerified,false);assert.equal(q.nativeValueConversionVerified,false);assert.equal(q.liveAttributeValuesVerified,false);
});

test('buff provider source binds actual enable state and ordered four-array or neutral output writes',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.buffAttributeProvider,
  m=castMethod(c,'Buff','GetValue'),enabled=castMethod(c,'Buff','get_isEnabled');
 const at=(method,rva,args)=>assert.ok(instructions(method).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(m.parameterCount,5);assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['m_isActuallyEnabled',0x1ec],['m_attributeAdditions',0x50],
  ['m_attributeMultipliers',0x48],['m_attributeFinalAdditions',0x58],['m_attributeFinalScalers',0x60]]);
 assert.equal(q.one.hex,'0000803f');assert.equal(q.one.value,1);at(m,q.enabledCallRva,'0x1839b69e0');at(enabled,q.getterActualReadRva,'eax, byte ptr [rbx + 0x1ec]');
 for(const [index,args]of ['rax, qword ptr [rbx + 0x50]','rax, qword ptr [rbx + 0x48]','rcx, qword ptr [rbx + 0x58]','rcx, qword ptr [rbx + 0x60]'].entries())at(m,q.arrayReads[index],args);
 for(const [index,args]of ['qword ptr [rdi], rax','qword ptr [rsi], rax','qword ptr [rax], rcx','qword ptr [rax], rcx'].entries())at(m,q.enabledOutputWrites[index],args);
 for(const [index,args]of ['qword ptr [rcx], rax','qword ptr [rsi], rax','qword ptr [rdi], rax','qword ptr [rcx], rax'].entries())at(m,q.disabledOutputWrites[index],args);
 at(m,q.enabledTrueRva,'al, 1');at(m,q.disabledFalseRva,'al, al');
 assert.equal(q.nativeInterfaceDispatchVerified,false);assert.equal(q.nativeProviderHotfixVerified,false);assert.equal(q.liveBuffProviderVerified,false);
});

test('buff action dispatch source binds context guard setup, owner virtual slots and snapshot/disposal ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.runActions,m=castMethod(c,'Buff','_RunActions');
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 for(const method of q.methods)assert.equal(castMethod(c,method.type,method.name).entryRva,method.entryRva);
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['m_actions',0xa0],['m_blackboard',0xa8]]);
 assert.deepEqual(q.ownerSlots.map(s=>[s.name,s.virtualSlot,s.tableOffset]),[['get_alive',38,0x398],['get_rootTile',50,0x458]]);
 assert.equal(q.disposeInterface.name,'IDisposable');assert.equal(q.disposeInterface.encodedUsage>>>29,1);assert.equal(q.disposeInterface.method.name,'Dispose');assert.equal(q.disposeInterface.method.virtualSlot,0);
 assert.equal(q.snapshot.name,'Snapshot');assert.equal(q.snapshot.byteLength,240);assert.equal(q.snapshot.boxedHeaderBytes,16);
 assert.deepEqual(q.snapshot.fields.map(f=>[f.name,f.offset]),[['source',16],['target',24],['buff',32],['ability',40],['modifier',48],['projectile',184],['tile',192],['mainTarget',200],['atkInfo',208],['mainBuff',248]]);
 at(q.zeroLengthInputRva,'r8d, 0xf0');at(q.contextGetterCallRva,'0x1839b6660');at(q.beginGuardCallRva,'0x1839ed790');
 at(q.setBuffCallRva,'0x1839eb000');at(q.sourceGetterCallRva,'0x1839b7460');at(q.setSourceCallRva,'0x1839eb350');
 at(q.targetOwnerCallRva,'0x1839b6ff0');at(q.setTargetCallRva,'0x1839eb3e0');at(q.aliveOwnerCallRva,'0x1839b6ff0');
 at(q.aliveSlotReadRva,'rax, qword ptr [rdx + 0x398]');at(q.aliveVirtualCallRva,'rax');at(q.tileOwnerCallRva,'0x1839b6ff0');
 at(q.tileSlotReadRva,'rax, qword ptr [rdx + 0x458]');at(q.tileVirtualCallRva,'rax');at(q.setTileCallRva,'0x1839eb470');
 at(q.actionsCaptureRva,'rdi, qword ptr [rbx + 0xa0]');at(q.eventIdentityCallRva,'0x1828a66d0');at(q.eventBoundsRva,'edx, dword ptr [rdi + 0x18]');
 at(q.blackboardReadRva,'r9, qword ptr [rbx + 0xa8]');at(q.fromBuffSourceTypeRva,'r8d, 1');at(q.runArrayCallRva,'0x180e44600');
 at(q.firstResultCopyRva,'xmmword ptr [rcx], xmm0');at(q.normalDisposeCallRva,'0x180005a80');at(q.exceptionDisposeCallRva,'0x180005a80');at(q.returnCopyRva,'xmmword ptr [rsi], xmm0');
 assert.equal(q.nativeGuardEffectsVerified,false);assert.equal(q.nativeActionArrayExecutionVerified,false);assert.equal(q.nativeSnapshotCopyVerified,false);assert.equal(q.liveRunActionsVerified,false);
});

test('context guard source binds allocation, fresh setter contexts and ordered pointer/value stack disposal',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.contextGuards,
  begin=castMethod(c,'Context','BeginChangeGard'),dispose=castMethod(c,'ChangeGuard','Dispose');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.equal(q.guardField.name,'m_context');assert.equal(q.guardField.offset,0x10);
 assert.deepEqual(q.contextFields.map(f=>[f.name,f.offset]),[['m_source',0x10],['m_target',0x18],['m_buff',0x20],['m_ability',0x28],['m_modifier',0x30],
  ['m_projectile',0x38],['m_tile',0x40],['m_mainTarget',0x50],['m_atkInfo',0x48],['m_mainBuff',0x58]]);
 assert.equal(q.guardTypeLoad.encodedUsage>>>29,1);assert.equal(q.guardTypeLoad.definitionIndex,dispose.typeIndex);
 assert.equal(q.duplicateAllTarget.name,'_DuplicateAll');assert.equal(q.duplicateAllTarget.entryRva,0x39edc70);
 assert.equal(q.stackSpecifications.length,18);for(const spec of q.stackSpecifications)assert.equal(spec.encodedUsage>>>29,6);
 assert.deepEqual(q.stackSpecifications.slice(0,8).map(s=>s.specification.definition.name),['Pop','Push','Pop','Push','Pop','Push','Pop','Push']);
 assert.deepEqual(q.stackSpecifications.slice(8).map(s=>s.specification.declaringType),['ContextPtrStack`1','ContextPtrStack`1','ContextPtrStack`1','ContextValueStack`1','ContextValueStack`1',
  'ContextPtrStack`1','ContextPtrStack`1','ContextValueStack`1','ContextValueStack`1','ContextPtrStack`1']);
 assert.deepEqual(q.stackSpecifications.slice(8).map(s=>s.specification.instantiations.class.arguments[0].name),['Entity','Entity','Buff','Ability','Modifier','Projectile','Tile','Entity','AttackInfo','Buff']);
 at(begin,q.allocateCallRva,'0x180410630');at(begin,q.initializeCallRva,'0x180511a50');at(begin,q.contextWriteRva,'qword ptr [rdi + 0x10], rsi');
 at(begin,q.contextRereadRva,'rdx, qword ptr [rdi + 0x10]');at(begin,q.duplicateAllCallRva,'0x1839edc70');
 for(const [index,name]of ['set_buff','set_source','set_target','set_tile'].entries()){
  const setter=castMethod(c,'ChangeGuard',name);at(setter,q.setterPopCalls[index],'0x184be7e60');at(setter,q.setterContextRereads[index],'rcx, qword ptr [rbx + 0x10]');at(setter,q.setterPushTails[index],'0x184be7ef0');
 }
 at(dispose,q.disposeContextCaptureRva,'rbx, qword ptr [rcx + 0x10]');
 for(const [index,target]of ['0x184be7e60','0x184be7e60','0x184be7e60','0x184be81a0','0x184be8210','0x184be7e60','0x184be7e60','0x184be81a0','0x184be8320','0x184be7e60'].entries())at(dispose,q.disposePopCalls[index],target);
 assert.equal(q.nativeGuardAllocationVerified,false);assert.equal(q.nativeContextDuplicationVerified,false);assert.equal(q.nativeContextStackEffectsVerified,false);assert.equal(q.liveContextGuardsVerified,false);
});

test('context snapshot source binds distinct capture/push orders and closed reference/value stack methods',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.contextSnapshots,
  capture=castMethod(c,'Context','TakeSnapshot'),duplicate=castMethod(c,'Context','_DuplicateAll');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.deepEqual(q.stackSpecifications.map(s=>[s.method,s.bindings.length]),[['TakeSnapshot',10],['_DuplicateAll',10]]);
 for(const [index,row]of q.stackSpecifications.entries())for(const binding of row.bindings){assert.equal(binding.encodedUsage>>>29,6);assert.equal(binding.specification.definition.name,index===0?'get_value':'Push');}
 assert.deepEqual(q.stackSpecifications[0].bindings.map(b=>b.specification.instantiations.class.arguments[0].name),['Entity','Entity','Buff','Ability','Modifier','Projectile','Tile','AttackInfo','Entity','Buff']);
 assert.deepEqual(q.stackSpecifications[1].bindings.map(b=>b.specification.instantiations.class.arguments[0].name),['Entity','Entity','Buff','Ability','Modifier','Projectile','Tile','Entity','AttackInfo','Buff']);
 for(const [index,args]of ['rcx, qword ptr [rdi + 0x10]','rcx, qword ptr [rdi + 0x18]','rcx, qword ptr [rdi + 0x20]','rcx, qword ptr [rdi + 0x28]',
  'rdx, qword ptr [rdi + 0x30]','rcx, qword ptr [rdi + 0x38]','rcx, qword ptr [rdi + 0x40]','rdx, qword ptr [rdi + 0x48]',
  'rcx, qword ptr [rdi + 0x50]','rcx, qword ptr [rdi + 0x58]'].entries())at(capture,q.captureFieldReads[index],args);
 for(const [index,target]of ['0x18432a930','0x18432a930','0x18432a930','0x18432a930','0x184be8410','0x18432a930','0x18432a930','0x184be83c0','0x18432a930','0x18432a930'].entries())at(capture,q.captureCalls[index],target);
 at(capture,q.captureModifierCopyRva,'xmmword ptr [rcx], xmm0');at(capture,q.captureAttackCopyRva,'xmmword ptr [rbx + 0xc0], xmm0');
 at(duplicate,q.duplicateCaptureCallRva,'0x1839ed9a0');at(duplicate,q.duplicateFirstCopyRva,'xmmword ptr [rbx], xmm0');
 for(const [index,args]of ['rcx, qword ptr [rdi + 0x10]','rcx, qword ptr [rdi + 0x18]','rcx, qword ptr [rdi + 0x20]','rcx, qword ptr [rdi + 0x28]',
  'r9, qword ptr [rdi + 0x30]','rcx, qword ptr [rdi + 0x38]','rcx, qword ptr [rdi + 0x40]','rcx, qword ptr [rdi + 0x50]',
  'rcx, qword ptr [rdi + 0x48]','rcx, qword ptr [rdi + 0x58]'].entries())at(duplicate,q.pushFieldReads[index],args);
 for(const [index,target]of ['0x184be7ef0','0x184be7ef0','0x184be7ef0','0x18490b650','0x18490b820','0x184be7ef0','0x184be7ef0','0x18490b650','0x18490b790','0x184be7ef0'].entries())at(duplicate,q.pushCalls[index],target);
 assert.equal(q.nativeContextStackEffectsVerified,false);assert.equal(q.nativeNestedValueCopiesVerified,false);assert.equal(q.liveContextSnapshotsVerified,false);
});

test('BuffData constructor source binds defaults, empty template literal and late base construction',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.buffDataConstruction;
 assert.deepEqual(q.methods.map(m=>[m.type,m.index,m.entryRva]),[['BuffData',28665,0x225d300],['AttributeModifierData',28601,0x2161af0]]);
 assert.deepEqual(q.defaults,{statusResistable:2,templateKey:'empty',maxStackCnt:1,maxValidStackCnt:-1,lifeTimeType:1,triggerInterval:-1,waitFirstTriggerInterval:true,firstTriggerInterval:-1,priority:-1});
 assert.equal(q.templateLiterals.length,2);for(const literal of q.templateLiterals){assert.equal(literal.encodedUsage>>>29,5);assert.equal((literal.encodedUsage&0x1ffffffe)>>>1,27738);assert.equal(literal.value,'empty');}
 assert.deepEqual(q.attributeFields.map(f=>[f.name,f.offset]),[['abnormalFlags',16],['abnormalImmunes',24],['abnormalAntis',32],['abnormalCombos',40],['abnormalComboImmunes',48],['attributeModifiers',56]]);
 const at=(index,rva,args)=>assert.ok(instructions(c.methods.find(m=>m.index===index)).some(i=>i.rva===rva&&i.operands===args),'BuffData constructor instruction '+rva.toString(16));
 for(const [key,args]of [['allocateAttributesCallRva','0x180410630'],['attributeConstructorCallRva','0x182161af0'],['attributeWriteRva','qword ptr [rcx], rdi'],['attributeBarrierCallRva','0x18040ff90'],['statusWriteRva','byte ptr [rbx + 0x27], 2'],['templateWriteRva','qword ptr [rcx], rax'],['templateBarrierCallRva','0x18040ff90'],['maxStackWriteRva','dword ptr [rbx + 0x44], 1'],['maxValidStackWriteRva','dword ptr [rbx + 0x4c], 0xffffffff'],['lifeTypeWriteRva','byte ptr [rbx + 0x70], 1'],['triggerIntervalWriteRva','dword ptr [rbx + 0x8c], 0xbf800000'],['waitFirstWriteRva','byte ptr [rbx + 0x90], 1'],['packedFirstIntervalAndPriorityWriteRva','qword ptr [rbx + 0x94], 0xffffffffbf800000'],['baseConstructorCallRva','0x180511a50']])at(28665,q[key],args);
 at(28601,q.attributeBaseConstructorCallRva,'0x180511a50');assert.ok(q.attributeConstructorCallRva<q.attributeWriteRva&&q.templateBarrierCallRva<q.maxStackWriteRva&&q.packedFirstIntervalAndPriorityWriteRva<q.baseConstructorCallRva);
 for(const name of ['nativeZeroedAllocationVerified','nativeBaseConstructorEffectsVerified','nativeHotfixDispatchVerified','nativeWriteBarrierEffectsVerified','liveBuffDataConstructionVerified'])assert.equal(q[name],false);
});

test('BuffData.DeepClone source binds the complete Windows field layout and distinct nested-copy phases',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.buffDataClone,m=c.methods.find(m=>m.index===q.methodIndex);assert.equal(m.type,'BuffData');assert.equal(m.name,'DeepClone');assert.equal(m.entryRva,0x225cbc0);
 assert.equal(q.fields.length,37);assert.equal(q.scalarCopies.length,34);assert.deepEqual(new Set(q.fields.map(f=>f.name)),new Set([...q.scalarCopies.map(f=>f.field),'attributes','priorityBBKeys','blackboard']));
 assert.equal(q.fields.some(f=>f.name==='isGroundBoundable'||f.name==='remainingTimeKey'),false);assert.deepEqual(q.scalarCopies.filter(f=>f.kind==='byte').map(f=>[f.field,f.offset]),[['statusResistable',39],['lifeTimeType',112],['triggerLifeType',132]]);
 for(const copy of q.scalarCopies){const read=instructions(m).find(i=>i.rva===copy.readRva),write=instructions(m).find(i=>i.rva===copy.writeRva);assert.equal(q.fields.find(f=>f.name===copy.field).offset,copy.offset);assert.ok(read.operands.endsWith('[rdi + 0x'+copy.offset.toString(16)+']'));assert.equal(write.mnemonic,'mov');assert.ok(copy.readRva<copy.writeRva);}
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),'BuffData.DeepClone instruction '+rva.toString(16));
 for(const [key,args]of [['allocateCallRva','0x180410630'],['attributeCloneCallRva','0x182161640'],['attributeWriteRva','qword ptr [rbx + 0x10], rax'],['priorityKeysReadRva','rcx, qword ptr [rdi + 0xa0]'],['priorityCloneCallRva','0x1835dd780'],['priorityCastCallRva','0x18040ffa0'],['priorityCastFailureRva','0x18040ffd0'],['priorityKeysWriteRva','qword ptr [rcx], rax'],['blackboardProbeReadRva','rcx, qword ptr [rdi + 0xb0]'],['blackboardProbeCallRva','0x183f62450'],['blackboardCaptureRva','rsi, qword ptr [rdi + 0xb0]'],['blackboardAllocateCallRva','0x180410630'],['blackboardCopyCallRva','0x182167de0'],['blackboardWriteRva','qword ptr [rcx], rdi']])at(q[key],args);
 assert.ok(q.attributeWriteRva<q.scalarCopies[0].readRva&&q.priorityKeysWriteRva<q.scalarCopies.at(-2).readRva&&q.scalarCopies.at(-1).writeRva<q.blackboardProbeReadRva);assert.ok(q.blackboardCaptureRva<q.blackboardAllocateCallRva&&q.blackboardAllocateCallRva<q.blackboardCopyCallRva);
 for(const name of ['nativeConstructorEffectsVerified','nativeAttributeCloneEffectsVerified','nativeArrayCloneAndCastVerified','nativeBlackboardCopyVerified','liveBuffDataCloneVerified'])assert.equal(q[name],false);
});

test('DataPair list growth source binds specialized bodies, RGCTX dispatch and copy/publication order',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.blackboardListGrowth;
 assert.deepEqual(q.bodies.map(b=>[b.specification.index,b.specification.definition.name,b.entryRva]),[[117464,'AddWithResize',0x451b700],[117474,'EnsureCapacity',0x450f350],[117528,'set_Capacity',0x4519de0]]);
 for(const body of q.bodies){assert.equal(body.specification.declaringTypeIndex,38190);assert.equal(body.specification.instantiations.class.arguments[0].typeIndex,3917);for(const chunk of body.chunks){const raw=Buffer.from(chunk.base64,'base64');assert.equal(sha(raw),chunk.sha256);assert.equal(raw.length,chunk.endRva-chunk.beginRva);}}
 assert.equal(q.maximumCapacity,0x7fefffff);assert.equal(q.genericContext.token,0x2000612);assert.equal(q.genericContext.start,1292);assert.equal(q.genericContext.length,53);assert.equal(q.genericContext.genericArgumentKind,19);
 assert.deepEqual(q.genericContext.bindings.map(b=>[b.slot,b.specificationIndex,b.definition.index,b.definition.name,b.classInstantiationIndex]),[[11,90893,224983,'AddWithResize',255],[12,90897,224998,'EnsureCapacity',255],[24,90912,224970,'set_Capacity',255]]);
 for(const b of q.genericContext.bindings){assert.equal(b.kind,3);assert.equal(Buffer.from(b.entryHex,'hex').length,16);assert.equal(Buffer.from(b.descriptorHex,'hex').readInt32LE(0),b.specificationIndex);}
 const at=(name,rva,args)=>assert.ok(instructions(q.bodies.find(b=>b.specification.definition.name===name)).some(i=>i.rva===rva&&i.operands===args),'DataPair growth instruction '+rva.toString(16));
 for(const [key,args]of [['resizeSizeReadRva','rsi, dword ptr [rcx + 0x18]'],['resizeNextCountRva','ebx, [rsi + 1]'],['ensureCallRva','qword ptr [rax + 8]'],['resizeItemsRereadRva','rcx, qword ptr [rdi + 0x10]'],['resizeCountWriteRva','dword ptr [rdi + 0x18], ebx'],['resizeArrayBoundsRva','esi, dword ptr [rcx + 0x18]'],['resizePairReadRva','xmm0, xmmword ptr [rbp]'],['resizePairWriteRva','xmmword ptr [rcx], xmm0'],['resizeBarrierTailRva','0x18040ff90']])at('AddWithResize',q[key],args);
 for(const [key,args]of [['ensureCapacityCompareRva','dword ptr [rax + 0x18], edx'],['defaultCapacityRva','edx, 4'],['doubleCapacityRva','edx, edx'],['maximumCapacityRva','eax, 0x7fefffff'],['unsignedMaximumClampRva','edx, eax'],['minimumClampRva','edx, r9d'],['setCapacityTailRva','qword ptr [rax + 8]']])at('EnsureCapacity',q[key],args);
 for(const [key,args]of [['capacitySizeCheckRva','edx, dword ptr [rcx + 0x18]'],['capacityItemsReadRva','rax, qword ptr [rsi + 0x10]'],['capacityEqualCheckRva','edi, dword ptr [rax + 0x18]'],['emptyItemsWriteRva','qword ptr [rsi + 0x10], rdx'],['allocateCallRva','0x180410010'],['copySizeRereadRva','eax, dword ptr [rsi + 0x18]'],['copyItemsRereadRva','rcx, qword ptr [rsi + 0x10]'],['copyCallRva','0x1851ce8a0'],['publishRva','qword ptr [rsi + 0x10], rdi'],['capacityBarrierCallRva','0x18040ff90']])at('set_Capacity',q[key],args);
 assert.ok(q.allocateCallRva<q.copySizeRereadRva&&q.copySizeRereadRva<q.copyCallRva&&q.copyCallRva<q.publishRva);assert.ok(q.ensureCallRva<q.resizeItemsRereadRva&&q.resizeCountWriteRva<q.resizeArrayBoundsRva&&q.resizeArrayBoundsRva<q.resizePairReadRva);
 for(const name of ['nativeRuntimeGenericInflationVerified','nativeArrayAllocationAndCopyVerified','nativeWriteBarrierEffectsVerified','liveDataPairGrowthVerified'])assert.equal(q[name],false);
});

test('DataPair list storage source binds complete specialized bodies and distinct version/write order',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.blackboardListStorage;
 assert.deepEqual(q.selectedLayout,{_items:16,_size:24,_version:28});assert.deepEqual(q.bodies.map(b=>[b.specification.index,b.specification.definition.name,b.entryRva]),[[117458,'.ctor',0x430e530],[117527,'get_Item',0x4519cb0],[117529,'set_Item',0x4520160],[117461,'Add',0x451b890]]);
 for(const body of q.bodies){assert.equal(body.specification.instantiations.class.arguments[0].typeIndex,3917);for(const chunk of body.chunks){const raw=Buffer.from(chunk.base64,'base64');assert.equal(sha(raw),chunk.sha256);assert.equal(raw.length,chunk.endRva-chunk.beginRva);}}
 const at=(name,rva,args)=>assert.ok(instructions(q.bodies.find(b=>b.specification.definition.name===name)).some(i=>i.rva===rva&&i.operands===args),'DataPair list instruction '+rva.toString(16));
 for(const [key,args]of [['constructorBaseCallRva','0x180511a50'],['constructorItemsWriteRva','qword ptr [rcx], rdx'],['constructorBarrierTailRva','0x18040ff90']])at('.ctor',q[key],args);
 for(const [key,args]of [['getListBoundsRva','ebx, dword ptr [rdx + 0x18]'],['getItemsReadRva','rdx, qword ptr [rdi + 0x10]'],['getArrayBoundsRva','ebx, dword ptr [rdx + 0x18]'],['getPairReadRva','xmm0, xmmword ptr [rdx + rcx*8 + 0x20]'],['getPairStringReadRva','xmm1, qword ptr [rdx + rcx*8 + 0x30]']])at('get_Item',q[key],args);
 for(const [key,args]of [['setListBoundsRva','ebx, dword ptr [rcx + 0x18]'],['setItemsReadRva','rdx, qword ptr [rdi + 0x10]'],['setArrayBoundsRva','ebx, dword ptr [rdx + 0x18]'],['setPairWriteRva','xmmword ptr [rcx], xmm0'],['setStringWriteRva','qword ptr [rcx + 0x10], xmm1'],['setBarrierCallRva','0x18040ff90'],['setVersionIncrementRva','dword ptr [rdi + 0x1c]']])at('set_Item',q[key],args);
 for(const [key,args]of [['addVersionIncrementRva','dword ptr [rcx + 0x1c]'],['addItemsReadRva','rcx, qword ptr [rcx + 0x10]'],['addSizeReadRva','r9, dword ptr [r10 + 0x18]'],['addCapacityCompareRva','r9d, dword ptr [rcx + 0x18]'],['addResizePairCopyRva','xmm0, xmmword ptr [rdx]'],['addResizeCallRva','qword ptr [rax + 8]'],['addSizeWriteRva','dword ptr [r10 + 0x18], eax'],['addPairWriteRva','xmmword ptr [rcx], xmm0'],['addStringWriteRva','qword ptr [rcx + 0x10], xmm1'],['addBarrierTailRva','0x18040ff90']])at('Add',q[key],args);
 assert.ok(q.setPairWriteRva<q.setBarrierCallRva&&q.setBarrierCallRva<q.setVersionIncrementRva);assert.ok(q.addVersionIncrementRva<q.addItemsReadRva&&q.addItemsReadRva<q.addSizeReadRva&&q.addSizeWriteRva<q.addPairWriteRva);
 for(const name of ['nativeTypeInitializationVerified','nativeWriteBarrierEffectsVerified','nativeListGrowthVerified','liveDataPairStorageVerified'])assert.equal(q[name],false);
});

test('Blackboard.MergeTo source binds list specialization, pair copies and destination rereads',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.blackboardMerge,m=c.methods.find(m=>m.index===q.methodIndex);
 assert.equal(m.type,'Blackboard');assert.equal(m.name,'MergeTo');assert.equal(m.entryRva,0x2166d70);assert.equal(q.pairSize,24);assert.deepEqual(q.unboxedPairOffsets,{key:0,value:8,valueStr:16});assert.deepEqual(q.pairFields.map(f=>[f.name,f.offset]),[['key',16],['value',24],['valueStr',32]]);
 assert.deepEqual(q.listLoads.map(load=>[load.specification.index,load.specification.definition.name]),[[117458,'.ctor'],[117527,'get_Item'],[117527,'get_Item'],[117529,'set_Item'],[117461,'Add']]);
 for(const load of q.listLoads){assert.equal(load.encodedUsage>>>29,6);assert.equal((load.encodedUsage&0x1ffffffe)>>>1,load.specification.index);assert.equal(load.specification.instantiations.class.arguments[0].typeIndex,3917);assert.equal(load.specification.declaringType,'List`1');assert.ok(load.mappedEntryRva>0);}
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),'Blackboard.MergeTo instruction '+rva.toString(16));
 for(const [key,args]of [['sourceNullCheckRva','r14, r14'],['targetNullCheckRva','qword ptr [rdi], rcx'],['allocateCallRva','0x180410630'],['initializeCallRva','0x18430e530'],['publishRva','qword ptr [rdi], rbx'],['sourceCountReadRva','eax, dword ptr [r14 + 0x18]'],['sourceItemCallRva','0x184519cb0'],['sourceKeyCaptureRva','rbp, qword ptr [rsp + 0x20]'],['targetReadRva','rdx, qword ptr [rdi]'],['targetCountReadRva','ebx, dword ptr [rdx + 0x18]'],['targetItemCallRva','0x184519cb0'],['ignoreCaseArgumentRva','r8b, 1'],['compareCallRva','0x1850cd8b0'],['replacementTargetReadRva','rcx, qword ptr [rdi]'],['replacementPairCopyRva','xmm0, xmmword ptr [rsp + 0x20]'],['replacementCallRva','0x184520160'],['appendPairCopyRva','xmm0, xmmword ptr [rsp + 0x20]'],['appendCallRva','0x18001b340']])at(q[key],args);
 assert.ok(q.sourceNullCheckRva<q.targetNullCheckRva&&q.initializeCallRva<q.publishRva&&q.compareCallRva<q.replacementTargetReadRva);
 for(const name of ['nativeListStorageEffectsVerified','nativeCultureComparisonVerified','liveBlackboardMergeVerified'])assert.equal(q[name],false);
});

test('BuffDB source distinguishes inline identity from cloned database data and post-publication merge',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.buffDatabase;
 assert.deepEqual(q.methods.map(m=>[m.index,m.entryRva]),[[68624,0x8789a0],[68623,0x878790]]);
 assert.deepEqual(q.dataFields.map(f=>[f.name,f.offset]),[['buffKey',24],['loadFromDB',32],['templateKey',40],['blackboard',176]]);
 assert.deepEqual(q.receivers.map(m=>[m.type,m.name,m.index,m.entryRva,m.parameters.map(p=>p.name)]),[['BuffDBUtil','TryGetTemplate',68626,0x878ac0,['key','template']],['BuffData','DeepClone',28664,0x225cbc0,[]],['Blackboard','MergeTo',28620,0x2166d70,['to','from']]]);
 const at=(index,rva,args)=>assert.ok(instructions(c.methods.find(m=>m.index===index)).some(i=>i.rva===rva&&i.operands===args),'BuffDB instruction '+rva.toString(16));
 for(const [key,args]of [['inlineFlagReadRva','byte ptr [rbx + 0x20], cl'],['inlineTemplateKeyReadRva','rcx, qword ptr [rbx + 0x28]'],['inlineTemplateCallRva','0x180878ac0'],['inlineFailureClearRva','xmmword ptr [rdi], xmm0'],['inlinePublishRva','xmmword ptr [rdi], xmm0'],['externalBoardReadRva','r8, qword ptr [rbx + 0xb0]'],['databaseKeyReadRva','rcx, qword ptr [rbx + 0x18]'],['databaseOverloadCallRva','0x180878790']])at(68624,q[key],args);
 for(const [key,args]of [['dataLookupCallRva','r10'],['templateKeyReadRva','rcx, qword ptr [rcx + 0x28]'],['templateCallRva','0x180878ac0'],['cloneSourceReadRva','rcx, qword ptr [rsp + 0x30]'],['cloneCallRva','0x18225cbc0'],['publishRva','xmmword ptr [rbx], xmm0'],['externalBoardNullCheckRva','rbp, rbp'],['mergeBoardReadRva','rax, qword ptr [rax + 0xb0]'],['mergeCallRva','0x182166d70'],['mergeDataRereadRva','rcx, qword ptr [rbx + 8]'],['mergeBoardWriteRva','qword ptr [rcx], rdx'],['databaseFailureClearRva','xmmword ptr [rbx], xmm0']])at(68623,q[key],args);
 assert.ok(q.templateCallRva<q.cloneCallRva&&q.cloneCallRva<q.publishRva&&q.publishRva<q.mergeCallRva&&q.mergeCallRva<q.mergeDataRereadRva);
 for(const name of ['nativeDatabaseAndTemplateEffectsVerified','nativeDeepCloneEffectsVerified','nativeBlackboardMergeEffectsVerified','liveBuffDatabaseVerified'])assert.equal(q[name],false);
});

test('Entity.AddBuff source binds data lookup, two config copies and container dispatch',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.entityAddBuff;
 assert.deepEqual(q.methods.map(m=>[m.index,m.name,m.entryRva]),[[57965,'AddBuff',0x3a174d0],[57964,'AddBuff',0x3a17370],[57828,'get_buffContainer',0x3a295e0]]);
 assert.equal(q.containerField.name,'<buffContainer>k__BackingField');assert.equal(q.containerField.offset,0x150);assert.equal(q.containerField.typeData,8931);
 assert.deepEqual(q.unboxedConfigFieldOffsets,{template:0,data:8});assert.deepEqual(q.configFields.map(f=>[f.name,f.offset]),[['template',16],['data',24]]);
 assert.equal(q.lookup.typeIndex,10272);assert.equal(q.lookup.name,'TryGetBuff');assert.equal(q.lookup.index,68624);assert.equal(q.lookup.entryRva,0x8789a0);assert.equal(q.lookup.outConfigTypeBits,0x20110002);
 assert.deepEqual(q.signatures.map(s=>s.parameters.map(p=>p.name)),[['data','source','ability','extraBlackboard','extraBlackboard2','sourceProjectile','customOverrideEffectKey'],['config','source','ability','extraBlackboard','extraBlackboard2','sourceProjectile','customOverrideEffectKey'],['data','result']]);assert.equal(q.signatures[1].parameters[0].typeIndex,39044);assert.equal(q.signatures[2].parameters[1].typeIndex,q.lookup.outConfigTypeIndex);
 const body=index=>c.methods.find(m=>m.index===index),at=(index,rva,args)=>assert.ok(instructions(body(index)).some(i=>i.rva===rva&&i.operands===args),'Entity.AddBuff instruction '+rva.toString(16));
 for(const [key,args]of [['zeroConfigRva','xmmword ptr [rsp + 0x50], xmm0'],['lookupCallRva','0x1808789a0'],['lookupFailureBranchRva','0x183a17621'],['lookupConfigReadRva','xmm0, xmmword ptr [rsp + 0x50]'],['overloadCopyRva','xmmword ptr [rsp + 0x60], xmm0'],['configOverloadCallRva','0x183a17370'],['missingDataKeyReadRva','rbx, qword ptr [rsi + 0x18]'],['missingTemplateKeyReadRva','rbx, qword ptr [rsi + 0x28]'],['missingExceptionCallRva','0x180410640']])at(57965,q[key],args);
 for(const [key,args]of [['containerCallRva','0x183a295e0'],['containerNullCheckRva','rax, rax'],['containerConfigReadRva','xmm0, xmmword ptr [rbp]'],['containerConfigCopyRva','xmmword ptr [rsp + 0x50], xmm0'],['newBuffCallRva','0x1839c2370']])at(57964,q[key],args);
 at(57828,q.containerFieldReadRva,'rax, qword ptr [rbx + 0x150]');assert.ok(q.lookupConfigReadRva<q.overloadCopyRva&&q.overloadCopyRva<q.configOverloadCallRva);assert.ok(q.containerCallRva<q.containerConfigReadRva&&q.containerConfigReadRva<q.containerConfigCopyRva&&q.containerConfigCopyRva<q.newBuffCallRva);
 for(const name of ['nativeLookupEffectsVerified','nativeMissingConfigExceptionVerified','nativeContainerAdmissionEffectsVerified','liveEntityAddBuffVerified'])assert.equal(q[name],false);
});

test('CreateBuff source binds copied blackboard, fresh parent reads and unconditional post-admission success',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.createBuffNode,m=c.methods.find(m=>m.type==='CreateBuff'&&m.name==='Execute');
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['_buff',16],['_buffOwner',24],['_useSpecialBuffSource',28],['_specialBuffSource',32],['_isDerivedBuff',36],['_finishDerivedBuffIfParentFinish',37],['_inherateSourceProjectileFromParentBuff',38],['_hookEffectKeyFromSourceProjectile',39]]);
 assert.deepEqual(q.calls.map(m=>[m.index,m.entryRva]),[[84934,0xd28de0],[56519,0x39b73d0],[56549,0x39b61d0],[62124,0x67dda0],[28607,0x2167de0],[56584,0x39a9560],[57965,0x3a174d0]]);assert.equal(q.calls[0].virtualSlot,8);
 assert.deepEqual(q.calls.at(-1).parameters.map(p=>p.name),['data','source','ability','extraBlackboard','extraBlackboard2','sourceProjectile','customOverrideEffectKey']);
 assert.deepEqual(q.calls.at(-2).parameters.map(p=>p.name),['parentBuff','derivedBuff','finishDerivedBuffIfParentFinish']);
 assert.deepEqual(q.getterFields.map(f=>[f.name,f.offset]),[['m_ability',40],['m_sourceProjectile',56],['overrideEffectKey',88]]);
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),'CreateBuff instruction '+rva.toString(16));
 for(const [key,args]of [['ownerCallRva','0x180ced380'],['validityCallRva','0x185ebec60'],['sourceCallRva','0x1839b7460'],['abilityParentReadRva','rcx, qword ptr [r15 + 0x10]'],['abilityCallRva','0x1839b61d0'],['specialSourceCallRva','0x180ced380'],['hookDataCallRva','0x1800057b0'],['overrideKeyReadRva','rsi, qword ptr [rax + 0x58]'],['hookProjectileCallRva','0x1839b73d0'],['pairCopyRva','xmm0, xmmword ptr [r14 + rax*8]'],['keyEqualsCallRva','0x1850d0da0'],['pairValueReadRva','rsi, qword ptr [rsp + 0x60]'],['allocateCallRva','0x180410630'],['blackboardCopyCallRva','0x182167de0'],['finalDataCallRva','rax'],['inheritParentReadRva','rcx, qword ptr [r15 + 0x10]'],['inheritProjectileCallRva','0x1839b73d0'],['addBuffCallRva','0x183a174d0'],['derivedParentReadRva','rbx, qword ptr [r15 + 0x10]'],['derivedFinishReadRva','edi, byte ptr [rdi + 0x25]'],['addDerivedCallRva','0x1839a9560'],['trueReturnRva','al, 1'],['falseReturnRva','al, al']])at(q[key],args);
 for(const rva of q.effectPairsCalls)at(rva,'0x18067dda0');
 assert.ok(q.blackboardCopyCallRva<q.finalDataCallRva&&q.finalDataCallRva<q.addBuffCallRva&&q.addBuffCallRva<q.trueReturnRva);
 for(const [index,typeIndex]of [[253167,8742],[253231,9558]]){const load=q.lockLoads.find(l=>l.specification.index===index);assert.equal(load.encodedUsage>>>29,6);assert.equal((load.encodedUsage&0x1ffffffe)>>>1,index);assert.equal(load.specification.nativeMapping,null);assert.equal(load.specification.instantiations.class.arguments[0].typeIndex,typeIndex);}
 for(const [name,address,tail,args]of [['get_ability',q.abilityAddressRva,q.abilityLockTailRva,'rcx, [rbx + 0x28]'],['get_sourceProjectile',q.projectileAddressRva,q.projectileLockTailRva,'rcx, [rbx + 0x38]']]){const body=c.methods.find(m=>m.type==='Buff'&&m.name===name);assert.ok(instructions(body).some(i=>i.rva===address&&i.operands===args));assert.ok(instructions(body).some(i=>i.rva===tail&&i.operands==='0x18477cad0'));}
 for(const name of ['nativeBlackboardCopyEffectsVerified','nativeDataAndEffectReplacementVerified','nativeAdmissionAndDerivedEffectsVerified','liveCreateBuffNodeVerified'])assert.equal(q[name],false);
});

test('InstantKill source binds RallyPoint dispatch, finish precedence and the post-effect alive query',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.instantKillNode,m=c.methods.find(m=>m.type==='InstantKill'&&m.name==='Execute');
 assert.equal(q.fields.length,9);assert.equal(q.rallyType.name,'RallyPoint');assert.equal(q.rallyType.definitionIndex,10181);assert.equal(q.rallyType.encodedUsage>>>29,1);
 assert.deepEqual(q.virtualSlots.map(m=>[m.type,m.name,m.virtualSlot,m.parameters.map(p=>p.name)]),[['RallyPoint','Withdraw',215,['switchToDeadState','force','manual','logAutoWithdraw']],['Entity','FinishWithReachExit',92,['switchState']]]);
 assert.equal(q.suicideField.name,'m_isSuicide');assert.equal(q.suicideField.offset,0xd1);
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(q.killSourceFlagReadRva,'byte ptr [rsi + 0x14], cl');at(q.sourceReadRva,'rbx, qword ptr [rbx]');at(q.targetCallRva,'0x180ced380');at(q.validityCallRva,'0x185ebec60');
 at(q.withdrawFlagReadRva,'byte ptr [rsi + 0x16], 0');at(q.rallyValidityCallRva,'0x185ebee90');at(q.rallyModeCallRva,'0x180844680');at(q.withdrawCallRva,'r10');at(q.rallyResultReadRva,'eax, byte ptr [rsi + 0x17]');
 at(q.noReasonFlagReadRva,'byte ptr [rsi + 0x19], 0');at(q.reachExitFlagReadRva,'byte ptr [rsi + 0x1a], 0');at(q.skipRebornReadRva,'r8d, byte ptr [rsi + 0x18]');at(q.noSourceReadRva,'edx, byte ptr [rsi + 0x15]');
 at(q.suicideCallRva,'0x183a25b90');at(q.switchStateReadRva,'edi, byte ptr [rsi + 0x1b]');at(q.reachExitCallRva,'qword ptr [rax + 0x6f8]');at(q.noReasonCallRva,'0x183a1b510');at(q.returnAliveCallRva,'rax');
 const suicide=c.methods.find(m=>m.type==='Entity'&&m.name==='Suicide');assert.ok(instructions(suicide).some(i=>i.rva===q.suicideMarkRva&&i.operands==='byte ptr [rbx + 0xd1], 1'));assert.ok(instructions(suicide).some(i=>i.rva===q.suicideHpCallRva&&i.operands==='0x180012f30'));
 for(const name of ['nativeRallyCastAndWithdrawEffectsVerified','nativeFinishEffectsVerified','nativeHpEncodingAndEffectsVerified','liveInstantKillNodeVerified'])assert.equal(q[name],false);
});

test('SwitchMode node source binds the mode key, void Unit signatures and true-after-dispatch results',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.switchModeNode,m=c.methods.find(m=>m.type==='SwitchMode'&&m.name==='Execute');
 assert.deepEqual(q.fields.map(f=>[f.name,f.offset]),[['_modeIndex',16],['_loadModeFromBlackboard',20],['_restoreDefault',21],['_restartFSM',22],['_targetType',24]]);
 assert.deepEqual(q.unitCalls.map(m=>[m.index,m.name,m.returnKind,m.parameters.map(p=>p.name)]),[[68052,'SwitchMode',1,['index','restartFSM']],[68054,'SwitchToDefaultMode',1,['restartFSM']]]);
 assert.equal(q.unitType.encodedUsage>>>29,1);assert.equal(q.unitType.name,'Unit');assert.equal(q.modeKey.encodedUsage>>>29,5);assert.equal(q.modeKey.index,31621);assert.equal(q.modeKey.value,'mode');assert.equal(q.modeKey.hex,'6d6f6465');
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 at(q.targetReadRva,'edx, dword ptr [rdi + 0x18]');at(q.targetCallRva,'0x180ced380');at(q.validityCallRva,'0x185ebec60');at(q.loadFlagReadRva,'byte ptr [rdi + 0x14], al');at(q.tryReadIntCallRva,'0x182167520');at(q.fallbackIndexReadRva,'edx, dword ptr [rdi + 0x10]');
 at(q.restoreFlagReadRva,'byte ptr [rdi + 0x15], 0');at(q.switchCallRva,'0x180855090');at(q.switchSuccessRva,'al, 1');at(q.restoreCallRva,'0x180855260');at(q.restoreSuccessRva,'al, 1');
 assert.ok(c.methods.some(m=>m.index===68054&&m.entryRva===0x855260));
 for(const name of ['nativeUnitCastVerified','nativeBlackboardTryReadVerified','nativeUnitModeEffectsVerified','liveSwitchModeNodeVerified'])assert.equal(q[name],false);
});

test('target getter source binds raw container ownership and six by-reference pointer Lock tails',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.targetGetters;
 assert.deepEqual(q.methods.map(m=>[m.type,m.name]),[['Buff','get_owner'],['Buff','get_source'],['BuffContainer','get_owner'],['Modifier','get_source'],['Modifier','get_target'],['Ability','get_owner'],['Projectile','get_source'],['Projectile','get_traceTarget']]);
 assert.deepEqual(q.fields.map(f=>[f.type,f.name,f.offset]),[['Buff','m_container',16],['Buff','m_source',24],['BuffContainer','<owner>k__BackingField',16],['Ability','m_owner',72],['Projectile','m_source',240],['Projectile','m_traceTarget',272]]);
 assert.equal(q.lockSpecification.index,253210);assert.equal(q.lockSpecification.nativeMapping,null);assert.equal(q.lockSpecification.instantiations.class.arguments[0].name,'Entity');assert.equal(q.lockLoads.length,6);assert.ok(q.lockLoads.every(load=>(load.encodedUsage>>>29)===6&&((load.encodedUsage&0x1ffffffe)>>>1)===253210));
 const method=(type,name)=>c.methods.find(m=>m.type===type&&m.name===name),at=(type,name,rva,args)=>assert.ok(instructions(method(type,name)).some(i=>i.rva===rva&&i.operands===args));
 at('Buff','get_owner',q.buffContainerReadRva,'rcx, qword ptr [rbx + 0x10]');at('Buff','get_owner',q.containerOwnerTailRva,'0x1839d8230');at('BuffContainer','get_owner',q.containerOwnerReadRva,'rax, qword ptr [rbx + 0x10]');
 for(const [type,name,addressRva,tailRva,args]of [['Buff','get_source',q.buffSourceAddressRva,q.buffSourceLockTailRva,'rcx, [rbx + 0x18]'],['Modifier','get_source',q.modifierSourceAddressRva,q.modifierSourceLockTailRva,'rcx, rbx'],['Modifier','get_target',q.modifierTargetAddressRva,q.modifierTargetLockTailRva,'rcx, [rbx + 0x10]'],['Ability','get_owner',q.abilityOwnerAddressRva,q.abilityOwnerLockTailRva,'rcx, [rbx + 0x48]'],['Projectile','get_source',q.projectileSourceAddressRva,q.projectileSourceLockTailRva,'rcx, [rbx + 0xf0]'],['Projectile','get_traceTarget',q.projectileTraceAddressRva,q.projectileTraceLockTailRva,'rcx, [rbx + 0x110]']]){at(type,name,addressRva,args);at(type,name,tailRva,'0x18477cad0');}
 for(const name of ['nativeHotfixAndClassInitializationVerified','nativeConcretePointerLockDispatchVerified','liveTargetGettersVerified'])assert.equal(q[name],false);
});

test('action target source partitions the entire unwind region into decoded code and eleven checked RVA entries',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.actionTargets;
 const bytes=part=>{const raw=Buffer.from(part.base64,'base64');assert.equal(raw.length,part.endRva-part.beginRva);assert.equal(sha(raw),part.sha256);return raw;},region=bytes(q.region),code=bytes(q.code),table=bytes(q.jumpTable);
 assert.equal(code.length,532);assert.equal(table.length,44);assert.deepEqual(Buffer.concat([code,table]),region);assert.equal(q.region.unwindRva,0x7261558);
 assert.equal(q.code.instructions.reduce((n,i)=>n+i.size,0),532);assert.deepEqual(q.jumpTable.entries,Array.from({length:11},(_,i)=>table.readUInt32LE(i*4)));
 assert.ok(q.jumpTable.entries.every(entry=>q.code.instructions.some(i=>i.rva===entry)));assert.ok(q.code.instructions.some(i=>i.rva===0xced3c8&&i.operands==='ecx, dword ptr [rdx + rdi*4 + 0xced594]'));
 const at=(rva,mnemonic,operands)=>assert.ok(q.code.instructions.some(i=>i.rva===rva&&i.mnemonic===mnemonic&&i.operands===operands));
 at(0xced3b8,'cmp','edi, 0xa');at(0xced3bb,'ja','0x180ced57f');at(0xced3c1,'lea','rdx, [rip - 0xced3c8]');at(0xced3d2,'jmp','rcx');
 at(q.jumpTable.entries[0],'mov','rax, qword ptr [rbx + 8]');at(q.jumpTable.entries[1],'mov','rax, qword ptr [rbx]');at(q.jumpTable.entries[2],'mov','rcx, qword ptr [rbx + 0x10]');at(q.jumpTable.entries[3],'mov','rcx, qword ptr [rbx + 0x10]');
 at(q.jumpTable.entries[6],'mov','rax, qword ptr [rbx + 0xb8]');at(q.jumpTable.entries[7],'mov','rcx, qword ptr [rbx + 0xe8]');at(0xced4d0,'mov','rcx, qword ptr [rbx + 0xa8]');at(0xced51e,'mov','rcx, qword ptr [rbx + 0xa8]');at(0xced565,'mov','rcx, qword ptr [rbx + 0x18]');
 for(const name of ['nativeOwnerAndPointerEffectsVerified','nativeUnityEffectsVerified','nativeClassInitializationVerified','liveActionTargetsVerified'])assert.equal(q[name],false);
});

test('predicate node source binds entity validity, blackboard fallback and distinct flag/combo read ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.predicateNodes;
 assert.deepEqual(q.fields.CheckAbnormalFlag.map(f=>[f.name,f.offset]),[['_abnormalFlag',16],['_targetType',20],['_isUnset',24],['_abnormalFlagKey',32]]);
 assert.deepEqual(q.fields.CheckAbnormalCombo.map(f=>[f.name,f.offset]),[['_abnormalCombo',16],['_targetType',20],['_isUnset',24]]);
 assert.equal(q.targetTypes.fields.find(f=>f.name==='BUFF_OWNER').value,3);assert.ok(q.abnormalFlags.fields.some(f=>f.name==='LEVITATE'&&f.value===25));assert.ok(q.abnormalCombos.fields.some(f=>f.name==='SLEEPING'));
 assert.equal(q.targetResolver.definition.index,84019);assert.equal(q.targetResolver.definition.name,'GetActionTarget');assert.equal(q.targetResolver.entryRva,0xced380);assert.equal(q.targetResolver.bodyVerified,false);assert.equal(q.targetResolver.readerStatus,'Incomplete native chunk disassembly');
 assert.equal(c.methods.some(m=>m.entryRva===q.targetResolver.entryRva),false);
 const method=type=>c.methods.find(m=>m.type===type&&m.name==='Execute'),at=(type,rva,args)=>assert.ok(instructions(method(type)).some(i=>i.rva===rva&&i.operands===args));
 at('CheckAbnormalFlag',q.flagTargetReadRva,'edx, dword ptr [rbx + 0x14]');at('CheckAbnormalFlag',q.flagResolveCallRva,'0x180ced380');at('CheckAbnormalFlag',q.flagValidityCallRva,'0x185ebec60');
 at('CheckAbnormalFlag',q.flagKeyReadRva,'rcx, qword ptr [rbx + 0x20]');at('CheckAbnormalFlag',q.flagEmptyCallRva,'0x1850d34b0');at('CheckAbnormalFlag',q.flagFallbackReadRva,'r8d, dword ptr [rbx + 0x10]');at('CheckAbnormalFlag',q.flagCurrentKeyReadRva,'rdx, qword ptr [rbx + 0x20]');at('CheckAbnormalFlag',q.flagBlackboardReadRva,'0x182166990');
 at('CheckAbnormalFlag',q.flagInverseReadRva,'ebx, byte ptr [rbx + 0x18]');at('CheckAbnormalFlag',q.flagAttributesCallRva,'0x183a29330');at('CheckAbnormalFlag',q.flagQueryCallRva,'0x1839579e0');at('CheckAbnormalFlag',q.flagInvertRva,'al, bl');
 at('CheckAbnormalCombo',q.comboResolveCallRva,'0x180ced380');at('CheckAbnormalCombo',q.comboValidityCallRva,'0x185ebec60');at('CheckAbnormalCombo',q.comboInverseReadRva,'esi, byte ptr [rbx + 0x18]');at('CheckAbnormalCombo',q.comboAttributesCallRva,'0x183a29330');at('CheckAbnormalCombo',q.comboValueReadRva,'edx, dword ptr [rbx + 0x10]');at('CheckAbnormalCombo',q.comboQueryCallRva,'0x183957750');at('CheckAbnormalCombo',q.comboInvertRva,'al, sil');at('AlwaysNext',q.alwaysTrueRva,'al, 1');
 assert.ok(instructions(c.methods.find(m=>m.type==='AlwaysNext'&&m.name==='get_executeCondition')).some(i=>i.rva===q.alwaysConditionZeroRva&&i.operands==='eax, eax'));
 for(const name of ['nativeEntitySelectionVerified','nativeUnityAndBlackboardEffectsVerified','nativeAttributeQueryEffectsVerified','livePredicateNodeDispatchVerified'])assert.equal(q[name],false);
});

test('action utility source binds FROM_BUFF integer flags, node virtual slots and by-reference snapshot execution',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.actionUtil;
 assert.deepEqual(q.sourceTypes.fields.map(f=>[f.name,f.value]),[['NONE',0],['FROM_BUFF',1],['FROM_ABILITY',2],['FROM_PROJECTILE',4],['FROM_BATTLE_AVG',8],['FROM_ENVIRONMENT',16],['FROM_VALIDATOR',32],['ALL',63]]);
 assert.deepEqual(q.executeConditions.fields.map(f=>[f.name,f.value]),[['ALWAYS',0],['PREVIOUS_SUCCEED',1],['PREVIOUS_FAILED',2]]);
 assert.deepEqual(q.nodeSlots.map(m=>[m.name,m.virtualSlot]),[['get_allowedSource',4],['get_executeCondition',5],['Execute',6]]);
 assert.deepEqual(q.parameters.map(m=>[m.methodIndex,m.parameters.map(p=>p.name)]),[[89084,['nextAction','lastOneIsSucceed']],[89085,['actions','sourceType','blackboard','snapshot']],[89086,['actions','sourceType','blackboard']]]);
 assert.equal(q.parameters[1].parameters[1].typeData,12106);assert.equal(q.parameters[1].parameters[3].typeData,8956);assert.equal(q.parameters[1].parameters[3].typeBits,0x20110000);
 const empty=q.emptyCollection;assert.equal(empty.encodedUsage>>>29,6);assert.equal((empty.encodedUsage&0x1ffffffe)>>>1,258790);assert.equal(empty.concreteSpecification.nativeMapping,null);assert.equal(empty.canonicalSpecification.index,208287);assert.equal(empty.entryRva,0x3f62450);
 for(const chunk of empty.chunks){const bytes=Buffer.from(chunk.base64,'base64');assert.equal(bytes.length,chunk.endRva-chunk.beginRva);assert.equal(sha(bytes),chunk.sha256);}
 const method=index=>c.methods.find(m=>m.index===index&&m.type==='ActionUtil'),at=(index,rva,args)=>assert.ok(instructions(method(index)).some(i=>i.rva===rva&&i.operands===args));
 at(89084,q.conditionGetterCallRva,'rax');at(89086,q.runBattleReadCallRva,'0x1848f5cb0');at(89086,q.runContextReadCallRva,'0x183990ea0');at(89086,q.captureCallRva,'0x1839ed9a0');
 at(89086,q.captureFirstCopyRva,'xmmword ptr [rcx - 0x80], xmm0');at(89086,q.runIntoCallRva,'0x180e44890');at(89086,q.returnFirstCopyRva,'xmmword ptr [rbx], xmm0');
 at(89085,q.emptyCallRva,'0x183f62450');at(89085,q.countCallRva,'0x180005250');at(89085,q.nodeReadCallRva,'0x1800053d0');at(89085,q.allowedGetterCallRva,'r8');
 at(89085,q.sourceMaskAndRva,'eax, ebp');at(89085,q.sourceMaskCompareRva,'eax, ebp');at(89085,q.conditionCallRva,'0x180e43d80');at(89085,q.executeCallRva,'0x1800322d0');at(89085,q.resultReadRva,'r14d, al');
 at(89085,q.reportAllowedGetterCallRva,'0x1800057b0');at(89085,q.reportCallRva,'0x185a36870');
 const run=c.modeSwitch.buffNotification.newBuff.runActions;assert.equal(run.fromBuffSourceTypeRva,0x39b5586);assert.equal(Object.hasOwn(run,'instantTrueRva'),false);
 for(const name of ['nativeHotfixAndClassInitializationVerified','nativeCollectionAndVirtualDispatchVerified','nativeActionNodeEffectsVerified','liveActionUtilVerified'])assert.equal(q[name],false);
});

test('context value source binds complete Modifier and AttackInfo instance fields, closed references and primitive widths',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.contextStructLayouts;
 assert.deepEqual(q.layouts.map(t=>[t.typeIndex,t.name,t.width,t.boxedHeaderSize]),[[9524,'Modifier',136,16],[8913,'AttackInfo',40,16]]);
 assert.deepEqual(q.layouts[0].fields.map(f=>[f.name,f.unboxedOffset]),[['m_source',0],['m_target',16],['m_value',32],['ignoreForSp',40],['sharedFlagMask',44],['ignoreMissFlag',48],['ignoreCancelReasonMask',52],['realDelta',56],['extraData',64],['customKeys',72],['<targetType>k__BackingField',80],['<deltaType>k__BackingField',84],['<damageType>k__BackingField',88],['<applyWay>k__BackingField',92],['<cancelReason>k__BackingField',96],['<attackType>k__BackingField',100],['<elementType>k__BackingField',104],['<originAtk>k__BackingField',112],['<originValue>k__BackingField',120],['<playerSide>k__BackingField',128]]);
 assert.deepEqual(q.layouts[1].fields.map(f=>[f.name,f.unboxedOffset]),[['damageType',0],['originAtk',8],['atk',16],['atkScale',24],['atkAddition',32]]);
 for(const field of q.layouts.flatMap(t=>t.fields)){assert.equal(field.typeBits&16,0);assert.equal(field.offset-field.unboxedOffset,16);}
 assert.deepEqual(q.genericFields.map(f=>[f.field,f.definitionIndex,f.definitionName,f.argument.typeIndex,f.argument.name,f.argument.kind]),[['m_source',1324,'ObjectPtr`1',9044,'Entity',18],['m_target',1324,'ObjectPtr`1',9044,'Entity',18],['customKeys',38190,'List`1',36784,'String',14]]);
 for(const field of q.genericFields){assert.equal(Buffer.from(field.definitionTypeHex,'hex').length,16);assert.equal(Buffer.from(field.argument.typeHex,'hex').length,16);}
 assert.equal(q.enumTypes.length,10);assert.ok(q.enumTypes.every(t=>((t.underlyingField.typeBits>>>16)&255)===8));
 assert.deepEqual(q.fpType.instanceFields.map(f=>[f.name,f.offset,(f.typeBits>>>16)&255]),[['_serializedValue',16,10]]);
 const modifierField=name=>q.layouts[0].fields.find(f=>f.name===name),fpFields=[...['m_value','realDelta','extraData','<originAtk>k__BackingField','<originValue>k__BackingField'].map(modifierField),...q.layouts[1].fields.filter(f=>f.name!=='damageType')];
 assert.ok(fpFields.every(f=>f.typeData===34370&&((f.typeBits>>>16)&255)===17));assert.equal((modifierField('ignoreForSp').typeBits>>>16)&255,2);assert.equal((modifierField('sharedFlagMask').typeBits>>>16)&255,8);
 for(const name of ['nativePaddingAndByteEncodingVerified','nativeGcAndPointerAddressEffectsVerified','liveTypedContextValuesVerified'])assert.equal(q[name],false);
});

test('native fast-copy source binds reviewed field readers, typed branches, byte movement and write notification',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.managedArrayCopy,flow=q.fastCopyFlow;
 assert.deepEqual(flow.reviewedLeaves.map(m=>[m.name,m.entryRva]),[['length',0x7990],['valueType',0x428be0],['flagsBit2',0x428890],['unbox',0x388ec0],['elementSizeThunk',0x445270],['elementSize',0x4465f0]]);
 for(const body of [...flow.reviewedLeaves,flow.subclassProbe])for(const chunk of body.chunks){const bytes=Buffer.from(chunk.base64,'base64');assert.equal(bytes.length,chunk.endRva-chunk.beginRva);assert.equal(sha(bytes),chunk.sha256);}
 assert.deepEqual(flow.nativeClassFieldOffsets,{rank:0x12e,elementClass:0x40,typeBits:0x28,flags132:0x132,elementSize:0x100});assert.deepEqual(flow.nativeArrayFieldOffsets,{bounds:0x10,length:0x18,data:0x20});
 const at=(rva,args)=>assert.ok(instructions(q.fastCopy).some(i=>i.rva===rva&&i.operands===args));
 at(flow.destinationClassReadRva,'rax, qword ptr [r8]');at(flow.sourceClassReadRva,'r11, qword ptr [rcx]');at(flow.rankComparisonRva,'byte ptr [r11 + 0x12e], r10b');
 at(flow.sourceBoundsTestRva,'qword ptr [rcx + 0x10], 0');at(flow.destinationBoundsTestRva,'qword ptr [r8 + 0x10], 0');
 at(flow.destinationLengthCallRva,'0x180007990');at(flow.sourceLengthCallRva,'0x180007990');at(flow.sourceElementReadRva,'rbx, qword ptr [rax + 0x40]');at(flow.destinationElementReadRva,'rsi, qword ptr [rax + 0x40]');
 at(flow.boxedProbeCallRva,'0x1804aea10');at(flow.boxedZeroCallRva,'0x1804cab80');at(flow.boxedUnboxCallRva,'0x180388ec0');at(flow.boxedMoveCallRva,'0x1804cad40');at(flow.boxedNotifyCallRva,'0x180481270');
 at(flow.firstSubclassCallRva,'0x180428a40');at(flow.referenceCastCallRva,'0x1804aea10');at(flow.secondSubclassCallRva,'0x180428a40');
 at(flow.plainSizeCallRva,'0x180445270');at(flow.plainMoveCallRva,'0x1804cad40');at(flow.plainNotifyCallRva,'0x180481270');
 const leaf=name=>flow.reviewedLeaves.find(m=>m.name===name);
 assert.ok(instructions(leaf('length')).some(i=>i.operands==='eax, dword ptr [rcx + 0x18]'));
 assert.ok(instructions(leaf('valueType')).some(i=>i.mnemonic==='shr'&&i.operands==='eax, 0x1f'));
 assert.ok(instructions(leaf('flagsBit2')).some(i=>i.mnemonic==='shr'&&i.operands==='al, 2'));
 assert.ok(instructions(leaf('unbox')).some(i=>i.operands==='rax, [rcx + 0x10]'));
 assert.ok(instructions(leaf('elementSizeThunk')).some(i=>i.mnemonic==='jmp'&&i.operands==='0x1804465f0'));
 assert.ok(instructions(leaf('elementSize')).some(i=>i.operands==='eax, dword ptr [rcx + 0x100]'));
 for(const name of ['nativeSubclassAndCastEffectsVerified','nativeMemoryAndGcEffectsVerified','nativeExceptionConstructionVerified','liveFastCopyVerified'])assert.equal(flow[name],false);
});

test('managed Array.Copy source retains complete entry guards, native fast-copy body and bounded rank leaf',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.managedArrayCopy,
  method=c.methods.find(m=>m.index===q.method.index&&m.image===q.method.image);
 assert.equal(method.type,'Array');assert.equal(method.name,'Copy');assert.equal(method.parameterCount,5);assert.equal(method.entryRva,0x51ce8a0);
 for(const body of [method,q.rankReader,q.fastCopy])for(const chunk of body.chunks){const bytes=Buffer.from(chunk.base64,'base64');assert.equal(bytes.length,chunk.endRva-chunk.beginRva);assert.equal(sha(bytes),chunk.sha256);}
 assert.deepEqual(instructions(q.rankReader).map(i=>[i.mnemonic,i.operands]),[['mov','rax, qword ptr [rcx]'],['movzx','eax, byte ptr [rax + 0x12e]'],['ret','']]);
 assert.equal(q.rankReader.chunks[0].endRva-q.rankReader.chunks[0].beginRva,11);
 const at=(rva,args)=>assert.ok(instructions(method).some(i=>i.rva===rva&&i.operands===args));
 at(q.sourceNullTestRva,'rcx, rcx');at(q.destinationNullTestRva,'r8, r8');at(q.lengthTestRva,'r13d, r13d');
 at(q.sourceRankCallRva,'0x180489ae0');at(q.destinationRankCallRva,'0x180489ae0');at(q.rankComparisonRva,'ebx, eax');
 at(q.sourceIndexTestRva,'r15d, r15d');at(q.destinationIndexTestRva,'r14d, r14d');
 at(q.fastCopyCallRva,'0x1804892f0');at(q.fastCopyResultBranchRva,'0x1851cea98');at(q.fallbackFirstCallRva,'0x180489a90');
 assert.equal(q.fastCopy.entryRva,0x4892f0);assert.ok(instructions(q.fastCopy).some(i=>i.rva===0x489330&&i.operands==='qword ptr [rcx + 0x10], 0'));
 for(const name of ['nativeFastCopyEffectsVerified','nativeFallbackConversionAndExceptionEffectsVerified','nativeRuntimeArrayLayoutVerified','liveArrayCopyVerified'])assert.equal(q[name],false);
});

test('managed Array.Resize source binds Stack RGCTX slot7, four canonical wrappers and the five-argument Copy target',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.managedArrayResize;
 assert.deepEqual(q.canonicalMethods.map(m=>[m.index,m.entryRva]),[[205814,0x3e71cf0],[205813,0x3e70400],[205845,0x3e6bdf0],[205761,0x3e70660]]);
 for(const method of q.canonicalMethods){assert.equal(method.definition.index,216298);assert.equal(method.declaringType,'Array');assert.ok(method.nativeMapping);
  for(const chunk of method.chunks){const bytes=Buffer.from(chunk.base64,'base64');assert.equal(bytes.length,chunk.endRva-chunk.beginRva);assert.equal(sha(bytes),chunk.sha256);}
  const at=(offset,args)=>assert.ok(instructions(method).some(i=>i.rva===method.entryRva+offset&&i.operands===args));
  at(0x14,'edx, edx');at(0x21,'rbp, qword ptr [rcx]');at(0x29,'dword ptr [rbp + 0x18], edx');
  at(0x4b,'0x180410010');at(0x50,'edx, dword ptr [rbp + 0x18]');at(0x58,'edx, edi');at(0x73,'0x1851ce8a0');at(0x7b,'qword ptr [rsi], rbx');
 }
 const binding=q.stackGenericBinding;assert.deepEqual([binding.typeIndex,binding.token,binding.start,binding.length,binding.slot,binding.specificationIndex,binding.methodDefinition,binding.methodInstantiation],[38203,0x200061f,1444,8,7,205737,216298,5331]);
 assert.equal(Buffer.from(binding.entryHex,'hex').length,16);assert.equal(Buffer.from(binding.descriptorHex,'hex').length,12);
 assert.equal(q.copyTarget.definition.index,216439);assert.equal(q.copyTarget.entryRva,0x51ce8a0);assert.equal(q.copyTarget.bodyVerified,false);
 assert.deepEqual(q.copyTarget.parameters.map(p=>p.name),['sourceArray','sourceIndex','destinationArray','destinationIndex','length']);
 assert.deepEqual(q.copyTarget.parameters.map(p=>p.typeIndex),[36107,52803,36107,52803,52803]);
 for(const name of ['nativeClassInitializationAndAllocationVerified','nativeArrayCopyEffectsVerified','nativeConcreteGenericDispatchVerified','liveArrayResizeVerified'])assert.equal(q[name],false);
});

test('managed pointer stack source binds the nested ObjectPtr<Object> canonical signature and complete sixteen-byte storage bodies',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.managedPointerStack;
 assert.equal(q.valueWidth,16);assert.equal(q.classInstantiation,12499);assert.equal(q.nestedSignature.definitionIndex,1324);assert.equal(q.nestedSignature.name,'ObjectPtr`1');
 assert.equal((q.nestedSignature.typeBits>>>16)&255,21);assert.deepEqual([q.nestedSignature.argument.typeIndex,q.nestedSignature.argument.kind,q.nestedSignature.argument.name],[37078,28,'Object']);
 for(const hex of [q.nestedSignature.typeHex,q.nestedSignature.definitionTypeHex,q.nestedSignature.argument.typeHex])assert.equal(Buffer.from(hex,'hex').length,16);
 assert.deepEqual(q.canonicalMethods.map(m=>[m.index,m.definition.name,m.entryRva]),[[174542,'Peek',0x490a5c0],[174543,'Pop',0x490acc0],[174544,'Push',0x490b6c0],[174545,'PushWithResize',0x490b2a0]]);
 for(const method of q.canonicalMethods){assert.equal(method.classInstantiation,12499);assert.equal(method.methodInstantiation,-1);assert.ok(method.nativeMapping);
  for(const chunk of method.chunks){const bytes=Buffer.from(chunk.base64,'base64');assert.equal(bytes.length,chunk.endRva-chunk.beginRva);assert.equal(sha(bytes),chunk.sha256);}}
 const at=(entry,rva,args)=>assert.ok(instructions(q.canonicalMethods.find(m=>m.entryRva===entry)).some(i=>i.rva===rva&&i.operands===args));
 at(0x490acc0,q.popVersionRva,'dword ptr [rbx + 0x1c]');at(0x490acc0,q.popSizeRva,'dword ptr [rbx + 0x18], esi');
 at(0x490acc0,q.popCopyRva,'xmm0, xmmword ptr [rdi + rax*8]');at(0x490acc0,q.popClearRva,'xmmword ptr [rcx], xmm1');at(0x490acc0,q.popReturnCopyRva,'xmm0, xmmword ptr [rsp + 0x20]');
 at(0x490b6c0,q.pushTemporaryCopyRva,'xmmword ptr [rsp + 0x20], xmm0');at(0x490b6c0,q.pushResizeCallRva,'qword ptr [rax + 8]');
 at(0x490b2a0,q.resizeCallRva,'qword ptr [rax + 8]');at(0x490b2a0,q.resizeArrayReloadRva,'rcx, qword ptr [rbx + 0x10]');at(0x490b2a0,q.resizeSizeReloadRva,'rax, dword ptr [rbx + 0x18]');
 for(const name of ['nativeConcreteContextDispatchVerified','nativeArrayResizeVerified','nativeGcBarrierVerified','livePointerStackStorageVerified'])assert.equal(q[name],false);
});

test('managed value stack source binds Modifier clearing and AttackInfo copies to separate canonical bodies',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.managedValueStacks;
 assert.deepEqual(q.specializations.map(s=>[s.specialization,s.valueWidth,s.clearOnPop,s.canonicalMethods.map(m=>m.index)]),[
  ['Modifier',136,true,[174642,174643,174644,174645]],['AttackInfo',40,false,[174768,174769,174770,174771]]]);
 for(const method of [...q.specializations.flatMap(s=>s.canonicalMethods),q.modifierPeekArrayCopy])for(const chunk of method.chunks){const bytes=Buffer.from(chunk.base64,'base64');assert.equal(bytes.length,chunk.endRva-chunk.beginRva);assert.equal(sha(bytes),chunk.sha256);}
 const methods=q.specializations.flatMap(s=>s.canonicalMethods),find=entry=>methods.find(m=>m.entryRva===entry),
  at=(entry,rva,args)=>assert.ok(instructions(find(entry)).some(i=>i.rva===rva&&i.operands===args));
 at(0x490aa50,q.modifierPopVersionRva,'dword ptr [rdi + 0x1c]');at(0x490aa50,q.modifierPopSizeRva,'dword ptr [rdi + 0x18], ebp');
 at(0x490aa50,q.modifierPopCopyRva,'xmm0, xmmword ptr [rax + rsi + 0x20]');at(0x490aa50,q.modifierPopClearRva,'xmmword ptr [rcx], xmm0');
 at(0x490aa50,0x490aba3,'qword ptr [rcx + 0x80], xmm0');at(0x490aa50,0x490abb0,'xmm0, xmmword ptr [rsp + 0x20]');
 at(0x490a990,q.attackPopVersionRva,'dword ptr [rdi + 0x1c]');at(0x490a990,q.attackPopSizeRva,'dword ptr [rdi + 0x18], ebp');
 at(0x490a990,q.attackPopCopyRva,'xmm0, xmmword ptr [rsi + rax*8 + 0x20]');
 assert.ok(!instructions(find(0x490a990)).some(i=>i.mnemonic.startsWith('mov')&&i.operands.startsWith('xmmword ptr [rsi')));
 at(0x490b820,q.modifierPushResizeCallRva,'qword ptr [rax + 8]');at(0x490b790,q.attackPushResizeCallRva,'qword ptr [rax + 8]');
 at(0x490b000,0x490b04b,'qword ptr [rax + 8]');at(0x490b000,0x490b04e,'rcx, qword ptr [rbx + 0x10]');at(0x490b000,0x490b05b,'rax, dword ptr [rbx + 0x18]');
 at(0x490b340,0x490b387,'qword ptr [rax + 8]');at(0x490b340,0x490b38a,'rdx, qword ptr [rbx + 0x10]');at(0x490b340,0x490b393,'rax, dword ptr [rbx + 0x18]');
 assert.equal(q.modifierPeekArrayCopy.entryRva,0x1d5270);assert.ok(instructions(q.modifierPeekArrayCopy).some(i=>i.rva===0x1d527a&&i.operands==='rax, r8, 0x88'));
 for(const name of ['nativeTypedValueCopiesVerified','nativeArrayResizeVerified','nativePointerSpecializationVerified','liveValueStackStorageVerified'])assert.equal(q[name],false);
});

test('managed reference stack source retains complete canonical storage bodies and mutation ordering',()=>{
 const q=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.buffNotification.newBuff.managedReferenceStack;
 assert.deepEqual(q.canonicalMethods.map(m=>[m.index,m.definition.name,m.entryRva]),[[174660,'Peek',0x490a400],[174661,'Pop',0x490a6b0],[174662,'Push',0x490b650],[174663,'PushWithResize',0x490b470]]);
 for(const method of q.canonicalMethods)for(const chunk of method.chunks){const bytes=Buffer.from(chunk.base64,'base64');assert.equal(bytes.length,chunk.endRva-chunk.beginRva);assert.equal(sha(bytes),chunk.sha256);}
 const at=(entry,rva,args)=>assert.ok(instructions(q.canonicalMethods.find(m=>m.entryRva===entry)).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(q.nativeInstructionFieldOffsets,{_array:16,_size:24,_version:28});
 at(0x490a6b0,q.popVersionIncrementRva,'dword ptr [rdi + 0x1c]');at(0x490a6b0,q.popSizeWriteRva,'dword ptr [rdi + 0x18], esi');
 at(0x490a6b0,q.popValueReadRva,'rdi, qword ptr [rbx + rax*8 + 0x20]');at(0x490a6b0,q.popClearRva,'qword ptr [rcx], 0');
 at(0x490b470,0x490b495,'edx, 4');at(0x490b470,0x490b49f,'edx, edx');at(0x490b470,q.resizeCallRva,'qword ptr [rax + 8]');
 at(0x490b470,q.resizeArrayReloadRva,'rcx, qword ptr [rbx + 0x10]');at(0x490b470,q.resizeSizeReloadRva,'rax, dword ptr [rbx + 0x18]');
 for(const name of ['nativeArrayResizeVerified','nativeGcBarrierVerified','nativePointerAndValueSpecializationsVerified','liveContextStorageVerified'])assert.equal(q[name],false);
});

test('context stack source binds canonical pointer/value bodies and RGCTX Peek/Wrap/count/storage/lock methods',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.contextStackOperations;
 assert.deepEqual(q.canonicalMethods.map(m=>m.index),[24503,24504,24505,24506,24513,24514,24515,24509,24510,24511,24517,24518,24519]);
 for(const method of q.canonicalMethods){assert.ok(method.nativeMapping);for(const chunk of method.chunks){const bytes=Buffer.from(chunk.base64,'base64');assert.equal(bytes.length,chunk.endRva-chunk.beginRva);assert.equal(sha(bytes),chunk.sha256);}}
 const find=entry=>q.canonicalMethods.find(m=>m.entryRva===entry),at=(entry,rva,args)=>assert.ok(instructions(find(entry)).some(i=>i.rva===rva&&i.operands===args));
 const thunk=find(0x432a930);assert.equal(thunk.chunks[0].endRva-thunk.chunks[0].beginRva,22);
 assert.deepEqual(instructions(thunk).map(i=>[i.mnemonic,i.operands]),[['mov','rax, qword ptr [rdx + 0x20]'],['mov','rdx, qword ptr [rax + 0xc0]'],
  ['mov','rdx, qword ptr [rdx + 0x10]'],['mov','rax, qword ptr [rdx + 8]'],['jmp','rax']]);
 assert.deepEqual(q.genericContextBindings.map(b=>[b.typeIndex,b.length]),[[8957,10],[8958,6]]);
 assert.deepEqual(q.genericContextBindings[0].bindings.map(b=>[b.slot,b.declaringType,b.definition.name]),[[2,'ContextPtrStack`1','Peek'],[3,'ObjectPtr','Wrap'],[4,'Stack`1','Push'],[5,'Stack`1','get_Count'],[6,'Stack`1','Pop'],[7,'ObjectPtr`1','Lock'],[9,'Stack`1','Peek']]);
 assert.deepEqual(q.genericContextBindings[1].bindings.map(b=>[b.slot,b.declaringType,b.definition.name]),[[2,'ContextValueStack`1','Peek'],[3,'Stack`1','get_Count'],[4,'Stack`1','Pop'],[5,'Stack`1','Peek']]);
 for(const binding of q.genericContextBindings.flatMap(b=>b.bindings)){assert.equal(binding.kind,3);assert.equal(Buffer.from(binding.descriptorHex,'hex').length,12);assert.equal(Buffer.from(binding.entryHex,'hex').length,16);}
 at(0x4be7dd0,q.pointerPeekCountCallRva,'rax');at(0x4be7dd0,q.pointerPeekCountBranchRva,'0x184be7e0b');at(0x4be7dd0,q.pointerPeekStoredCallRva,'rax');
 at(0x4be7dd0,q.pointerPeekCopyRva,'xmmword ptr [rsp + 0x20], xmm0');at(0x4be7dd0,q.pointerPeekLockCallRva,'0x18477cad0');
 at(0x4be7e60,q.pointerPopCountCallRva,'rax');at(0x4be7e60,q.pointerPopCountBranchRva,'0x184be7e9b');at(0x4be7e60,q.pointerPopStoredCallRva,'rax');
 at(0x4be7e60,q.pointerPopCopyRva,'xmmword ptr [rsp + 0x20], xmm0');at(0x4be7e60,q.pointerPopLockCallRva,'0x18477cad0');
 at(0x4be7ef0,q.pointerWrapCallRva,'rax');at(0x4be7ef0,q.pointerPushReceiverTestRva,'rdi, rdi');at(0x4be7ef0,q.pointerPushCopyRva,'xmmword ptr [rsp + 0x20], xmm0');at(0x4be7ef0,q.pointerPushStoredCallRva,'qword ptr [rax + 8]');
 for(const [entry,rva]of [[0x4be8130,q.referencePeekCountBranchRva],[0x4be81a0,q.referencePopCountBranchRva],[0x4be8020,q.modifierPeekCountBranchRva],[0x4be8210,q.modifierPopCountBranchRva]])assert.equal(instructions(find(entry)).find(i=>i.rva===rva).mnemonic,'jg');
 assert.equal(q.nativeConcreteGenericContextVerified,false);assert.equal(q.nativeUnderlyingStackStorageVerified,false);assert.equal(q.nativeValueDefaultsAndCopiesVerified,false);assert.equal(q.liveContextStackOperationsVerified,false);
});

test('native admission source binds signed Int16 counters, combo fallback and Enemy raw-WALK levitation',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff.admissionGates;
 const anti=castMethod(c,'BuffContainer','_CheckThroughBuffAbnormalAnti'),levitate=castMethod(c,'BuffContainer','_CheckThroughLevitateBuffCondition'),status=castMethod(c,'BuffContainer','_CheckThroughBuffStatusResistableAnti');
 const flagQuery=castMethod(c,'Attributes','GetAbnormalFlag'),antiQuery=castMethod(c,'Attributes','GetAbnormalAnti');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(q.enemyTypeLoad.name,'Enemy');assert.equal(q.enemyTypeLoad.encodedUsage>>>29,1);
 assert.deepEqual(q.flags.map(f=>[f.name,f.value]),[['LEVITATE',25],['ANTI_STATUS_RESISTABLE',30],['FORCE_LEVITATE',36]]);
 assert.deepEqual(q.counterFields.map(f=>[f.name,f.offset,f.elementKind]),[['m_abnormalFlagsCounter',0x20,6],['m_abnormalImmuneCounter',0x28,6],['m_abnormalAntiCounter',0x30,6]]);
 for(const field of q.counterFields){assert.equal((field.typeBits>>>16)&255,29);assert.equal(Buffer.from(field.elementTypeHex,'hex').length,16);}
 assert.equal(q.comboField.name,'m_abnormalComboMgr');assert.equal(q.comboField.offset,0x38);assert.equal(q.comboType.name,'AbnormalComboManager');
 assert.equal(q.comboMaskField.name,'m_abnormalFlagMask');assert.equal(q.comboMaskField.offset,0x28);assert.equal((q.comboMaskField.typeBits>>>16)&255,10);
 const combo=castMethod(c,'AbnormalComboManager','GetAbnormalFlag');at(combo,q.comboMaskReadRva,'rbx, qword ptr [rbx + 0x28]');
 at(combo,q.comboMaskShiftRva,'rdx, cl');at(combo,q.comboMaskTestRva,'rbx, rdx');at(combo,q.comboSignedPositiveRva,'al');
 assert.equal(q.rawMotionField.name,'m_changeableMotionMode');assert.equal(q.rawMotionField.offset,0x94);assert.equal(q.motionEnum.fields.find(f=>f.name==='WALK').value,0);
 at(anti,q.antiEmptyCallRva,'0x183f62450');at(anti,q.antiGetEnumeratorCallRva,'0x18458dc20');at(anti,q.antiMoveNextCallRva,'0x184dd9f70');
 at(anti,q.antiCurrentReadRva,'edi, dword ptr [rsp + 0x50]');at(anti,q.antiOwnerAttributesCallRva,'0x1839d8080');at(anti,q.antiQueryCallRva,'0x1839576e0');
 for(const rva of [q.antiRejectDisposeCallRva,q.antiExhaustedDisposeCallRva,q.antiExceptionDisposeCallRva])at(anti,rva,'0x180511a50');
 at(levitate,q.levitateEmptyCallRva,'0x183f62450');at(levitate,q.levitateContainsCallRva,'0x183f5f300');at(levitate,q.levitateOwnerSelectRva,'rbx, rsi');
 at(levitate,q.levitateNullCallRva,'0x185ebec60');at(levitate,q.rawMotionCallRva,'0x183a2ee10');at(levitate,q.alreadyLevitateCallRva,'0x183a2cf50');at(levitate,q.forceLevitateTailRva,'0x183f5f300');
 at(status,q.statusResistableCallRva,'0x1839b6bc0');at(status,q.statusOwnerAttributesCallRva,'0x1839d8080');at(status,q.statusAntiQueryCallRva,'0x1839579e0');
 at(flagQuery,q.flagImmuneArrayReadRva,'rcx, qword ptr [rbx + 0x28]');at(flagQuery,q.flagImmuneCountCompareRva,'word ptr [rcx + rax*2 + 0x20], 0');
 at(flagQuery,q.flagActiveArrayReadRva,'rcx, qword ptr [rbx + 0x20]');at(flagQuery,q.flagActiveCountCompareRva,'word ptr [rcx + rax*2 + 0x20], 0');
 at(flagQuery,q.flagComboReadRva,'rcx, qword ptr [rbx + 0x38]');at(flagQuery,q.flagComboTailRva,'0x183995ef0');
 at(antiQuery,q.antiCounterReadRva,'rbx, qword ptr [rbx + 0x30]');at(antiQuery,q.antiCounterCompareRva,'word ptr [rbx + rax*2 + 0x20], 0');
 assert.ok(castMethod(c,'AbnormalComboManager','GetAbnormalFlag'));assert.ok(castMethod(c,'Entity','get_rawChangeableMotionMode'));assert.ok(castMethod(c,'Entity','get_isLevitate'));
 assert.equal(q.nativeFlagEnumerationVerified,false);assert.equal(q.nativeComboEffectsVerified,false);assert.equal(q.liveAdmissionGatesVerified,false);
});

test('NewBuff source binds cleanup, pool/reset, pre-activation registration and post-activation override ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.newBuff,m=castMethod(c,'BuffContainer','NewBuff');
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args),`${rva.toString(16)} ${args}`);
 assert.deepEqual(q.parameters.map(p=>p.name),['input','source','ability','extraBlackboard','extraBlackboard2','sourceProjectile','customOverrideEffectKey']);
 assert.deepEqual(q.containerFields.map(f=>[f.name,f.offset]),[['m_buffs',0x18],['m_buffUidMap',0x28]]);
 assert.equal(q.ownerInitedField.name,'<inited>k__BackingField');assert.equal(q.ownerInitedField.offset,0x24);assert.equal(q.startedField.name,'m_started');assert.equal(q.startedField.offset,0x1e8);
 assert.equal(q.groupQueueField.name,'m_queue');assert.equal(q.groupQueueField.offset,0x10);
 assert.deepEqual(q.flags.map(f=>[f.name,f.value]),[['ANTI_STATUS_RESISTABLE',30],['BUFF_ADD_CAN_BE_CANCELED_IF_DEFENSE',37],['DEFENSE_BUFF_ADD_IF_CANCELABLE_BUFF',38]]);
 for(const [rva,target] of [[q.cleanupCallRva,'0x1839d6870'],[q.abnormalAntiCallRva,'0x1839d6cc0'],[q.levitateCallRva,'0x1839d6f60'],
  [q.allocateCallRva,'0x18477b480'],[q.resetCallRva,'0x1839b0d60'],[q.overrideEffectCallRva,'0x1839b0cb0'],[q.recycleCallRva,'0x18477b630'],
  [q.pointerCaptureCallRva,'0x18477cf00'],[q.uidAddCallRva,'0x184c0b0d0'],[q.onStartCallRva,'0x1839b0120'],[q.abnormalAntiMaskCallRva,'0x1839b6260'],
  [q.filterAbnormalAntiCallRva,'0x1839d77e0'],[q.finishedCallRva,'0x1839b6b00'],[q.finishedRemoveCallRva,'0x1839d7a50'],
  [q.directEnableCallRva,'0x1839b7e80'],[q.ensureGroupCallRva,'0x1839c01b0'],[q.groupAddCallRva,'0x1839df310'],[q.groupUpdateCallRva,'0x1839df770']])at(rva,target);
 at(q.sourceFlagInputRva,'edx, [r8 + 0x25]');at(q.ownerFlagInputRva,'edx, [r8 + 0x26]');at(q.statusAntiInputRva,'edx, [r8 + 0x1e]');
 at(q.configSnapshotReadRva,'xmm0, xmmword ptr [rbp]');at(q.listReadRva,'rdi, qword ptr [rsi + 0x18]');at(q.listVirtualAddCallRva,'qword ptr [rax + 0x198]');
 at(q.uidMapReadRva,'rdi, qword ptr [rsi + 0x28]');at(q.ownerInitedReadRva,'byte ptr [rax + 0x24], 0');at(q.startedReadRva,'byte ptr [rbx + 0x1e8], 0');
 at(q.groupQueueReadRva,'rcx, qword ptr [rbp + 0x10]');at(q.groupQueueItemReadRva,'rcx, qword ptr [rbp + 0x10]');at(q.groupIdentityCompareRva,'rax, rbx');
 assert.ok(q.listVirtualAddCallRva<q.uidAddCallRva&&q.uidAddCallRva<q.onStartCallRva&&q.onStartCallRva<q.filterAbnormalAntiCallRva&&q.filterAbnormalAntiCallRva<q.finishedCallRva&&q.finishedCallRva<q.ensureGroupCallRva);
 assert.deepEqual(q.methodSpecifications.map(x=>x.specification.definition.name),['Allocate','Recycle','op_Implicit','Add']);
 assert.ok(q.methodSpecifications.every(x=>x.encodedUsage>>>29===6&&x.specification.nativeMapping===null));
 assert.equal(q.canonicalImplicitPointer.entryRva,0x477cf00);assert.equal(q.canonicalImplicitPointer.definition.name,'op_Implicit');
 for(const ch of q.canonicalImplicitPointer.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.equal(sha(readFileSync(new URL('../'+q.activationEvidence.path,import.meta.url))),q.activationEvidence.sha256);assert.equal(q.activationEvidence.entryRva,0x39b0120);
 assert.ok(castMethod(c,'BuffContainer','EnsureOverrideGroup'));assert.ok(castMethod(c,'Buff','OverrideEffectKey'));assert.ok(castMethod(c,'Buff','set_isEnabled'));
 for(const key of ['nativeAntiAndLevitateEffectsVerified','nativeRegistrationEffectsVerified','nativeOverrideGroupEffectsVerified','liveNewBuffPhaseVerified'])assert.equal(q[key],false);
});

test('Reset context pointers bind Wrap specializations to the retained UID constructor and Unity validity branches',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetContext.contextPointers,p=c.modeSwitch.buffNotification.pointer;
 const ctor=p.canonicalMethods.find(m=>m.definition.name==='.ctor'),valid=p.canonicalMethods.find(m=>m.definition.name==='get_isValid'),lock=p.canonicalMethods.find(m=>m.definition.name==='Lock');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.equal(q.canonicalWrap.definition.name,'Wrap');assert.equal(q.canonicalWrap.instantiations.method.arguments[0].name,'Object');assert.equal(q.canonicalWrap.entryRva,0x4035830);
 at(q.canonicalWrap,q.wrapClearRva,'xmmword ptr [rcx], xmm0');at(q.canonicalWrap,q.wrapConstructorCallRva,'0x18477cc20');
 for(const ch of q.canonicalWrap.chunks){const raw=Buffer.from(ch.base64,'base64');assert.equal(sha(raw),ch.sha256);assert.equal(raw.length,ch.endRva-ch.beginRva);}
 assert.deepEqual(q.concreteWrapLoads.map(x=>[x.loadRva,x.specification.index,x.specification.instantiations.method.arguments[0].name]),[
  [0x39b11dc,269317,'Entity'],[0x39b1203,269312,'Ability'],[0x39b122f,269319,'Projectile']]);
 for(const load of q.concreteWrapLoads){assert.equal(load.encodedUsage>>>29,6);assert.equal(load.specification.nativeMapping,null);assert.equal(load.specification.definition.index,q.canonicalWrap.definition.index);
  assert.ok(load.lineage.some(t=>t.name==='Object'&&t.namespace==='UnityEngine'));}
 assert.equal(q.uidInterface.name,'IPtrObject');assert.equal(q.uidInterface.getter.name,'get_instanceUid');assert.equal(q.uidInterface.slot,0);
 assert.equal(q.uidInterfaceLoads.length,3);assert.ok(q.uidInterfaceLoads.every(x=>x.encodedUsage>>>29===1));
 at(ctor,q.constructorFirstUidCallRva,'0x180005250');at(ctor,q.constructorObjectWriteRva,'qword ptr [rdi], rbx');
 at(ctor,q.constructorNullCheckCallRva,'0x185a445f0');at(ctor,q.constructorDestroyedUidWriteRva,'dword ptr [rdi + 8], eax');
 at(ctor,q.constructorSecondUidCallRva,'0x180005250');at(ctor,q.constructorUidWriteRva,'dword ptr [rdi + 8], eax');
 at(valid,q.validityObjectReadRva,'rdi, qword ptr [rbx]');at(valid,q.validityNullCheckCallRva,'0x185a445f0');
 at(valid,q.validityObjectRereadRva,'r8, qword ptr [rbx]');at(valid,q.validityUidCallRva,'0x180005250');at(valid,q.validityCachedUidCompareRva,'eax, dword ptr [rbx + 8]');
 at(lock,q.lockValidityCallRva,'0x1800b9be0');at(lock,q.lockObjectRereadRva,'rax, qword ptr [rbx]');
 assert.equal(q.nativeUnityDestructionEffectsVerified,false);assert.equal(q.nativeContextUidDispatchVerified,false);assert.equal(q.liveContextPointersVerified,false);
});

test('Reset override source binds exact separators, independent card UID keys and container migration ordering',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetOverride;
 const reset=castMethod(c,'Buff','Reset'),key=castMethod(c,'BuffData','GetOverrideKey');
 const at=(m,rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(q.dataFields.map(f=>[f.name,f.offset]),[['disableOverride',0x30],['overrideKey',0x38],['buffKey',0x18],['independentCharacterSource',0x50]]);
 assert.deepEqual(q.literals.map(x=>x.value),['{0}{1}','{0}{1}','^']);assert.ok(q.literals.every(x=>x.encodedUsage>>>29===5));
 assert.equal(q.emptyStringTypeLoad.name,'String');assert.equal(q.emptyStringTypeLoad.field.name,'Empty');assert.equal(q.emptyStringTypeLoad.field.offset,0);
 at(key,q.disableReadRva,'byte ptr [rbx + 0x30], cl');at(key,q.keyEmptyTestCallRva,'0x1850d34b0');at(key,q.keyFallbackReadRva,'rax, qword ptr [rbx + 0x18]');
 at(reset,q.independentFlagReadRva,'byte ptr [rcx + 0x50], bpl');at(reset,q.sharedKeyCallRva,'0x18225d010');
 assert.equal(q.characterType.name,'Character');at(reset,q.characterSourceSelectionRva,'rbp, r15');at(reset,q.independentKeyCallRva,'0x18225d010');
 at(reset,q.baseFormatCallRva,'0x181c5ab80');at(reset,q.characterNullTestCallRva,'0x185ebec60');at(reset,q.cardUidCallRva,'0x1807fa6b0');
 at(reset,q.cardFormatCallRva,'0x181c5a9d0');at(reset,q.independentSetterCallRva,'0x1839b80d0');at(reset,q.independentGetterCallRva,'0x1839b6f70');
 at(reset,q.ensureIndependentCallRva,'0x1839c05d0');at(reset,q.candidateCallRva,'0x1839c1b40');at(reset,q.sharedKeySetterCallRva,'0x1839b80d0');
 const candidate=castMethod(c,'BuffContainer','GetOverrideKeyCandidate'),ensure=castMethod(c,'BuffContainer','EnsureOverrideIndependentKey');
 at(candidate,q.candidateStartsWithCallRva,'0x1850d7940');for(const rva of [q.candidateFoundDisposeCallRva,q.candidateExhaustedDisposeCallRva,q.candidateExceptionDisposeCallRva])at(candidate,rva,'0x180511a50');
 for(const [rva,target] of [[q.ensureTryGetCallRva,'0x184c0e320'],[q.ensureContainsCallRva,'0x184c0b160'],[q.ensureRemoveCallRva,'0x184cdd5f0'],[q.ensureAddCallRva,'0x184c0b0d0']])at(ensure,rva,target);
 const bindings=q.containerBindings;assert.equal(bindings.mapField.name,'m_buffOverrideMap');assert.equal(bindings.mapField.offset,0x20);
 assert.deepEqual(bindings.methodSpecifications.map(x=>x.specification.definition.name),['get_Keys','GetEnumerator','MoveNext','Dispose','TryGetValue','ContainsKey','Remove','Add']);
 for(const binding of bindings.methodSpecifications){assert.equal(binding.encodedUsage>>>29,6);assert.equal(binding.specification.nativeMapping,null);
  assert.deepEqual(binding.specification.instantiations.class.arguments.map(a=>a.name),['String','OverrideGroup']);}
 at(candidate,bindings.mapReadRvas[0],'rcx, qword ptr [rbx + 0x20]');for(const rva of bindings.mapReadRvas.slice(1))at(ensure,rva,'rcx, qword ptr [rbx + 0x20]');
 assert.equal(bindings.genericDictionaryEffectsVerified,false);assert.equal(bindings.nativeKeyEnumerationVerified,false);assert.equal(bindings.liveOverrideContainerVerified,false);
 assert.ok(c.methods.some(m=>m.type==='HGString'&&m.entryRva===0x1c5ab80));assert.ok(c.methods.some(m=>m.type==='HGString'&&m.entryRva===0x1c5a9d0));assert.ok(castMethod(c,'Character','get_cardUid'));
 assert.equal(q.nativeFormattingEffectsVerified,false);assert.equal(q.nativeOverrideContainerEffectsVerified,false);assert.equal(q.liveResetOverridePhaseVerified,false);
});

test('Reset pipeline source binds stack initialization, config value snapshot and final phase order',()=>{
 const c=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),q=c.modeSwitch.buffNotification.resetPipeline,m=castMethod(c,'Buff','Reset');
 const at=(rva,args)=>assert.ok(instructions(m).some(i=>i.rva===rva&&i.operands===args));
 assert.deepEqual(q.stackFields.map(f=>[f.name,f.offset]),[['m_stackCnt',0x8c],['m_refreshRemainingTimeWhenStackMax',0x94],['m_clearAllStackCntWhenTimeUp',0x95],['<priority>k__BackingField',0x20c]]);
 assert.equal(q.templateActionsField.name,'eventToActions');assert.equal(q.templateActionsField.offset,0x28);
 at(q.stackDataReadRva,'rdx, qword ptr [r14 + 8]');at(q.stackCountWriteRva,'dword ptr [rsi + 0x8c], 1');
 at(q.refreshStackWriteRva,'byte ptr [rsi + 0x94], al');at(q.clearStacksWriteRva,'byte ptr [rsi + 0x95], al');at(q.loadAttributesCallRva,'0x1839b4460');
 at(q.templateReadRva,'rdx, qword ptr [r14]');at(q.templateActionsReadRva,'rdx, qword ptr [rdx + 0x28]');at(q.loadActionsCallRva,'0x1839b4250');
 at(q.configSnapshotReadRva,'xmm0, xmmword ptr [r14]');at(q.configSnapshotWriteRva,'xmmword ptr [rsp + 0x70], xmm0');at(q.calculatePriorityCallRva,'0x1839b3140');
 at(q.priorityWriteRva,'dword ptr [rsi + 0x20c], ebx');at(q.statusInitCallRva,'0x1839b3da0');at(q.statusWriteRva,'byte ptr [rsi + 0x1e5], al');
 at(q.slowdownWriteRva,'byte ptr [rsi + 0x1e6], al');at(q.elementalBreakCallRva,'0x1839b3ad0');at(q.elementalBreakWriteRva,'byte ptr [rsi + 0x1f0], al');at(q.shieldSourceCallRva,'0x1839b3fa0');
 assert.ok(q.loadAttributesCallRva<q.loadActionsCallRva&&q.loadActionsCallRva<q.calculatePriorityCallRva&&q.priorityWriteRva<q.statusInitCallRva&&q.statusInitCallRva<q.elementalBreakCallRva&&q.elementalBreakCallRva<q.shieldSourceCallRva);
 assert.equal(q.fullResetEffectsVerified,false);assert.equal(q.liveResetPipelineVerified,false);
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
 for(const rva of q.pointerWrapCalls)at(reset,rva,'0x184035830');
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
