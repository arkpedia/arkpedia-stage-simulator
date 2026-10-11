// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_SNIPER_OPERATORS } from '../../../shared/arkpedia/five-star-sniper-operators.js';
import evidence from '../../../data/arkpedia-five-star-sniper-prefabs.json' with { type: 'json' };
import { resolveHit, effectiveProfile, acquireTargets, performAttack } from '../ai.js';
import { absoluteRangeKeys, tileKeyOf, canTargetEnemy } from '../targeting.js';

const BLUE='char_129_bluep', PLAT='char_204_platnm', METEO='char_219_meteo', PROVE='char_145_prove', CUTTLE='char_218_cuttle';
const live=u=>u.alive&&u.deployed;
const hit=(id,animation='Attack')=>evidence.models[id].front.hits[animation][0];
const windup=(id,animation='Attack')=>(_b,u)=>hit(id,animation)/Math.min(1,u.s.aspd/100);
const radius=key=>evidence.colliders.find(c=>c.group===key).data.m_Radius;
const missile=(b,u,target,p,info,speed,impact=null)=>b.addProjectile({from:u,target,speed,source:u,
  visual:p.projectile||'arrow',hitDead:p.splashRadius>0,data:{arkpediaTrackedVisual:true},
  onHit:({target,x,y})=>{
    // HP filters select an attack target; a projectile already fired still hits.
    if(target&&!canTargetEnemy(u,target,{...p,canTarget:null})){
      if(!(p.splashRadius>0))return;
      target=null;
    }
    if(impact)impact(target,x,y);else resolveHit(b,u,p,target,info,x,y);
  }});

/** Source card aura includes Andreana on the bench and one maxed support. */
export function prepareFiveStarSniperSquad(records){
  const talent=records[CUTTLE]?.talents[0]?.bb;
  if(!talent)return;
  for(const r of Object.values(records))if(r.tags.includes('abyssal'))
    r.stats.attackSpeed+=talent.attack_speed;
}
function blueLaunch(b,u,p,target,info){
  const single={...p,hits:1,hitsFn:null,splashRadius:0};
  missile(b,u,target,single,info,10);
  if(!p.isSkill||u.skill.id!=='skchr_bluep_2'||info.index!==0)return;
  const seq=u.deploySeq,act=u.skill.activations,control=u.attackControlEpoch;
  const valid=()=>u.canAct&&!u.s.flags.disarm&&u.deploySeq===seq&&u.skill.active&&u.skill.activations===act&&u.attackControlEpoch===control;
  let cancelled=false;
  const monitor=b.every(b.dt,()=>{if(!valid())cancelled=true;},{owner:u});
  const component=evidence.characters[BLUE].flatMap(r=>r.components).find(c=>c._limitToOneTargetAfterFirstRound===1);
  for(let n=1;n<u.skill.bb['attack@times'];n++)b.after(n*component._triggerDelta*100/u.s.aspd,()=>{
    if(!cancelled&&valid()&&target.alive)missile(b,u,target,single,info,10);
    if(n===u.skill.bb['attack@times']-1)monitor.cancel();
  },{owner:u});
  if(!(u.skill.bb['attack@times']>1))monitor.cancel();
}
function platinumLaunch(b,u,p,target,info){
  const bb=u.def.talents[0]?.bb;
  let scale=1;
  if(bb){
    const elapsed=b.time-(u.mem.platinumLastRelease??-Infinity);
    const t=Math.max(0,Math.min(1,(elapsed-bb['attack@min_delta'])/(bb['attack@max_delta']-bb['attack@min_delta'])));
    scale=bb['attack@min_atk_scale']+t*(bb['attack@max_atk_scale']-bb['attack@min_atk_scale']);
  }
  u.mem.platinumLastRelease=b.time;
  missile(b,u,target,{...p,atkScale:(p.atkScale??1)*scale},info,6);
}
function meteoriteLaunch(b,u,p,target,info){
  const talent=u.def.talents[0]?.bb,crit=!!(talent&&b.rng.chance(talent.prob));
  const armed=u.skill.active,seq=u.deploySeq,activation=u.skill.activations;
  const projectile=missile(b,u,target,p,info,8,(t,x,y)=>{
    const key=`meteorite:crit:${u.id}:${info.attackId}`;
    if(crit)b.addBuff(u,{key,mods:{atkPct:talent.atk},allowDead:true});
    if(p.isSkill&&u.skill.id==='skchr_meteo_2'){
      // Serialized activeBuffs apply at impact. Pre-damage ordering is also
      // corroborated by the independent calculator; native C# order is pending.
      for(const victim of b.foesInRadius(x,y,p.splashRadius,true))
        if(canTargetEnemy(u,victim,{...p,canTarget:null}))
          b.applyStrongest(victim,'meteorite:def-down',{duration:u.skill.bb.duration,
            value:u.skill.bb.def,source:u,mods:value=>({defFlat:value})});
    }
    try{resolveHit(b,u,p,t,info,x,y);}finally{if(crit)b.removeBuff(u,key);}
  });
  if(!armed)return;
  // Original next-attack skills hold SP and normal attacks through both the
  // full cast clip and the projectile lifecycle, including a fizzled target.
  const finishAt=u.skill.lastStart+evidence.models[METEO].front.animations.Skill/Math.min(1,u.s.aspd/100);
  b.addBuff(u,{key:'meteorite:cast',flags:{disarm:true}});
  const watcher=b.every(b.dt,()=>{
    if(!live(u)||u.deploySeq!==seq||!u.skill.active||u.skill.activations!==activation){watcher.cancel();return;}
    if(b.time+1e-9>=finishAt&&!b.projectiles.list.includes(projectile)){
      u.skill.end('projectile');watcher.cancel();
    }
  },{owner:u});
}
function immediate(b,u){
  const p=effectiveProfile(u),targets=acquireTargets(b,u,p);
  if(targets.length)performAttack(b,u,p,targets);else u.skill.end('no-target');
}

