// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs are retained in arkpedia-vigil-prefabs.json. Dispatcher bounds
// are explicit: instant S1/S2, first-event S3 burst, separate per-head receipts.
import evidence from '../../../data/arkpedia-vigil-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const ID = 'char_427_vigil', TOKEN = 'token_10028_vigil_wolf';
const DERIVED = 'vigil:skip-source-calculate';
const INACTIVE = 'vigil:inactive', BLOCK = 'vigil_wolf_t_1[block_cnt]';
const S2 = 'vigil_wolf_s_2', MARK = 'vigil_wolf_s_3[mark]';
const present = u => u?.alive && u.deployed;
const owned = (b,u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && present(t));
const ownBlock = (u,e) => e.blockedBy?.ownerUnit === u && e.blockedBy.defId === TOKEN;
const model = u => evidence.models[ID][['UP','LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1,u.base.bat/u.s.interval);
const profile = { canHitFly: false };
const s3Active = u => present(u) && u.skill?.active && u.skill.id === 'skchr_vigil_3';
function candidates(b,t) {
  const range = absoluteRangeKeys(t.def.rangeGrid,t.tileR,t.tileC,'RIGHT');
  const rows = b.enemies.filter(e => canTargetEnemy(t,e,profile) && (bodyInKeys(e,range) || e.blockedBy === t));
  sortEnemyTargets(b,t,rows); return rows;
}
function derived(b,u,e,amount,type,info,applyWay) {
  return b.dealDamage(u,e,{ amount,type,isAttack:true,isSkill:!!info.isSkill,
    attackId:info.attackId,applyWay,tags:[DERIVED] });
}
function mark(b,t) {
  if(s3Active(t.ownerUnit)) b.addBuff(t,{ key:MARK,source:t.ownerUnit,data:{
    scale:t.ownerUnit.def.skill.bb['attack@vigil_s_3.atk_scale'] } });
}
function commandVisual(b,u,clip) {
  const visual = { clip,loop:false }; u.mem.regularFormVisual = visual;
  b.after(model(u).durations[clip],() => {
    if(u.mem.regularFormVisual === visual) u.mem.regularFormVisual = null;
  },{owner:u});
}
export function customizeVigilKit({battle:b,id,def,unit:u,kit}) {
  if(id !== ID) return;
  const s = def.skill, s3 = s.id === 'skchr_vigil_3';
  u.mem.vigilAttackClips = new Map(); u.mem.vigilCycle = 0;
  kit.install = null;
  kit.trait = { attack:'ranged',dmgType:'phys',projectile:'arrow',projectileSpeed:10,
    canHitFly:true,maxTargets:1,hits:1,hitAllBlocked:false,install:null,
    retargetOnRelease:true,interruptOnSkillChange:true,
    attackVisual:(battle,a) => a.mem.vigilAttackClips.get(battle._attackSeq)?.clip ?? 'Attack',
    windup:(battle,a) => {
      const active=s3Active(a),clip=active?`Skill3_Attack_${'ABC'[a.mem.vigilCycle++%3]}`:'Attack';
      const seq=battle._attackSeq;
      a.mem.vigilAttackClips.set(seq,{clip,active});
      const release=model(a).eventPayloads[clip][0].time/rate(a);
      battle.after(release+battle.dt,()=>a.mem.vigilAttackClips.delete(seq),{owner:a});
      return release;
    },
    launchAttack:(battle,a,p,e,info) => {
      const shot=a.mem.vigilAttackClips.get(info.attackId);
      if(!shot || !canTargetEnemy(a,e,p)) return;
      for(let i=0;i<(shot.active?3:1);i++) battle.addProjectile({ from:a,target:e,source:a,
        speed:10,maxAge:10,visual:'arrow',data:{arkpediaTrackedVisual:true},
        onHit:({target:v}) => {
          if(!v || !canTargetEnemy(a,v,p)) return;
          battle.dealDamage(a,v,{amount:a.s.atk,type:'phys',isAttack:true,
            isSkill:shot.active,attackId:info.attackId,applyWay:'ranged'});
          // The born projectile carries its selected coefficient; the native
          // onStart conditional is evaluated at impact, even after owner removal.
          if(shot.active && v.alive && ownBlock(a,v))
            derived(battle,a,v,a.s.atk*s.bb['attack@vigil_s_3.atk_scale'],'arts',
              {...info,isSkill:true},'ranged');
        } });
      a.mem.vigilAttackClips.delete(info.attackId);
    } };
  kit.skill = {id:s.id,name:s.name,kind:s3?'duration':'instant',duration:s.duration,
    trigger:{rule:s3?'NEVER':'SP_FULL'},
    onStart:() => {
      if(s3) { u.mem.vigilCycle=0;u.mem.vigilDpClock=0;u.mem.vigilDpPulses=0;
        for(const t of owned(b,u)) mark(b,t); return; }
      b.addDp(u.ownerId,s.bb.cost);commandVisual(b,u,s.id.endsWith('_1')?'Skill1':'Skill2');
      for(const t of owned(b,u)) {
        if(s.id.endsWith('_1')) t.mem.vigilEnhance();
        else b.addBuff(t,{key:S2,source:u,data:{atk_scale:s.bb['vigil_wolf_s_2.atk_scale'],
          hp_ratio:s.bb['vigil_wolf_s_2.hp_ratio'],cost:s.bb['vigil_wolf_s_2.cost']}});
      }
    },
    onTick:({dt}) => {
      u.mem.vigilDpClock+=dt;
      // Source intervals are rounded to milliseconds. Half a simulation tick
      // admits the final 15.003s pulse at the 15s boundary, never a start burst.
      while(u.mem.vigilDpPulses<s.bb.value &&
        u.mem.vigilDpClock+b.dt/2>=s.bb.interval*(u.mem.vigilDpPulses+1)) {
        u.mem.vigilDpPulses++;b.addDp(u.ownerId,s.bb.cost);
      }
    },
    onEnd:() => { if(s3)for(const t of owned(b,u)) b.removeBuff(t,MARK); },
  };
}
export function installVigil({battle:b,unit:u,def}) {
  if(def.charId !== ID) return;
  b.on('deploy',({unit}) => {
    if(unit !== u) return;
    const state=b.regularSummons?.get(`summon:${ID}`);
    if(state?.owner !== u || def.talents[0]?.bb.cnt !== 1) throw Error('Missing Vigil born stock source');
    state.stock=1;
  },{owner:u});
  b.on('beforeAttack',({attacker}) => {if(attacker===u)u.mem.regularFormVisual=null;},{owner:u});
  b.on('hit',ctx => {
    if(ctx.source!==u || ctx.dmg.tags?.includes(DERIVED) || !ownBlock(u,ctx.target)) return;
    ctx.dmg.amount*=def.traitBb.atk_scale;
    ctx.dmg.defIgnoreFlat=(ctx.dmg.defIgnoreFlat??0)+(def.talents[1]?.bb.def_penetrate_fixed??0);
  },{owner:u});
}
export function createWolfpack(b,state,row,col) {
  const record=state.record, talent=record.talents[0]?.bb;
  if(record.id!==TOKEN || ![25,27,30].includes(talent?.interval) || talent.block_cnt!==1)
    throw Error('Missing reviewed Wolfpack source');
  const t=b.spawnToken(state.owner,TOKEN,row,col,{dir:'RIGHT',def:record,kit:{skill:null,
    trait:{attack:'melee',dmgType:'phys',projectile:'none',canHitFly:false,maxTargets:1,
      hits:1,hitAllBlocked:false,install:null,retargetOnRelease:true,
      canAttack:(_b,a)=>a.mem.vigilMode===1,
      acquireTargets:(battle,a)=>candidates(battle,a).slice(0,1),
      attackEpoch:(_b,a)=>a.mem.vigilModeEpoch,attackVisual:'Attack',
      windup:(_b,a)=>evidence.models[TOKEN].Original.eventPayloads.Attack[0].time/rate(a),
      launchAttack:(battle,a,p,e,info)=>{
        if(!canTargetEnemy(a,e,p))return;
        const heads=a.mem.vigilHeads,charge=a.findBuff(S2),arts=a.findBuff(MARK);
        // One ability cast selects one victim. Each head has a separate physical
        // receipt; source-disabled extras do not replay S2 scaling or T2 penetration.
        if(charge)battle.heal(a,a,a.s.maxHp*charge.data.hp_ratio,
          {self:true,ignoreHealFree:true});
        const pen=e.blockedBy ? record.talents[1]?.bb.def_penetrate_fixed??0 : 0;
        for(let i=0;i<heads && e.alive;i++) {
          battle.dealDamage(a,e,{amount:a.s.atk*(i===0 ? charge?.data.atk_scale??1 : 1),type:'phys',
            isAttack:true,isSkill:!!charge,attackId:info.attackId,applyWay:'melee',
            defIgnoreFlat:i===0?pen:0,tags:i?[DERIVED]:[]});
          if(arts && e.alive && e.blockedBy===a)
            derived(battle,a,e,state.owner.s.atk*arts.data.scale,'arts',
              {...info,isSkill:true},'melee');
        }
        if(charge) {
          if(!e.alive)battle.addDp(state.owner.ownerId,charge.data.cost);
          // Finish the captured charge only; a later command cannot be consumed.
          if(a.findBuff(S2)===charge)battle.removeBuff(a,S2);
        }
      }},
    install:(battle,a)=>battle.addBuff(a,{key:'vigil_wolf_healfree',
      flags:{healFree:true},persist:true,allowDead:true})}});
  if(!t)return null;
  t.deploymentSlotCost=0;t.mem.regularSummonCard=state.key;
  t.mem.vigilHeads=0;t.mem.vigilMode=0;t.mem.vigilModeEpoch=0;t.mem.vigilGeneration=0;
  let growth=null;
  const block=()=>b.addBuff(t,{key:BLOCK,mods:{blockCnt:t.mem.vigilHeads}});
  const fullHeal=()=>b.heal(t,t,t.s.maxHp,{self:true,ignoreHealFree:true,skipModifierEvent:true});
  const scheduleGrowth=()=>{
    growth?.cancel();growth=null;
    if(!present(t)||t.mem.vigilMode!==1||t.mem.vigilHeads>=3)return;
    growth=b.after(talent.interval,()=>{
      if(!present(t)||t.mem.vigilMode!==1)return;
      t.mem.vigilHeads++;block();scheduleGrowth();
    },{owner:t});
  };
  const activate=()=>{
    if(!present(t)||!present(state.owner))return;
    b.removeBuff(t,INACTIVE);t.mem.vigilMode=1;t.mem.vigilModeEpoch++;
    // Initial point starts with two heads; rebirth restores the base head only.
    t.mem.vigilHeads=t.mem.vigilBorn?1:2;t.mem.vigilBorn=true;
    fullHeal();block();t.atkCd=0;
    t.mem.regularFormVisual={clip:'Idle_1',loop:true,attack:'Attack',die:'Die'};
    mark(b,t);scheduleGrowth();
  };
  const warm=()=>{
    if(!present(t)||!present(state.owner))return;
    const gen=++t.mem.vigilGeneration;t.mem.vigilMode='warming';t.mem.vigilModeEpoch++;
    t.mem.vigilReadyAt=b.time+1;t.mem.regularFormVisual={clip:'Start',loop:false,die:'Die'};
    b.after(1,()=>{if(gen===t.mem.vigilGeneration)activate();},{owner:t});
  };
  const rest=(restore=true)=>{
    if(!present(t)||t.mem.vigilMode!==1)return;
    growth?.cancel();growth=null;
    const gen=++t.mem.vigilGeneration;t.mem.vigilMode=0;t.mem.vigilHeads=0;t.mem.vigilModeEpoch++;
    b.removeBuff(t,BLOCK);b.releaseBlocked(t);
    b.addBuff(t,{key:INACTIVE,flags:{invulnerable:true,untargetable:true,isolated:true,
      noHeal:true,noSp:true,disarm:true},mods:{blockCntMul:0}});
    if(restore)t.hp=1;
    t.mem.vigilReadyAt=b.time+talent.interval+1;
    t.mem.regularFormVisual={clip:'Die',loop:false,die:'Die'};
    b.after(evidence.models[TOKEN].Original.durations.Die,()=>{
      if(present(t)&&gen===t.mem.vigilGeneration)
        t.mem.regularFormVisual={clip:'Idle_2',loop:true,die:'Die'};
    },{owner:t});
    b.after(talent.interval,()=>{if(present(t)&&gen===t.mem.vigilGeneration)warm();},{owner:t});
  };
  t.mem.metalCrabRest=rest;
  t.mem.vigilEnhance=()=>{
    if(t.mem.vigilMode===0)warm();
    else if(t.mem.vigilMode===1){
      if(t.mem.vigilHeads>=3)fullHeal();
      else{t.mem.vigilHeads++;block();if(t.mem.vigilHeads===3){growth?.cancel();growth=null;}}
    }
  };
  b.on('fatal',ctx=>{
    if(ctx.unit!==t||t.mem.vigilMode!==1)return;
    ctx.prevented=true;
    if(t.mem.vigilHeads>1){t.mem.vigilHeads--;block();scheduleGrowth();}
    else rest(false);
    // Keep HP-loss accounting before the native POST_TRY_SET_HP_ZERO repair.
    ctx.afterHpLoss=()=>{if(t.mem.vigilMode===0)t.hp=1;else fullHeal();};
  },{owner:t});
  b.on('death',({unit})=>{if(unit===t)growth?.cancel();},{owner:t});
  b.addBuff(t,{key:INACTIVE,flags:{invulnerable:true,untargetable:true,isolated:true,
    noHeal:true,noSp:true,disarm:true},mods:{blockCntMul:0}});
  warm();return t;
}
