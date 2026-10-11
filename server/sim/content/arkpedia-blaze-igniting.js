// SPDX-License-Identifier: GPL-3.0-or-later
// Private selected-source foundation. No public registry entry until all three
// skills, native lifecycle dependencies and public integration are reviewed.
import evidence from '../../../data/arkpedia-blaze-igniting-prefabs.json' with {type:'json'};
import {sourceCandidate} from '../../../shared/arkpedia/summons.js';
import {normalizeChess,flattenBlackboard} from '../simdata.js';
import {absoluteRangeKeys,canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {bodyInKeys,bodyInRadius} from '../body.js';
import {makeDamageInfo} from '../damage.js';

export const BLAZE_IGNITING_ID='char_1040_blaze2';
export const BLAZE_IGNITING_CORE_CONTRACT=Object.freeze({
  scope:'Private selected-source ordinary attack, global Burn burst talent and downed revival foundation; activated skills are held',
  attacks:'Original Front/Back Attack event and speed-one cap; one speed-ten Arts projectile; emitted shots survive owner removal',
  talents:'Selected elite/potential Burn burst bonus and ignore-heal-free self recovery; 6000 non-Elemental barrier, max-HP regeneration, full-HP revival and radius1.7 five-second stun',
  mapping:'Root/body targeting, one-HP fatal repair, tick-observed full-HP revival, source clip-end attack cadence, physical/Arts/true barrier mask and persistent-buff retention are local execution mappings',
  limits:'The native inv_duration transition value, compiled numeric abnormal flags, callback/chain and aura detection clocks, skill interruption/ammo restoration, original particles/audio, modules and Unity frame parity remain unverified; this foundation is not publicly enabled',
  frameParity:false,
});
const ID=BLAZE_IGNITING_ID,air={canHitFly:true};
const flat=flattenBlackboard;
const same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
const live=u=>u?.alive&&u.deployed&&!u.hidden&&!u._removing;
const grid=id=>id?evidence.tables.ranges[id].grids.map(v=>[v.row,v.col]):[];
const components=Object.values({...evidence.characters,...evidence.skills,...evidence.projectiles}).flatMap(rs=>rs.flatMap(r=>r.components));
const component=id=>components.find(c=>c.pathId===id)?.data;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const factions=[evidence.tables.character.nationId,evidence.tables.character.groupId,evidence.tables.character.teamId].filter(v=>typeof v==='string'&&v);
const interpolate=(frames,level)=>{
  const lo=frames[0],hi=frames.at(-1),t=hi.level===lo.level?0:(level-lo.level)/(hi.level-lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,v+(hi.data[k]-v)*t]));
};