export function customizeFiveStarSniperKit({id,def,kit}){
  if(!FIVE_STAR_SNIPER_OPERATORS[id])return;
  const s=def.skill,bb=s.bb;
  kit.install=null;
  kit.trait={attack:'ranged',dmgType:'phys',projectile:'arrow',canHitFly:true,hits:1,hitsFn:null,
    maxTargets:1,allInRange:false,splashRadius:0,dmgMul:null,chain:null,install:null,
    windup:windup(id),attackVisual:'Attack',interruptOnSkillChange:true};
  const duration=mods=>({kind:'duration',mods});
  if(id===BLUE){
    Object.assign(kit.trait,{priority:'fly',launchAttack:blueLaunch});
    kit.skill=s.id.endsWith('_1')?{kind:'instant',targeting:{maxTargets:2},attack:{atkScale:bb.atk_scale,
      windup:(_b,u)=>hit(id)*100/u.s.aspd}}
      :{...duration({atkPct:bb.atk}),targeting:{maxTargets:3}};
  }else if(id===PLAT){
    Object.assign(kit.trait,{priority:'fly',launchAttack:platinumLaunch});
    kit.skill=s.id.endsWith('_2')?{kind:'toggle',mods:{atkPct:bb.atk,aspd:bb.attack_speed},
      trigger:{rule:'SP_FULL'},targeting:{rangeGrid:s.rangeGrid},
      attack:{windup:windup(id,'Skill'),attackVisual:'Skill'}}:duration({atkPct:bb.atk});
  }else if(id===METEO){
    Object.assign(kit.trait,{splashRadius:radius('projectile_meteo'),launchAttack:meteoriteLaunch});
    const second=s.id.endsWith('_2');
    kit.skill={kind:'toggle',attack:{atkScale:bb.atk_scale,splashRadius:radius(second?'projectile_meteo_s2':'projectile_meteo_s1'),
      windup:windup(id,'Skill'),attackVisual:'Skill'},
      ...(second?{onStart:({battle,unit})=>immediate(battle,unit)}:{}),
      onEnd:({battle,unit})=>battle.removeBuff(unit,'meteorite:cast')};
  }else if(id===PROVE){
    Object.assign(kit.trait,{projectileSpeed:10,priority:'first'});
    kit.skill=s.id.endsWith('_1')?{kind:'passive',attack:{dmgMul:(_b,_u,t)=>1+(1-t.hpRatio)/bb.hp_ratio_drop*bb.atk_scale_up}}
      :{...duration({atkPct:bb.atk}),attack:{canTarget:(_u,t)=>t.hpRatio<=.800000011920929}};
  }else{
    Object.assign(kit.trait,{projectileSpeed:15,priority:'lowDef'});
    kit.skill=s.id.endsWith('_2')?{...duration({atkPct:bb.atk}),attack:{canTarget:(_u,t)=>t.hpRatio>=.5,
      attackVisual:'Skill2_Loop',onEachHit:({battle,unit,target})=>{
        if(target.alive)battle.applyStrongest(target,'andreana:slow',{duration:bb['attack@duration'],
          value:bb['attack@move_speed'],source:unit,mods:value=>({moveMul:1+value})});
      }}}:duration({atkPct:bb.atk});
  }
}
export function installFiveStarSniper({battle:b,unit:u,def}){
  if(!FIVE_STAR_SNIPER_OPERATORS[def.charId])return;
  const talent=def.talents[0]?.bb;
  if(def.charId===BLUE&&talent){
    u.profile.onEachHit=(battle,source,target)=>{
      if(!target.alive)return;
      battle.addBuff(target,{key:`blue-poison:${source.id}`,duration:talent.duration,
        refresh:'extend',interval:1,source,onTick:()=>battle.dealDamage(source,target,{amount:talent.poison_damage,
          type:'arts',canDodge:false,sourceless:true,isAttack:false,isSkill:false,tags:['poison'],applyWay:'none'})});
    };
  }else if(def.charId===PROVE&&talent){
    b.on('hit',({source,target,dmg})=>{
      if(source!==u||!dmg.isAttack||target.side!=='enemy')return;
      const front=new Set(absoluteRangeKeys([[0,1]],u.tileR,u.tileC,u.dir));
      if(b.rng.chance(front.has(tileKeyOf(target))?talent.prob2:talent.prob))dmg.amount*=talent.atk_scale;
    },{owner:u});
  }
}
