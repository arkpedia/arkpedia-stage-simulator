// SPDX-License-Identifier: GPL-3.0-or-later
// Private native-selected Shadow lifecycle. Public registration is a separate gate.
import evidence from '../../../data/arkpedia-wisadel-prefabs.json' with {type:'json'};
import { WisadelAttackController,selectedWisadelBuild,WISADEL_ID } from './arkpedia-wisadel-attacks.js';
import { WISADEL_AFTERIMAGE } from './arkpedia-wisadel-projectiles.js';
import { normalizeChess } from '../simdata.js';
import { absoluteRangeKeys,canTargetEnemy,sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';

export const WISADEL_SHADOW='token_10035_wisdel_wward';
export const WISADEL_CAMOUFLAGE='token_wisdel_host[Camouflage]';
export const WISADEL_SHADOW_CONTRACT=Object.freeze({
  placement:'E2 castOnLocate maps to one deployment-time spawn; nearest legal empty buildable tile in current host range, seeded tie choice; at most three, no DP or deployment slots',
  camouflage:'ON_BUFF_START x-5 host-only capture; claims derive from each token, finish with that token; no invented periodic aura or camouflage for other allies',
  selection:'current host-range ground targets, without the shared afterimage preferred; priority ties; PRECAST identity retained through original OnAttack',
  clocks:'source .2 custom cast window with original .033 OnAttack at one playback; no SP during cast; source convertToInt=false maps to uniform fractional [0,3) forced refill on normal end',
  projectile:'captured root coordinates, speed15 and two-second timeout; retained trace identity, live token ATK, Arts/Slow and owner-derived shared afterimage; born output survives token/host finish',
  limits:'Unregistered Shadow helper. Native filter27/tile-sort geometry, castOnLocate/FSM/event dispatch, fixed-root mount/line travel, fractional RNG/forced SP callback semantics, HEAL_FREE numeric7 alias, host-range sorting and derived-claim arbitration are local mappings. Disabled ordinary-trigger binding, S3 integration, original asset publication, public lifecycle/browser, modules and effects/audio remain gates; compiled frame parity is unverified.',
  frameParity:false,
});
const all=Object.values({...evidence.characters,...evidence.tokens,...evidence.skills,...evidence.projectiles})
  .flatMap(rows=>rows.flatMap(r=>r.components));
const c=id=>all.find(r=>r.pathId===id)?.data;
const root=c('7531983340995195566'),selector=c('7286542822435797647');
const cast=c('-7386112727074260337'),metadata=c('-7660758978228700529');
const tileSelector=c('8470049151863188959'),spawn=c('886641082240560607');
const mover=c('-4142004031650792695'),bolt=c('8036233635240344329');
const model=evidence.tokenModels[WISADEL_SHADOW].front;
const markOnly=u=>u?.alive&&u.deployed&&!u.hidden&&!u._removing;
const ground={groundOnly:true,canHitFly:false};
const flat=rows=>Object.fromEntries(rows.map(v=>[v.key,v.value]));
const same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
const grid=id=>evidence.tables.ranges[id].grids.map(v=>[v.row,v.col]);
const endNodes=JSON.parse(evidence.originalTemplates.token_wisdel_skill_end.eventToActions._items[0].value.SerializedState);

function reviewed(controller,contract){
  if(contract!==WISADEL_SHADOW_CONTRACT||!(controller instanceof WisadelAttackController))
    throw Error('Wisadel Shadows require the reviewed controller/contract');
  const u=controller.u,r=controller.record,b=controller.b;
  if(u.def.charId!==WISADEL_ID||u.deploySeq!==0||controller.stopped||u.mem.wisadelShadows)
    throw Error('Wisadel Shadows require a fresh original owner');
  const actual=selectedWisadelBuild({...u.def.raw.arkpedia,skillId:u.def.skill.id});
  if(!same(r,actual)||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
    ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.skill.bb,r.bb)||!b)
    throw Error('Incomplete Wisadel Shadow selected source');
  const source=evidence.tables.tokenSkills.sktok_wisdel_wward.levels[r.build.skillRank-1];
  if(root._occupiedRemainingCharacterCnt!==0||root._notShowInDeck!==0||root._clearProjectileWhenDead!==0
    ||root._isFixedRotation!==1||root._buildCondition.limitByHostAttackRange!==1
    ||spawn._checkTokenMaxDeployCnt!==1||tileSelector._filterType!==27||tileSelector._maxNum!==1
    ||cast._waitForAttackEvent!==1||cast._timeMode!==2||cast._selectTargetSource!==2
    ||selector._fetchHost!==1||selector._withoutThisBuff!==1||selector._buffKey!==WISADEL_AFTERIMAGE
    ||selector._targetMotion!==1||metadata._canSilenced!==0||metadata._recoverSpIfNoTarget!==1
    ||metadata._allowSpRecoveryWhenAffecting!==0||endNodes[0]._convertToInt!==false
    ||endNodes[1]._forceFlag!==true||source.spData.spCost!==5||source.skillType!=='AUTO'
    ||!same(c('6826492958112658094')._buffs[0].attributes.abnormalFlags,[7])
    ||mover._speed!==15||mover._keepUpdateTargetpos!==0||bolt._lifeTime!==2)
    throw Error('Unreviewed Wisadel Shadow native fields');
  return {source,bb:flat(source.blackboard)};
}