export function selectedBlazeIgnitingBuild(build){
  const c=evidence.tables.character;
  if(!build||!Number.isInteger(build.elite)||!c.phases[build.elite]
    ||!Number.isInteger(build.level)||build.level<1||build.level>c.phases[build.elite].maxLevel
    ||!Number.isInteger(build.potential)||build.potential<1||build.potential>6
    ||!Number.isInteger(build.trust??0)||(build.trust??0)<0||(build.trust??0)>200
    ||!Number.isInteger(build.skillRank)||build.skillRank<1||build.skillRank>[4,7,10][build.elite]
    ||build.module&&build.module!=='none')throw Error('Invalid Blaze Igniting source build');
  const index=['skchr_blaze2_1','skchr_blaze2_2','skchr_blaze2_3'].indexOf(build.skillId);
  if(index<0||index>build.elite)throw Error('Locked Blaze Igniting source skill');
  const phase=c.phases[build.elite],source=evidence.tables.skills[build.skillId].levels[build.skillRank-1];
  const stats=interpolate(phase.attributesKeyFrames,build.level),favor=interpolate(c.favorKeyFrames,Math.min(100,build.trust??0)/2);
  for(const k of ['maxHp','atk','def'])stats[k]=Math.round(stats[k]+favor[k]);
  const attrs={COST:'cost',ATK:'atk'};
  for(const p of c.potentialRanks.slice(0,build.potential-1))for(const m of p.buff?.attributes.attributeModifiers??[]){
    if(!attrs[m.attributeType]||m.formulaItem!=='ADDITION')throw Error('Unreviewed Blaze Igniting potential');
    stats[attrs[m.attributeType]]+=m.value;
  }
  const talents=c.talents.map(t=>sourceCandidate(t.candidates,build)).filter(Boolean);
  return {build:{...build},index,source,bb:flat(source.blackboard),stats,rangeGrid:grid(phase.rangeId),talents,
    meltdown:flat(talents.find(t=>t.prefabKey==='1')?.blackboard),revival:flat(talents.find(t=>t.prefabKey==='2')?.blackboard)};
}
function validate(u,contract){
  if(contract!==BLAZE_IGNITING_CORE_CONTRACT)throw Error('Blaze Igniting requires the reviewed core contract');
  if(u.def.charId!==ID||u.deploySeq!==0||u.mem.blazeIgnitingController)throw Error('Blaze Igniting requires a fresh original owner');
  const build={...u.def.raw.arkpedia,skillId:u.def.skill?.id},r=selectedBlazeIgnitingBuild(build),s=u.def.skill;
  if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==build.skillId
    ||s.skillType!==r.source.skillType||s.spType!=='time'||s.spCost!==r.source.spData.spCost
    ||s.initSp!==r.source.spData.initSp||s.maxCharges!==r.source.spData.maxChargeTime
    ||s.duration!==r.source.duration||!same(s.bb,r.bb)||!same(s.rangeGrid??[],grid(r.source.rangeId))
    ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,factions)
    ||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
    ||!same(u.def.talents.map(t=>t.bb),r.talents.map(t=>flat(t.blackboard))))throw Error('Incomplete Blaze Igniting selected source');
  const a=component('-4687093889924373767');
  if(a._waitForAttackEvent!==1||a._maxAnimScale!==1||a._atkScale!==1||a._useCachedAtkOnly!==0
    ||a._projectileKey!=='projectile_chr_blaze2'||component('-4195892567067822584')._speed!==10
    ||component('784354286157592072')._lifeTime!==10
    ||component('784354286157592072')._stopWhenSourceInvalid!==0
    ||component('-280470876647890183').m_Radius!==1.7000000476837158)
    throw Error('Unreviewed Blaze Igniting native lifecycle');
  return r;
}

