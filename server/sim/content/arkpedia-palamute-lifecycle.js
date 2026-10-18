// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source lifecycle. Owner/birth/ordinary attacks and public art are separate.
import clocks from '../../../data/arkpedia-recon-clocks.json' with {type:'json'};
import {RECON_ID as ID,PALAMUTE_ID as TOKEN,selectedReconBuild,reconNativeInputs,reconSourceComponent} from './arkpedia-recon-source.js';
import {selectedPalamuteBuild} from './arkpedia-palamute-source.js';
import {normalizeChess,normalizeToken} from '../simdata.js';
import {canDeployInViewport} from '../../../shared/arkpedia/squad.js';
import {COLS} from '../constants.js';
const present=u=>u?.alive&&u.deployed&&!u._removing,same=(a,z)=>JSON.stringify(a)===JSON.stringify(z),due=(a,z)=>a+1e-7>=z;
export const PALAMUTE_LIFECYCLE_CONTRACT=Object.freeze({
 scope:'Selected original Rhodes Island Recon tactical-point stock, independent Palamute inputs, lethal-attempt rest/recovery and owner cleanup; no combat/public admission',
 mapping:'One original zero-cost point is charged on owner deployment and consumed once, on empty low ground inside the current owner attack range. No facing selection, slot cost, refund or stock recharge on point withdrawal. Source UNDEADABLE and HealFree remain owned resources; active mode adds the native one block. The pointer-bound native Born-to-Start binding supplies initial playback, holding attacks but not blocking. A lethal HP-set attempt before the undeadable floor switches the point to dormant Trap/Item semantics, releases blockers and holds it at one HP. Sixty world seconds later the same point returns at full source HP and active one-block mode; no second placement/DP payment or invented initial-birth attack is emitted by this lifecycle. Exact authored Stun_Begin/Stun_End mixes bridge eligible rest/recovery animation changes without extending the independent sixty-second timer. Recovery advances the unit life identity to refuse stale work; accepted own point reservations remain. Owner retirement removes point, deck and handlers.',
 limits:'Missing RechargeToken cnt maps to one using source maxDeployCount and trait text. Compiled native HP-set/mode/FSM order, initial Start versus blocking, Trap/Item-to-device semantics, same-point recovery life identity, rejected mode-resource retry and non-repeated initial Born are explicit local mappings. Source First Born/projectile and all ordinary/owner/bomb/trait attacks and original Single-art delivery are separate gates. Modules, effects/audio, physical devices and game-frame/pixel parity are unverified. No public roster/summon registration.',
 frameParity:false,
});
function verify(){const n=reconNativeInputs(),charge=reconSourceComponent('characters',ID,'-5238322964968415528')._buffs[0],common=reconSourceComponent('tokens',TOKEN,'-3499525587069341188')._buffs;
 const listener=n.templates['bddg_s_1[listener]'].eventToActions.ON_BEFORE_TRY_SET_HP_ZERO,recover=n.templates['bddg_t_1[start]'].eventToActions.ON_BUFF_START,block=reconSourceComponent('tokens',TOKEN,'629399978410078716')._buffs[1];
 if(charge.templateKey!=='charge_token[born]'||n.templates['charge_token[born]'].eventToActions.ON_OWNER_BORN[0]._cntKey!=='cnt'||n.templates.die_to_kill_token.eventToActions.ON_OWNER_FINISH[0]._checkContainsBuff!==false
  ||common[0].attributes.abnormalFlags.join()!=='6'||common[1].attributes.abnormalFlags.join()!=='7'||block.attributes.attributeModifiers[0].attributeType!==5||block.blackboard[0].value!==1
  ||listener[0]._entity!=='BUFF_OWNER'||listener[2]._category!=='TRAP_OR_ITEM'||listener[4]._loadModeFromBlackboard!==true
  ||recover[0]._category!=='DEFAULT'||recover[1]._target!=='BUFF_OWNER'||recover[2]._conditionNode._buffKeys[0]!=='bddg[spawned]'
  ||recover[2]._succeedNodes.at(-1)._animation!=='Idle')throw Error('Changed original Recon/Palamute lifecycle graph');
 const born=n.tokenAnimator._animations.find(a=>a.animKey==='Born');
 if(n.tokenRoot._animator.m_PathID!=='7173132144346362364'||born?.animName!=='Start'||born.loop!==0||born.speed!==1
  ||!n.tokenAnimator._mixSettings.some(m=>m.sourceAnimName==='Idle'&&m.targetAnimName==='Stun'&&m.mixAnimName==='Stun_Begin')
  ||!n.tokenAnimator._mixSettings.some(m=>m.sourceAnimName==='Stun'&&m.targetAnimName==='Idle'&&m.mixAnimName==='Stun_End'))throw Error('Changed original Palamute animation bindings');
}
export function prepareReconLifecycle(b,u,{contract}={}){
 if(contract!==PALAMUTE_LIFECYCLE_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.reconLifecycle)throw Error('Fresh original Recon and explicit Palamute lifecycle contract required');verify();
 const record=selectedReconBuild(u.def.raw.arkpedia);
 if(!same(u.def.stats,normalizeChess({stats:record.stats}).stats)||!same(u.rangeGrid,record.rangeGrid)||!same(u.def.talents.map(t=>t.bb),record.talentBb)||u.def.skill)throw Error('Incomplete original passive Recon inputs');
 const controller=new PalamuteLifecycle(b,u,record);u.deploymentSlotCost=0;u.mem.reconLifecycle=controller;
 return{record,controller,kit:{talents:[],skill:null,trait:{noAttack:true,install:null,dmgMul:null}}};
}
export class PalamuteLifecycle{
 constructor(b,u,ownerRecord){Object.assign(this,{b,u,ownerRecord,record:selectedPalamuteBuild(ownerRecord.build),seq:null,stopped:false,stock:0,point:null,placing:false,handles:[]});
  const r=this.record;this.def=normalizeToken(TOKEN,{name:r.source.appellation.trim(),position:r.source.position,profession:r.source.profession,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,skill:null,arkpedia:{...r.build}});
  const d=this;this.state={key:`summon:${ID}`,ownerId:ID,owner:u,tokenId:TOKEN,record:{...this.def.raw,id:TOKEN},deck:this,
   config:Object.freeze({deploymentSlotCost:0,chooseFacing:false,refundRatio:0,healFree:true,noAttack:true}),get stock(){return d.stock;},get readyAt(){return d.valid()&&d.stock?d.b.time:Infinity;}};
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 current(p=this.point){return this.valid()&&p&&!p.finished&&present(p.unit)&&p.unit.deploySeq===p.seq;}
 own(){return this.current()?[this.point.unit]:[];}
 placementError(row,col){const{b,u}=this;
  if(!canDeployInViewport(b.viewport))return 'Open the fullscreen workspace to deploy.';
  if(b.finished)return 'Battle has ended.';if(!this.valid()||u.hidden)return 'Deploy Rhodes Island Recon first.';
  if(this.placing||this.stock!==1||this.point)return 'The tactical point has already been placed.';
  if(!Number.isInteger(row)||!Number.isInteger(col)||!b.grid.inRect(row,col))return 'Select a tile on the map.';
  const tile=b.grid.tile(row,col);if(tile.height!=='LOW'||!['MELEE','ALL'].includes(tile.build)||b.grid.isObstacle(row,col))return 'Choose a low-ground deployment tile.';
  if(b.rangeChanged(u))b._refreshRange(u);if(!u.rangeKeys.includes(row*COLS+col))return 'Choose a tactical point inside Recon’s attack range.';
  if(b.unitAt(row,col)||b.tileReservation(row,col)||b.downOn(row,col))return 'Tile is occupied or reserved.';return null;
 }
 visual(p,clip,loop=false){if(clocks.tokens[TOKEN].models.Single.exactDurations[clip]==null)throw Error('Missing original Palamute pose');p.unit.mem.regularFormVisual={clip,speed:1,loop,...(!loop?{playId:`palamute:${p.seq}:${++p.visualSeq}`}:{})};p.unit.mem.regularDeathVisual={clip:'Die',die:'Die',duration:1};}
 pose(p,clip,loop=false){const from=p.unit.mem.regularFormVisual?.clip,mix=reconNativeInputs().tokenAnimator._mixSettings.find(m=>m.sourceAnimName===from&&m.targetAnimName===clip);p.visualPending=null;
  if(mix){const until=this.b.time+clocks.tokens[TOKEN].models.Single.exactDurations[mix.mixAnimName];p.visualPending={clip,loop,until};p.attackReadyAt=until;this.visual(p,mix.mixAnimName);}else{p.attackReadyAt=this.b.time;this.visual(p,clip,loop);}
 }
 place(row,col){const error=this.placementError(row,col);if(error)throw Error(error);this.placing=true;this.stock=0;let token,created,resourcesOK=false;const resources=new Set();
  try{
   token=this.b.spawnToken(this.u,TOKEN,row,col,{dir:'RIGHT',def:this.def,kit:{trait:this.combat?.trait??{noAttack:true},talents:[],skill:null,install:(b,t)=>{
    created=t;t.deploymentSlotCost=0;t.mem.regularSummonCard=this.state.key;
    const und=b.addBuff(t,{key:'palamute:undeadable',source:t,persist:true,allowDead:true,flags:{undeadable:true}}),heal=b.addBuff(t,{key:'palamute:heal-free',source:t,persist:true,allowDead:true,flags:{healFree:true}}),block=b.addBuff(t,{key:'palamute:active-block',source:t,persist:true,allowDead:true,mods:{blockCnt:1}});for(const r of[und,heal,block])if(r)resources.add(r);resourcesOK=!!und&&!!heal&&!!block;
   }}});
   if(!token||!present(token)||!this.valid()||!resourcesOK)throw Error('Original Palamute point deployment failed.');
   const p=this.point={unit:token,seq:token.deploySeq,row,col,mode:'born',bornUntil:this.b.time+clocks.tokens[TOKEN].models.Single.exactDurations.Start,recoverAt:Infinity,finished:false,visualSeq:0,resources};this.visual(p,'Start');this.combat?.placed?.(p);return token;
  }catch(error){token??=created;if(present(token))this.b._remove(token,'palamute-placement-cancelled',null,true);else if(token){this.b.offOwner(token);token.removed=true;}if(this.valid())this.stock=1;throw error;}
  finally{this.placing=false;}
 }
 onLethal({unit}){const p=this.point;if(!this.current(p)||unit!==p.unit||!['active','born'].includes(p.mode)||!unit.findBuff('palamute:undeadable'))return;
  const previous=p.mode;p.mode='transition';const rest=this.b.addBuff(unit,{key:'palamute:rest',source:unit,flags:{noBlock:true,untargetable:true,disarm:true}});
  if(rest)p.resources.add(rest);if(!this.current(p)){if(rest)this.b.removeBuff(unit,rest);return;}if(!rest){p.mode=previous;return;}
  p.mode='rest';this.combat?.clear(p);p.recoverAt=this.b.time+this.record.duration;p.originalKind=unit.kind;unit.kind='device';unit.atkCd=0;
  const retained=new Set(this.record.native._retainedBuffsWhenDead);
  for(const buff of unit.buffs.slice()){
   if(!buff.persist&&!p.resources.has(buff)&&!retained.has(buff.data?.nativeKey))this.b.removeBuff(unit,buff);
   if(!this.current(p))return;
  }
  this.b.removeBuff(unit,'palamute:active-block');this.b.releaseBlocked(unit);if(this.current(p))this.pose(p,'Stun',true);
 }
 recover(p){if(!this.current(p)||p.mode!=='rest')return;
  const t=p.unit,block=this.b.addBuff(t,{key:'palamute:active-block',source:t,persist:true,mods:{blockCnt:1}});if(block)p.resources.add(block);if(!this.current(p)){if(block)this.b.removeBuff(t,block);return;}if(!block)return;
  t.kind=p.originalKind;this.b.removeBuff(t,'palamute:rest');if(!this.current(p))return;
  t.deploySeq=++this.b._deploySeq;t.aggroSeq=t.deploySeq;p.seq=t.deploySeq;t.deployedAt=this.b.time;t.hp=t.s.maxHp;t.atkCd=0;p.mode='active';p.recoverAt=Infinity;this.pose(p,'Idle',true);
 }
 retreat(t){if(!canDeployInViewport(this.b.viewport)||this.b.finished||!this.current()||this.point.unit!==t)throw Error('Select the current Palamute point in fullscreen.');this.finish(this.point,{remove:true,reason:'withdrawal'});return true;}
 finish(p,{remove=false,reason='removed'}={}){if(!p||p.finished)return;p.finished=true;this.combat?.clear(p);if(this.point===p)this.point=null;this.stock=0;
  for(const buff of p.resources)this.b.removeBuff(p.unit,buff);p.resources.clear();
  if(remove&&present(p.unit)&&p.unit.deploySeq===p.seq)this.b._remove(p.unit,`palamute-${reason}`,null,true);
 }
 tick(){if(this.seq===null&&!this.stopped)return;if(!this.valid()){this.stop();return;}const p=this.point;if(!p)return;
  if(!present(p.unit)||p.unit.deploySeq!==p.seq){this.finish(p);return;}
  for(const buff of p.resources)if(!p.unit.buffs.includes(buff))p.resources.delete(buff);
  if(p.visualPending&&due(this.b.time,p.visualPending.until)){const v=p.visualPending;p.visualPending=null;this.visual(p,v.clip,v.loop);}
  if(p.mode==='born'&&(this.combat?.bornComplete?this.combat.bornComplete(p):due(this.b.time,p.bornUntil))){
   if(this.current(p)&&p.mode==='born'){p.mode='active';this.pose(p,'Idle',true);}
  }else if(p.mode==='rest'&&due(this.b.time,p.recoverAt))this.recover(p);
 }
 install(){if(this.stopped||this.handles.length)throw Error('Recon point lifecycle cannot be reinstalled');const map=this.b.regularSummons??=new Map();if(map.has(this.state.key))throw Error('A Recon point deck already exists');map.set(this.state.key,this.state);
  const{b,u}=this;this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){this.seq=u.deploySeq;this.stock=1;}},{owner:u}),b.on('tick',()=>this.tick(),{owner:u}),
   b.on('hpZeroAttempt',c=>this.onLethal(c),{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();else if(unit===this.point?.unit)this.finish(this.point);},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();else if(unit===this.point?.unit)this.finish(this.point);},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
  this.combat?.install();
 }
 stop(){if(this.stopped)return;this.stopped=true;this.stock=0;this.finish(this.point,{remove:true,reason:'owner-finished'});this.combat?.stop();if(this.b.regularSummons?.get(this.state.key)===this.state)this.b.regularSummons.delete(this.state.key);for(const h of this.handles)this.b.off(h);this.handles=[];}
}