export class WisadelShadows {
  constructor(controller,{contract}={}){
    const selected=reviewed(controller,contract);this.c=controller;this.b=controller.b;this.u=controller.u;
    this.record=controller.record;this.source=selected.source;this.bb=selected.bb;
    this.tokens=new Map();this.outputs=new Set();this.claim=null;this.handles=[];this.stopped=false;this.finishing=false;
  }
  valid(){return !this.stopped&&this.c.valid();}
  legal(row,col){
    const b=this.b;if(!Number.isInteger(row)||!Number.isInteger(col)||!b.grid.inRect(row,col))return false;
    const t=b.grid.tile(row,col),occupied=b._occ[row*COLS+col];
    return ['MELEE','RANGED','ALL'].includes(t.build)&&!(occupied?.alive&&occupied.deployed)
      &&!b.tileReservation(row,col)&&!b.downOn(row,col)
      &&absoluteRangeKeys(this.u.rangeGrid,this.u.tileR,this.u.tileC,this.u.dir).includes(row*COLS+col);
  }
  select(){
    const rows=absoluteRangeKeys(this.u.rangeGrid,this.u.tileR,this.u.tileC,this.u.dir)
      .map(k=>({row:Math.floor(k/COLS),col:k%COLS})).filter(t=>this.legal(t.row,t.col));
    if(!rows.length)return null;
    const distance=t=>Math.hypot(t.row-this.u.tileR,t.col-this.u.tileC);
    const min=Math.min(...rows.map(distance)),ties=rows.filter(t=>Math.abs(distance(t)-min)<1e-9);
    return ties[Math.min(ties.length-1,Math.floor(this.b.rng()*ties.length))];
  }
  definition(){
    const token=evidence.tables.token,phase=token.phases[this.record.build.elite],frames=phase.attributesKeyFrames;
    const a=frames[0],z=frames.at(-1),ratio=(this.record.build.level-a.level)/(z.level-a.level||1);
    const stats=Object.fromEntries(Object.entries(a.data).filter(([,v])=>typeof v==='number')
      .map(([k,v])=>[k,v+(z.data[k]-v)*ratio]));
    for(const k of ['maxHp','atk','def'])stats[k]=Math.round(stats[k]);
    return {name:token.name,profession:token.profession,position:token.position,subProfessionId:token.subProfessionId,
      stats,rangeGrid:grid(phase.rangeId),spine:WISADEL_SHADOW,talents:[],
      skill:{...this.source,...this.source.spData,skillId:'sktok_wisdel_wward'},arkpedia:{...this.record.build}};
  }
  spawn(count=1){
    const result=[];
    if(!this.valid()||this.record.build.elite!==2||!Number.isInteger(count)||count<0)return result;
    for(let i=0;i<count&&this.valid()&&this.tokens.size<3;i++){
      const tile=this.select();if(!this.valid()||!tile)break;
      const token=this.place(tile);if(token)result.push(token);
    }
    return result;
  }
  place(tile){
    if(!this.valid()||this.record.build.elite!==2||this.tokens.size>=3||!tile||!this.legal(tile.row,tile.col))return null;
    const entry={token:null,phase:null,epoch:0,removed:false,claimEligible:false,requested:false,visualUntil:0};
    const kit={trait:{noAttack:true},talents:[],skill:{kind:'instant',trigger:{rule:'NEVER'},attack:{},
      canActivate:()=>entry.requested&&!entry.token.skill.active&&this.valid()
        &&markOnly(entry.token)&&entry.token.canAct&&!entry.token.s.flags.disarm},install:(_b,t)=>{
      entry.token=t;this.tokens.set(t,entry);t.deploymentSlotCost=0;t.mem.wisadelShadow=entry;
      t.mem.regularFormVisual={clip:'Start',speed:1,loop:false};
      this.b.addBuff(t,{key:'wisadel:shadow-heal-free',flags:{healFree:true,noHeal:true},persist:true,allowDead:true});
    }};
    const t=this.b.spawnToken(this.u,WISADEL_SHADOW,tile.row,tile.col,{def:this.definition(),kit,dir:'RIGHT'});
    if(!t||!markOnly(t)||entry.removed||!this.valid()){
      if(t&&markOnly(t))this.b.retreat(t,{permanent:true});if(entry.token)this.remove(entry.token);return null;
    }
    entry.seq=t.deploySeq;entry.epoch=t.attackControlEpoch;
    entry.claimEligible=new Set(absoluteRangeKeys(grid('x-5'),t.tileR,t.tileC,'RIGHT')).has(this.u.tileR*COLS+this.u.tileC);
    this.syncClaim();
    if(!this.valid()||!markOnly(t)||entry.removed){if(markOnly(t))this.b.retreat(t,{permanent:true});this.remove(t);return null;}
    this.b.emit('wisadelShadowSpawn',{owner:this.u,token:t});
    if(!this.valid()||entry.removed||!markOnly(t)){this.remove(t);return null;}
    return t;
  }
  syncClaim(){
    if(this.finishing)return;
    const candidates=[...this.tokens.values()].filter(e=>e.claimEligible&&!e.removed&&markOnly(e.token));
    if(this.claim&&(!this.valid()||!candidates.some(e=>e.token===this.claim.source)
      ||this.u.findBuff(WISADEL_CAMOUFLAGE)!==this.claim)){
      const old=this.claim;this.claim=null;this.b.removeBuff(this.u,old);
    }
    if(!this.valid()||this.claim||!candidates.length||this.u.findBuff(WISADEL_CAMOUFLAGE))return;
    const source=candidates[0].token,seq=this.u.deploySeq;
    const buff=this.b.addBuff(this.u,{key:WISADEL_CAMOUFLAGE,source,refresh:'keep',flags:{camou:true}});
    if(buff?.source===source&&this.valid()&&this.u.deploySeq===seq&&markOnly(source)&&this.tokens.has(source))this.claim=buff;
    else if(buff?.source===source)this.b.removeBuff(this.u,buff);
  }
  targets(){
    const keys=new Set(absoluteRangeKeys(this.u.rangeGrid,this.u.tileR,this.u.tileC,this.u.dir));
    const rows=this.b.enemies.filter(t=>canTargetEnemy(this.u,t,ground)&&(!t.s.flags.camou||t.blockedBy)
      &&bodyInKeys(t,keys));
    sortEnemyTargets(this.b,this.u,rows);
    return [...rows.filter(t=>!t.findBuff(WISADEL_AFTERIMAGE)),...rows.filter(t=>t.findBuff(WISADEL_AFTERIMAGE))];
  }
  cancel(entry,reason){
    const t=entry.token;entry.phase=null;this.b.removeBuff(t,'wisadel:shadow-cast');
    if(t.skill.active)t.skill.end(reason);
  }
  tickEntry(entry){
    const t=entry.token,b=this.b;
    if(entry.removed||!markOnly(t)||t.deploySeq!==entry.seq)return;
    if(!t.canAct||t.s.flags.disarm||entry.epoch!==t.attackControlEpoch){
      this.cancel(entry,'control');entry.epoch=t.attackControlEpoch;t.mem.regularFormVisual={clip:'Idle',loop:true};return;
    }
    const p=entry.phase;
    if(p){
      if(!p.released&&b.time+1e-9>=p.releaseAt){
        p.released=true;
        if(p.target.deploySeq!==p.targetSeq||!canTargetEnemy(t,p.target,ground)){
          this.cancel(entry,'lost-input');if(markOnly(t)&&!entry.removed)t.skill.addCharge(1);return;
        }
        this.launch(entry,p);
        if(!this.valid()||entry.removed||entry.phase!==p)return;
      }
      if(b.time+1e-9<p.endAt)return;
      this.cancel(entry,'normal');
      if(!this.valid()||entry.removed||!markOnly(t)||t.deploySeq!==entry.seq)return;
      // Original forceFlag bypasses noSp; retain fractional RandomSetter rather
      // than importing the displayed "0-2" wording as integer execution.
      const value=this.bb.sp_min+b.rng()*(this.bb.sp_max-this.bb.sp_min);
      if(!this.valid()||entry.removed||!markOnly(t)||t.deploySeq!==entry.seq)return;
      t.skill.gainSp(value,'init',true);
      b.emit('wisadelShadowRefill',{owner:this.u,token:t,value});
    }
    if(!this.valid()||entry.removed||!markOnly(t))return;
    if(!t.skill.ready){if(b.time>=Math.max(t.deployedAt+model.durations.Start,entry.visualUntil)&&!entry.phase)t.mem.regularFormVisual={clip:'Idle',loop:true};return;}
    const target=this.targets()[0];if(!target)return;
    // Controller owns automatic trigger; inherited Stronghold trigger is off.
    const targetSeq=target.deploySeq,epoch=t.attackControlEpoch;
    entry.requested=true;let accepted;
    try{accepted=t.skill.activate('wisadel-shadow');}finally{entry.requested=false;}
    if(!accepted||!this.valid()||entry.removed||!markOnly(t)||!t.canAct||t.s.flags.disarm||epoch!==t.attackControlEpoch){if(t.skill.active)this.cancel(entry,'interrupted');return;}
    if(target.deploySeq!==targetSeq||!canTargetEnemy(t,target,ground)){
      this.cancel(entry,'lost-input');if(markOnly(t)&&!entry.removed)t.skill.addCharge(1);return;
    }
    const marker=model.eventPayloads.Attack.find(v=>v.name==='OnAttack').time;
    entry.phase={target,targetSeq,released:false,releaseAt:b.time+marker,endAt:b.time+cast._cooldown};
    this.b.addBuff(t,{key:'wisadel:shadow-cast',flags:{noSp:true},source:t});
    if(!this.valid()||entry.removed||!markOnly(t)){this.cancel(entry,'interrupted');return;}
    t.dir=target.x<t.x?'LEFT':'RIGHT';entry.visualUntil=b.time+model.durations.Attack;
    t.mem.regularFormVisual={clip:'Attack',speed:1,loop:false};
  }
  launch(entry,p){
    const t=entry.token,b=this.b,target=p.target;
    const output={token:t,target,targetSeq:p.targetSeq,x:target.x,y:target.y,cancelled:false,timer:null};
    this.outputs.add(output);
    const travel=Math.min(bolt._lifeTime,Math.hypot(target.x-t.x,target.y-t.y)/mover._speed);
    output.timer=b.after(travel,()=>{
      if(!output.cancelled&&!b.finished&&target.deploySeq===output.targetSeq&&canTargetEnemy(t,target,ground)){
        this.c.projectiles.attach(target,output.targetSeq,t);
        if(!output.cancelled&&!b.finished&&target.deploySeq===output.targetSeq&&canTargetEnemy(t,target,ground)){
          b.dealDamage(t,target,{amount:t.s.atk*t.s.atkScaleMul,type:'arts',isAttack:true,isSkill:true,applyWay:'ranged'});
          if(!output.cancelled&&!b.finished&&target.deploySeq===output.targetSeq&&canTargetEnemy(t,target,ground))
            b.applyStatus(target,'sluggish',{duration:this.bb.sluggish,source:t});
        }
      }
      this.outputs.delete(output);this.releaseHooks();
    });
    b.emit('wisadelShadowProjectileBirth',{owner:this.u,token:t,output});
  }
  remove(token){
    const entry=this.tokens.get(token);if(!entry)return;
    entry.removed=true;this.cancel(entry,'token-finish');this.tokens.delete(token);this.syncClaim();
  }
  tick(){
    if(!this.valid()){if(this.u.deploySeq===0&&!this.stopped)return;this.stop();return;}
    for(const entry of [...this.tokens.values()]){if(!this.valid())break;this.tickEntry(entry);}
  }
  install(){
    if(this.handles.length||this.stopped)return;
    if(this.u.mem.wisadelShadows&&this.u.mem.wisadelShadows!==this)throw Error('Wisadel Shadow owner already bound');
    this.u.mem.wisadelShadows=this;
    this.handles=[this.b.on('tick',()=>this.tick()),this.b.on('deploy',({unit})=>{
      if(unit===this.u)this.spawn(1);
    }),this.b.on('death',({unit})=>{if(unit===this.u)this.stop();else if(this.tokens.has(unit))this.remove(unit);}),
    this.b.on('battleEnd',()=>this.stop(true))];
  }
  stop(battleEnd=false){
    if(battleEnd||this.b.finished){for(const o of this.outputs){o.cancelled=true;o.timer?.cancel();}this.outputs.clear();}
    if(!this.stopped){
      this.stopped=true;this.finishing=true;
      const claim=this.claim;this.claim=null;if(claim)this.b.removeBuff(this.u,claim);
      for(const [t,e]of [...this.tokens]){e.removed=true;this.cancel(e,'owner-finish');this.tokens.delete(t);
        if(markOnly(t))this.b.retreat(t,{permanent:true,reason:'wisadel-owner-finish'});}
      this.finishing=false;
    }
    this.releaseHooks();
  }
  releaseHooks(){if(!this.stopped||this.outputs.size)return;for(const h of this.handles)this.b.off(h);this.handles=[];}
}
