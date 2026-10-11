// SPDX-License-Identifier: GPL-3.0-or-later
// Original components, templates, models and native dispatch limitations are
// retained in data/arkpedia-six-star-medic-prefabs.json.
import { SIX_STAR_MEDIC_OPERATORS } from '../../../shared/arkpedia/six-star-medic-operators.js';
import evidence from '../../../data/arkpedia-six-star-medic-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { RESIST_STATUSES } from '../buffs.js';

const SHINING='char_147_shining', NIGHTINGALE='char_179_cgbird', LUMEN='char_4042_lumen';
const live=a=>a?.alive&&a.deployed&&!a.hidden;
const model=u=>evidence.models[u.defId][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const grid=id=>evidence.rangeTable[id].grids.map(p=>[p.row,p.col]);
const rate=u=>Math.min(1,u.s.aspd/100);
const timed=clip=>(_b,u)=>model(u).hits[clip][0]/rate(u);
const auraAlly=(b,a,u)=>live(a)&&a.kind!=='device'&&!a.s.flags.untargetable&&b.allySelectable(a,u);
const healable=(b,a,u)=>auraAlly(b,a,u)&&!a.s.flags.healFree&&(a===u||!(a.s.flags.noHeal||a.profile?.noHeal));
const abnormal=a=>a.buffs.some(x=>RESIST_STATUSES.has(x.status)||x.status==='palsy');
const inner=u=>new Set(absoluteRangeKeys(grid('2-3'),u.tileR,u.tileC,u.dir));
function allies(b,u,{count=1,ground=false,priority=false,injured=true}={}){
 const out=b.allyUnits.filter(a=>healable(b,a,u)&&bodyInKeys(a,u.rangeKeySet)
   &&(!ground||!a.isFlying)&&(!injured||a.hp<a.s.maxHp-.01||priority&&abnormal(a)));
 out.sort((a,c)=>Number(priority&&abnormal(c))-Number(priority&&abnormal(a))||a.hpRatio-c.hpRatio||a.deploySeq-c.deploySeq);
 return out.slice(0,count+Math.max(0,Math.floor(u.s.maxTargets)));
}
function setMods(b,a,key,source,value){
 const old=a.findBuff(key);
 if(!value)b.removeBuff(a,key);
 else if(!old||old.source!==source||JSON.stringify(old.mods)!==JSON.stringify(value))b.addBuff(a,{key,source,mods:value});
}
function syncShining(b){
 for(const a of b.allyUnits){
  let talent=null,skill=null;
  for(const {u,def}of b._arkpediaShining.values())if(live(u)&&auraAlly(b,a,u)&&bodyInKeys(a,u.rangeKeySet)){
   const t=def.talents[0]?.bb.def;
   if(t!=null&&(!talent||t>talent.value))talent={u,value:t};
   if(u.skill.active&&u.skill.id==='skchr_shining_3'&&(!skill||def.skill.bb.def>skill.value))skill={u,value:def.skill.bb.def};
  }
  setMods(b,a,'char_shining_t_def',talent?.u,talent?{defFlat:talent.value}:null);
  setMods(b,a,'shining_s_3',skill?.u,skill?{defPct:skill.value}:null);
 }
}
function syncNightingale(b,u,def){
 const t=def.talents[0]?.bb.magic_resistance;
 for(const a of b.allyUnits){
  const eligible=live(u)&&auraAlly(b,a,u)&&bodyInKeys(a,u.rangeKeySet);
  setMods(b,a,`cgbird_t_1:${u.id}`,u,eligible&&t!=null?{resFlat:t}:null);
  setMods(b,a,`cgbird_s_3:${u.id}`,u,eligible&&u.skill.active&&u.skill.id==='skchr_cgbird_3'
   ?{resPct:def.skill.bb.magic_resistance,dodgeArts:def.skill.bb.prob}:null);
 }
}
function protection(b,u,a,s,arts){
 if(!healable(b,a,u))return;
 const key=arts?`cgbird_s_2:${u.id}`:'shining_s_2';
 // Native shield finishes its entire buff as soon as its dynamic value reaches
 // zero; generic shields retain attached modifiers, so this source opts in.
 b.removeBuff(a,key);let handle;
 const shield=b.addBuff(a,{key,source:u,duration:s.bb.duration,
  shield:u.s.atk*s.bb.atk_scale,...(arts?{shieldTypes:['arts']}:{}),
  mods:arts?{resFlat:s.bb.magic_resistance}:{defPct:s.bb.def},onRemove:()=>b.off(handle)});
 handle=b.on('damaged',({target})=>{if(target===a&&shield.shield<=1e-9)b.removeBuff(a,shield);});
}
function lumenHeal(b,u,a,amount){
 if(!healable(b,a,u))return;
 const far=bodyInKeys(a,inner(u))?1:u.def.traitBb.heal_scale;
 b.heal(u,a,amount*far);
}
function purify(b,a){
 for(const x of a.buffs.slice())if(RESIST_STATUSES.has(x.status)||x.status==='palsy')b.removeBuff(a,x);
}
function flight(b,u,a,fn){
 b.addProjectile({from:u,target:a,source:u,speed:8,visual:'heal',data:{arkpediaTrackedVisual:true},
  onHit:()=>{if(healable(b,a,u))fn(a);}});
}
function syncDrizzle(b,u){
 const zones=u.mem.lumenZones,key=`lumen:drizzle:${u.id}`;
 for(const a of b.allyUnits){
  const zone=live(u)&&healable(b,a,u)?[...zones.values()].filter(z=>u.deploySeq===z.seq
   &&b.time<z.expires-1e-9&&bodyInKeys(a,z.keys)).at(-1):null;
  const old=a.findBuff(key);
  if(!zone)b.removeBuff(a,key);
  else if(old?.data.zone!==zone.id){
   b.addBuff(a,{key,source:u,interval:zone.s.bb['aura.interval'],duration:zone.expires-b.time,data:{zone:zone.id},
    onTick:()=>{if(live(u)&&u.deploySeq===zone.seq&&b.time<zone.expires-1e-9
      &&healable(b,a,u)&&bodyInKeys(a,zone.keys)&&a.hp<a.s.maxHp-.01)
       lumenHeal(b,u,a,u.s.atk*zone.s.bb['aura.heal_scale']);}});
  }
 }
}
function drizzle(b,u,target,s){
 const zones=u.mem.lumenZones??=new Map(),id=++u.mem.lumenDrizzleSeq;
 const zone={id,s,seq:u.deploySeq,expires:b.time+s.bb['aura.projectile_life_time'],
  keys:new Set(absoluteRangeKeys(grid('x-4'),target.tileR,target.tileC,'RIGHT'))};
 zones.set(id,zone);
 const sync=()=>syncDrizzle(b,u),watch=b.every(b.dt,sync,{owner:u});sync();
 b.after(zone.expires-b.time,()=>{zones.delete(id);sync();watch.cancel();},{owner:u});
 b.on('death',({unit})=>{if(unit===u){zones.delete(id);sync();watch.cancel();}},{owner:u});
}
function castLumen(b,u,s){
 const enhanced=u.skill.charges>=1; // activation has already consumed one charge
 u.skill.setSpTotal(0); // literal ClearCharacterSp, including partial second charge
 const targets=allies(b,u,{count:s.bb.max_target}),seq=u.deploySeq,act=u.skill.activations;
 const total=model(u).durations.Skill_2/rate(u),release=model(u).hits.Skill_2[0]/rate(u);let cancelled=false;
 u.mem.regularFormVisual={clip:'Skill_2',loop:false};
 b.addBuff(u,{key:'lumen:cast',source:u,duration:total,flags:{disarm:true,noSp:true}});
 const controlEpoch=u.attackControlEpoch;
 const valid=()=>!cancelled&&live(u)&&u.deploySeq===seq&&u.skill.activations===act&&u.canAct
  &&u.attackControlEpoch===controlEpoch;
 const stop=()=>{cancelled=true;if(u.deploySeq===seq&&u.skill.activations===act){b.removeBuff(u,'lumen:cast');u.mem.regularFormVisual=null;}};
 const watch=b.every(b.dt,()=>{if(!valid()){stop();watch.cancel();}},{owner:u});
 b.after(release,()=>{
  watch.cancel();if(!valid()){stop();return;}
  for(const a of targets)if(healable(b,a,u)){lumenHeal(b,u,a,u.s.atk*s.bb.heal_scale);if(enhanced)purify(b,a);}
 },{owner:u});
 b.after(total,()=>{if(u.deploySeq===seq&&u.skill.activations===act){u.mem.regularFormVisual=null;b.removeBuff(u,'lumen:cast');}},{owner:u});
}
function lanternForm(b,u,end=false){
 const seq=u.deploySeq,act=u.skill.activations,clip=end?'Skill_3_End':'Skill_3_Begin';
 if(!live(u)){u.mem.regularFormVisual=null;return;}
 u.mem.regularFormVisual={clip,loop:false};
 b.after(model(u).durations[clip],()=>{
  if(u.deploySeq===seq&&u.skill.activations===act)
   u.mem.regularFormVisual=end?null:u.skill.active?{clip:'Skill_3_Idle',loop:true}:null;
 },{owner:u});
}
export function customizeSixStarMedicKit({battle:b,id,def,unit:u,kit}){
 if(!SIX_STAR_MEDIC_OPERATORS[id])return;
 kit.install=null;const s=def.skill,bb=s.bb,index=SIX_STAR_MEDIC_OPERATORS[id].skillIds.indexOf(s.id);
 const count=id===NIGHTINGALE?3:1;
 kit.trait={attack:'ranged',dmgType:'heal',projectile:'none',canHitFly:true,maxTargets:1,
  heal:{mode:count===3?'multi':'single',count,scaleForTarget:(b,u,a)=>healable(b,a,u)?1:0},acquireTargets:(b,u)=>allies(b,u,{count,ground:id===LUMEN}),
  attackVisual:'Attack',windup:timed('Attack'),interruptOnSkillChange:true,install:null};
 if(id===SHINING||id===NIGHTINGALE){
  kit.skill=index===1?{kind:'charges',heal:true,
   onAttack:({targets,skill})=>{if(targets.every(a=>!a.alive||!a.deployed))skill.setSpTotal(skill.spTotal+skill.spCost);},
   attack:{afterHeal:(_b,_u,a)=>protection(b,u,a,s,id===NIGHTINGALE)}}
   :{kind:'duration',duration:s.duration,mods:{atkPct:bb.atk,...(id===SHINING&&index===0?{aspd:bb.attack_speed}:{})},
    ...(index===2?{targeting:s.rangeGrid?{rangeGrid:s.rangeGrid}:undefined,
     onStart:()=>id===SHINING?syncShining(b):syncNightingale(b,u,def),
     onEnd:()=>{
      // SkillRuntime clears `active` before onEnd but removes its range after
      // this callback. Refresh now so source auras detach from expanded-only
      // recipients in the same skill-end operation, not on the following tick.
      b._refreshRange(u);
      id===SHINING?syncShining(b):syncNightingale(b,u,def);
     }}:{})};
 }else{
  u.mem.lumenDrizzleSeq=0;
  kit.trait.heal=null;
  kit.trait.launchAttack=(_b,_u,_p,a)=>flight(b,u,a,t=>lumenHeal(b,u,t,u.s.atk));
  kit.skill=index===0?{kind:'instant',heal:true,
   attack:{attackVisual:'Skill_1',windup:timed('Skill_1'),launchAttack:(_b,_u,_p,a)=>flight(b,u,a,t=>{
     lumenHeal(b,u,t,u.s.atk);drizzle(b,u,t,s);})}}
   :index===1?{kind:'charges',heal:true,onStart:()=>castLumen(b,u,s)}
   :{kind:'ammo',ammo:bb['attack@trigger_time'],manualCancel:true,heal:true,mods:{atkPct:bb.atk,aspd:bb.attack_speed},
    attack:{attackVisual:'Skill_3_Loop',windup:timed('Skill_3_Loop'),
     acquireTargets:(b,u)=>allies(b,u,{ground:true,priority:true}),
     launchAttack:(_b,_u,_p,a)=>{
      const special=abnormal(a),act=u.skill.activations;
      flight(b,u,a,t=>{
       lumenHeal(b,u,t,u.s.atk*(special?bb.heal_scale:1));
       if(special){purify(b,t);
        if(u.skill.active&&u.skill.activations===act){u.skill.ammoLeft--;if(u.skill.ammoLeft<=0)u.skill.end('ammo');}}
      });
     }},onAttack:ctx=>{ctx.noAmmo=true;},onStart:()=>lanternForm(b,u),onEnd:()=>lanternForm(b,u,true)};
 }
 kit.skill.id=s.id;kit.skill.name=s.name;
}
export function installSixStarMedic({battle:b,unit:u,def}){
 if(!SIX_STAR_MEDIC_OPERATORS[def.charId])return;
 if(def.charId===SHINING){
  (b._arkpediaShining??=new Map()).set(u.id,{u,def});
  const sync=()=>syncShining(b);for(const ev of['deploy','death','tick'])b.on(ev,sync,{owner:u});
  const aspd=def.talents[1]?.bb.attack_speed;
  if(aspd!=null)b.addBuff(u,{key:'shining:code-of-law',source:u,mods:{aspd},allowDead:true,persist:true});
 }else if(def.charId===NIGHTINGALE){
  const sync=()=>syncNightingale(b,u,def);for(const ev of['deploy','death','tick'])b.on(ev,sync,{owner:u});
 }else{
  const talent=def.talents[0]?.bb,quick=def.talents[1]?.bb;
  if(talent)b.on('heal',({source,target,opts})=>{
   if(source!==u||opts.regen||!healable(b,target,u))return;
   const special=target.hpRatio>=talent.hp_ratio-1e-9;
   b.applyStatus(target,'resist',{key:`lumen:resist:${u.id}`,source:u,
    duration:talent[special?'lumen_t_1[special].status_resistance[limit]':'status_resistance[limit]'],
    value:-talent[special?'lumen_t_1[special].one_minus_status_resistance':'one_minus_status_resistance']});
  },{owner:u});
  if(quick){
   b.on('deploy',({unit})=>{if(unit===u)u.mem.lumenQuickReadyAt=b.time+quick.duration;},{owner:u});
   b.on('statusApplied',({target,status})=>{
    if(!RESIST_STATUSES.has(status)||!live(u)||b.time<(u.mem.lumenQuickReadyAt??Infinity)-1e-9
      ||!healable(b,target,u)||target.hp>=target.s.maxHp-.01||!bodyInKeys(target,u.rangeKeySet))return;
    u.mem.lumenQuickReadyAt=b.time+quick.duration;
    lumenHeal(b,u,target,u.s.atk*quick.heal_scale);
   },{owner:u});
  }
 }
}
/** The original Mirage talent is attached in dummy and begins periodic PURE
 * HP loss at one second. Birth is immediate (_useRealBornTimeFromAnim0), while
 * its original Start1.333 remains presentation. */
export function installNightingaleCage(b,token,state){
 const t=state.record.talents[0].bb;
 b.addBuff(token,{key:'bird_t_1[evade]',source:token,mods:{dodgePhys:t.prob},persist:true});
 b.addBuff(token,{key:'bird_t_1[drop]',source:token,interval:1,persist:true,
  onTick:()=>{if(live(token))b.loseHp(token,token.s.maxHp*t.hp_ratio,{source:token,tags:['cage:decay']});}});
}