export class BlazeIgnitingCoreController{
  constructor(b,u,record){this.b=b;this.u=u;this.record=record;this.seq=null;this.stopped=false;this.phase=null;this.handles=[];this.reborn=null;this.downState=null;}
  valid(){return !this.stopped&&!this.b.finished&&live(this.u)&&this.seq===this.u.deploySeq;}
  eligible(t){return live(t)&&canTargetEnemy(this.u,t,air)&&(!t.s.flags.camou||!!t.blockedBy);}
  visual(clip,speed=1,loop=false){
    this.u.mem.regularVisualDirection=['UP','LEFT'].includes(this.u.dir)?'UP':'RIGHT';
    this.u.mem.regularFormVisual={clip,speed,loop};
  }
  targets(){
    const u=this.u,keys=u.rangeKeySet??new Set(absoluteRangeKeys(u.rangeGrid,u.tileR,u.tileC,u.dir,u.s.rangeExtend));
    const targets=this.b.enemies.filter(t=>this.eligible(t)&&(bodyInKeys(t,keys)||t.blockedBy===u));
    sortEnemyTargets(this.b,u,targets);return targets;
  }
  burnBurst({target,element}){
    const {b,u,record:r}=this;
    if(!this.valid()||element!=='burn'||target.side!=='enemy'||!this.eligible(target)||!r.meltdown.ep_damage_scale)return;
    // Native ON_BEFORE_EP_BREAK_START heal precedes ON_EP_BREAK_START damage.
    // The engine's burst hook precedes its lock/base hit, preserving that order.
    b.heal(u,u,u.s.maxHp*r.meltdown.hp_ratio,{self:true,ignoreHealFree:true});
    if(!this.valid()||!live(target))return;
    b.dealDamage(u,target,makeDamageInfo({amount:u.s.atk*r.meltdown.ep_damage_scale,type:'elemental',element:'burn',
      canDodge:false,isAttack:true,tags:['blaze2:meltdown']}));
  }
  down(ctx){
    const {b,u,record:r}=this;
    if(ctx.unit!==u||ctx.prevented||!this.valid()||this.reborn||!r.revival.dynamic)return;
    ctx.prevented=true;
    // Account fatal HP loss before repairing the one-HP runtime floor.
    ctx.afterHpLoss=()=>{
      if(!this.valid())return;
      u.hp=Math.min(1,u.s.maxHp);this.phase=null;
      // Native ClearAllBuffs excludes durable instances. Runtime persist is a
      // local durability bridge; own state is created after clearing modifiers.
      for(const buff of [...u.buffs])if(!buff.persist)b.removeBuff(u,buff);
      this.reborn={kind:'downed',beginEnds:b.time+model(u).durations.Revive_Begin};
      this.downState=b.addBuff(u,{key:'blaze2_t_2[reborn_state]',source:u,visible:true,shield:r.revival.dynamic,
        shieldTypes:['phys','arts','true'],mods:{hpRegenRatio:r.revival.hp_recovery_per_sec_by_max_hp_ratio},
        flags:{disarm:true,healFree:true,noBlock:true}});
      this.visual('Revive_Begin');b.emit('blazeIgnitingDowned',{owner:u,state:this.reborn,barrier:this.downState});
    };
  }
  beginRevival(){
    const {b,u,record:r}=this;
    if(!this.valid()||this.reborn?.kind!=='downed')return;
    b.removeBuff(u,this.downState);this.downState=null;
    this.reborn={kind:'reviving',ends:b.time+model(u).durations.Revive_End};
    // Native back-to-default mode protects the end animation. Its symbolic
    // mapping is local; the earlier unresolved inv_duration is not invented.
    b.addBuff(u,{key:'blaze2_back_to_default',source:u,flags:{disarm:true,invulnerable:true,noBlock:true,healFree:true}});
    this.visual('Revive_End');
    const radius=component('-280470876647890183').m_Radius;
    for(const t of b.enemies)if(this.eligible(t)&&bodyInRadius(t,u.x,u.y,radius))b.applyStatus(t,'stun',{source:u,duration:r.revival.stun});
    b.emit('blazeIgnitingRevival',{owner:u,state:this.reborn});
  }
  release(t,info){
    const p=this.phase,{u,b}=this;
    if(!this.valid()||this.reborn||!u.canAct||u.s.flags.disarm||!p||p.kind!=='attack'||p.accepted
      ||p.target!==t||p.targetSeq!==t.deploySeq||p.epoch!==u.attackControlEpoch
      ||!this.eligible(t)||b.time+1e-9<p.releaseAt)return false;
    p.accepted=true;
    const seq=t.deploySeq,projectile=b.addProjectile({from:u,target:t,source:u,speed:10,maxAge:10,visual:'bolt',
      data:{arkpediaTrackedVisual:true,blazeIgnitingOwner:this,blazeIgnitingKind:'ordinary'},
      onHit:({target})=>{
        if(b.finished||target!==t||t.deploySeq!==seq||!this.eligible(t))return;
        b.dealDamage(u,t,makeDamageInfo({amount:u.s.atk*u.s.atkScaleMul,type:'arts',isAttack:info.isAttack??true,
          isSkill:!!info.isSkill,attackId:info.attackId??0,applyWay:info.applyWay??'ranged',tags:['blaze2:ordinary']}));
      }});
    b.emit('blazeIgnitingProjectileBirth',{owner:u,target:t,projectile});return true;
  }
  tick(){
    if(!this.valid()){
      if(this.seq!==null&&this.u.alive&&this.u.deployed&&this.seq===this.u.deploySeq&&this.u.hidden){this.phase=null;return;}
      if(this.seq!==null)this.stop();return;
    }
    const {u,b}=this;
    if(this.reborn){
      if(this.reborn.kind==='downed'){
        if(u.hp>=u.s.maxHp-1e-9)this.beginRevival();
        else if(b.time+1e-9>=this.reborn.beginEnds&&u.mem.regularFormVisual?.clip!=='Revive_Idle')this.visual('Revive_Idle',1,true);
      }else if(b.time+1e-9>=this.reborn.ends){
        b.removeBuff(u,'blaze2_back_to_default');this.reborn=null;this.phase=null;u.atkCd=0;this.visual('Idle',1,true);
      }
      return;
    }
    let p=this.phase;
    if(p?.kind==='entrance'){
      if(b.time+1e-9<p.readyAt)return;
      this.phase=null;p=null;
    }
    if(!u.canAct||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){this.phase=null;this.visual('Idle',1,true);return;}
    if(p){
      if(!p.released&&b.time+1e-9>=p.releaseAt){
        p.released=true;
        if(this.eligible(p.target)&&p.targetSeq===p.target.deploySeq)b.forceAttack(u,[p.target]);
        if(!this.valid()||this.phase!==p)return;
      }
      if(b.time+1e-9<p.readyAt)return;
      this.phase=null;
    }
    if(u.atkCd>1e-9)return;
    const target=this.targets()[0];if(!target){this.visual('Idle',1,true);return;}
    const clip='Attack',speed=Math.min(1,u.base.bat/u.s.interval);
    this.phase={kind:'attack',target,targetSeq:target.deploySeq,epoch:u.attackControlEpoch,
      releaseAt:b.time+model(u).eventPayloads[clip].find(e=>e.name==='OnAttack').time/speed,
      readyAt:b.time+Math.max(u.s.interval,model(u).durations[clip]/speed),released:false,accepted:false};
    this.visual(clip,speed);u.atkCd=u.s.interval;
  }
  install(){
    if(this.stopped||this.handles.length)return;
    const {b,u}=this;u.mem.blazeIgnitingController=this;
    this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){
      this.seq=u.deploySeq;this.phase={kind:'entrance',readyAt:b.time+model(u).durations.Start};this.visual('Start');
    }},{owner:u}),b.on('tick',()=>this.tick(),{owner:u}),
    b.on('fatal',ctx=>this.down(ctx),{owner:u}),
    b.on('elementBurst',ctx=>this.burnBurst(ctx),{owner:u}),
    b.on('beforeStatus',ctx=>{if(ctx.target===u&&this.reborn&&['stun','freeze','sleep'].includes(ctx.status))ctx.cancel=true;},{owner:u}),
    b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),
    b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop())];
  }
  stop(){
    if(this.stopped)return;
    this.stopped=true;this.phase=null;this.reborn=null;
    if(this.downState)this.b.removeBuff(this.u,this.downState);this.downState=null;
    this.b.removeBuff(this.u,'blaze2_back_to_default');
    // Ordinary shots survive removal, but not a finished battle.
    if(this.b.finished)this.b.projectiles.remove(p=>p.data?.blazeIgnitingOwner===this);
    this.u.mem.regularFormVisual=null;delete this.u.mem.regularVisualDirection;
    for(const h of this.handles)this.b.off(h);this.handles=[];
  }
}
export function prepareBlazeIgnitingCore(b,u,{contract}={}){
  const record=validate(u,contract),controller=new BlazeIgnitingCoreController(b,u,record);
  const kit={trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,...air,install:null,onHit:null,onEachHit:null,
    requiresAcceptedLaunch:true,attackVisual:'none',launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info)},
    skill:{kind:'instant',trigger:{rule:'NEVER'},canActivate:()=>false},talents:[],install:null};
  return {record,controller,kit};
}
