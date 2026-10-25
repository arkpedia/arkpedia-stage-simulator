// SPDX-License-Identifier: GPL-3.0-or-later
import contract from '../../../data/candidates/arkpedia-ch17-mutwin-lifecycle-contract.json' with {type:'json'};
import {currentFatalDamageReceipt} from '../damage.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),registries=new WeakMap();
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;},roomActions=freeze(structuredClone(contract.roomFinish));
function registryFor(b){
 let registry=registries.get(b);if(registry)return registry;
 registry={states:new Map(),sync(){
  for(const state of [...registry.states.values()]){
   if(!state.valid()||state.phase!=='fake')continue;
   const partner=registry.states.get(state.partnerKey),eligible=partner?.valid()&&partner.phase==='active';
   if(state.partner&&(!eligible||state.partner.owner!==partner||state.partner.life!==partner.ownerLife))state.detachPartner(state.partner,true);
   if(eligible&&state.valid()&&state.phase==='fake'&&!state.partner)state.attachPartner(partner);
  }
 }};registries.set(b,registry);return registry;
}
export function installChapter17MutwinLifecycle(b,e,{actions,finishRoom}={}){
 const proof=contract.enemies[e?.defId],r=e?.def?.raw;
 if(!proof||r?.key!==e.defId||r.prefabKey!==e.defId||!same(r.talents,proof.record.talents)||!same(r.skills,proof.record.skills)||!same(r.abilities,proof.record.abilities))throw Error('Unreviewed twin lifecycle contract');
 if(proof.camera&&typeof finishRoom!=='function')throw Error('The first twin requires a canonical room/branch receiver');
 if(!actions?.active||!actions.combat?.valid()||e.mem.ch17MuamaActions!==actions||Math.abs(e.deployedAt-b.time)>1e-9)throw Error('Twin lifecycle requires fresh matching action composition');
 const life=e.deploySeq,old=e.mem.ch17MutwinLifecycle;if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one twin lifecycle');if(old?.active)old.stop();
 let registry=registryFor(b);const existing=registry.states.get(e.defId);if(existing?.valid())throw Error('Multiple copies of one twin require an aura override review');if(existing?.active)existing.stop();registry=registryFor(b);
 const d=proof.defaults,handles=[],seen=new WeakSet(),combat=actions.combat,line=actions.line,blink=actions.blink,originalBlinkEnabled=blink.enabled;
 const flags={invulnerable:true,untargetable:true,unblockable:true,noMove:true,disarm:true};
 const state={active:true,owner:e,ownerLife:life,partnerKey:d.partner,phase:'active',partner:null,hold:null,heal:null,camera:null,roomCommitted:false,rebornUntil:null,rebirths:0,
  valid:()=>state.active&&!b.finished&&e.alive&&e.deployed&&e.deploySeq===life&&e.mem.ch17MuamaActions===actions&&actions.active&&line.active&&blink.active&&combat.valid(),
  room(){
   if(!proof.camera||state.roomCommitted||!state.active||b.finished||e.deploySeq!==life)return;
   state.roomCommitted=true;finishRoom(Object.freeze({source:e,sourceLife:life,room:d.room,actions:roomActions}));
  },
  detachPartner(q=state.partner,finish=false){
   if(!q?.active)return;q.active=false;if(state.partner===q)state.partner=null;
   b.removeBuff(q.owner.owner,q.mark);b.removeBuff(e,q.child);
   if(finish&&state.valid()&&state.phase==='fake')state.forceDeath();
  },
  attachPartner(owner){
   if(!state.valid()||state.phase!=='fake'||state.partner||!owner.valid()||owner.phase!=='active')return;
   const q={active:true,owner,life:owner.ownerLife,mark:null,child:null};state.partner=q;
   q.mark=b.addBuff(owner.owner,{key:'enemy_mutin_mark_alive',source:e,persist:true,
    admit:()=>state.valid()&&state.phase==='fake'&&state.partner===q&&owner.valid()&&owner.phase==='active',onRemove:()=>state.detachPartner(q,true)});
   if(!q.mark||!state.valid()||state.partner!==q){state.detachPartner(q,false);b.removeBuff(owner.owner,q.mark);return;}
   q.child=b.addBuff(e,{key:'ally_alive',source:e,persist:true,admit:()=>state.valid()&&state.partner===q&&q.active});
   if(!state.valid()||state.partner!==q){b.removeBuff(e,q.child);state.detachPartner(q,false);}
  },
  stop(){
   if(!state.active)return;state.active=false;state.phase='retired';state.detachPartner();
   if(registry.states.get(e.defId)===state)registry.states.delete(e.defId);
   const hold=state.hold,heal=state.heal;state.hold=null;state.heal=null;b.removeBuff(e,hold);b.removeBuff(e,heal);b.removeBuff(e,state.camera);state.camera=null;
   if(combat.actionBusy===state)combat.actionBusy=null;
   if(e.deploySeq===life&&e.mem.ch17MuamaActions===actions){combat.suspended=false;if(blink.active)blink.enabled=originalBlinkEnabled;}
   for(const h of handles)b.off(h);if(e.mem.ch17MutwinLifecycle===state)delete e.mem.ch17MutwinLifecycle;
   registry.sync();if(!registry.states.size&&registries.get(b)===registry)registries.delete(b);
  },
  forceDeath(){
   if(!state.valid()||state.phase==='dying')return;state.phase='dying';state.detachPartner();
   // Source InstantKill explicitly skips rebirth; the shared scripted kill
   // path bypasses this controller's authenticated fatal HP-loss entry.
   b.kill(e,e);if(state.active)state.stop();
  },
  beginReborn(){
   if(!state.valid()||!['active','fake'].includes(state.phase))return;
   state.phase='reborn';state.rebirths++;state.rebornUntil=b.time+d.rebornDuration;e.hp=Math.min(1,e.s.maxHp);state.detachPartner();
   const previousHeal=state.heal;state.heal=null;b.removeBuff(e,previousHeal);
   combat.interrupt();line.interrupt();blink.finish();blink.enabled=false;combat.suspended=true;combat.actionBusy=state;
   let hold;hold=b.addBuff(e,{key:'ch17:mutwin-reborn',source:e,persist:true,flags:{...flags,undeadable:true},data:{nativeModeHold:true},admit:()=>state.valid()&&state.phase==='reborn',onRemove:()=>{if(state.hold===hold)state.stop();}});state.hold=hold;
   if(!hold||!state.valid()){b.removeBuff(e,hold);if(state.valid())state.forceDeath();return;}b._unblock(e);
   combat.releasePassivesExcept(d.retainedKeys);
   const retained=new Set(d.retainedKeys);for(const buff of [...e.buffs]){
    if(!state.valid())return;if(buff!==hold&&!retained.has(buff.key)&&buff.data?.nativeDurable!==true)b.removeBuff(e,buff);
   }
   if(!state.valid())return;
   registry.sync();b.emit('ch17MutwinRebornStarted',{source:e,sourceLife:life,count:state.rebirths});
  },
  enterFake(){
   if(!state.valid()||state.phase!=='reborn')return;
   const hold=state.hold;state.hold=null;state.phase='fake';e.hp=e.s.maxHp*d.rebornRatio;b.removeBuff(e,hold);combat.suspended=false;
   combat.cooldown=0;for(const skill of proof.record.skills)if(skill.prefabKey==='Blink')blink.cooldown=skill.initCooldown;else line.cooldowns[skill.prefabKey]=skill.initCooldown;
   let heal;heal=b.addBuff(e,{key:'enemy_mutiwin_t[heal]',source:e,persist:true,flags:{...flags},data:{nativeModeHold:true},sourceStatusResistable:false,interval:d.interval,
    admit:()=>state.valid()&&state.phase==='fake',onTick:()=>state.pulse(),onRemove:()=>{if(state.heal===heal)state.stop();}});state.heal=heal;
   if(!heal||!state.valid()||state.phase!=='fake'){b.removeBuff(e,heal);if(state.valid()&&state.phase==='fake')state.forceDeath();return;}
   registry.sync();b.emit('ch17MutwinFakeDeathStarted',{source:e,sourceLife:life});
  },
  pulse(){
   if(!state.valid()||state.phase!=='fake')return;
   // Native CheckContainsBuff explicitly disables source checking. Cleanup
   // still owns exact derived instances; this condition uses the literal key.
   if(!e.findBuff('ally_alive')){state.forceDeath();return;}
   b.heal(e,e,e.s.maxHp*d.healRatio,{self:true});
   if(!state.valid()||state.phase!=='fake')return;
   if(e.hp+1e-9>=e.s.maxHp*d.resumeRatio){
    state.phase='active';const heal=state.heal;state.heal=null;b.removeBuff(e,heal);state.detachPartner();
    if(combat.actionBusy===state)combat.actionBusy=null;blink.enabled=true;registry.sync();
    b.emit('ch17MutwinRecovered',{source:e,sourceLife:life});
   }
  },
 };
 e.mem.ch17MutwinLifecycle=state;registry.states.set(e.defId,state);
 try{
  handles.push(b.on('fatal',ctx=>{
   const receipt=currentFatalDamageReceipt(ctx,b);if(!receipt||receipt.unit!==e||receipt.unitLife!==life||ctx.prevented||!state.valid()||!['active','fake'].includes(state.phase)||seen.has(receipt))return;
   seen.add(receipt);ctx.prevented=true;ctx.afterHpLoss=()=>state.beginReborn();
  },{owner:state,priority:100}),b.on('tick',()=>{
   if(!state.valid()){state.stop();return;}
   if(state.phase==='reborn'&&b.time+1e-9>=state.rebornUntil)state.enterFake();registry.sync();
  },{owner:state,priority:200}),b.on('death',({unit})=>{if(unit!==e||e.deploySeq!==life)return;try{state.room();}finally{state.stop();}},{owner:state,priority:200}),
  b.on('battleEnd',()=>state.stop(),{owner:state}));
  if(proof.camera){let camera;camera=b.addBuff(e,{key:proof.camera.buffKey,source:e,persist:true,admit:()=>state.valid(),onRemove:()=>{if(state.camera===camera)state.room();}});state.camera=camera;
   if(!camera||!state.valid()){b.removeBuff(e,camera);throw Error('Twin room-finish parent admission failed');}}
  registry.sync();return state;
 }catch(error){state.stop();throw error;}
}
