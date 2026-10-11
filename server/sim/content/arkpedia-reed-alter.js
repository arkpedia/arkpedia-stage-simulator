// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs and explicit dispatch limits: arkpedia-reed-alter-prefabs.json.
import evidence from '../../../data/arkpedia-reed-alter-prefabs.json' with {type:'json'};
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyDist } from '../body.js';
import { isHpLoss } from '../damage.js';
const ID='char_1020_reed2', CINDER='reed2:cinder', FRAGILE='reed2:cinder-fragile', TAU=Math.PI*2;
const live=a=>a?.alive && a.deployed && !a.hidden && !a._removing;
const third=u=>live(u) && u.skill.active && u.skill.id==='skchr_reed2_3';
const talent=u=>u.def.talents.find(t=>t.bb.prob!=null)?.bb;
const reflected=u=>u.def.talents.find(t=>t.bb.scale!=null)?.bb.scale ?? 0;
const dotKey=u=>`reed2:dot:${u.id}`;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const event=(m,clip)=>m.eventPayloads[clip].find(e=>e.name==='OnAttack').time;
const rate=u=>Math.min(1,u.s.aspd/100);
const healable=(b,u,a)=>live(a) && a.kind!=='device' && !a.s.flags.untargetable
  && !a.s.flags.healFree && b.allySelectable(a,u)
  && (a===u || !(a.s.flags.noHeal || a.profile?.noHeal));
const recipient=(b,u)=>b.allyUnits.filter(a=>healable(b,u,a) && bodyInKeys(a,u.rangeKeySet))
  .sort((a,z)=>a.hpRatio-z.hpRatio || a.deploySeq-z.deploySeq)[0];
function hosts(b,u) {
  // Native postFilter47/professionMask639 mapped to ground-first operators,
  // then HP ratio/deployment order. Heal-free hosts retain damage, not healing.
  return b.allyUnits.filter(a=>live(a) && a.kind==='op' && !a.s.flags.untargetable
    && b.allySelectable(a,u) && bodyInKeys(a,u.rangeKeySet))
    .sort((a,z)=>Number(a.def.position!=='MELEE')-Number(z.def.position!=='MELEE')
      || a.hpRatio-z.hpRatio || a.deploySeq-z.deploySeq)
    .slice(0,u.skill.bb.max_target);
}
function mark(b,u,e,enhanced=false) {
  const t=talent(u);if (!t || !live(e)) return;
  const old=e.findBuff(CINDER),bb=u.skill.bb;
  const candidate={owner:u,enhanced,atk:t.atk,scale:t.damage_scale,
    aoe:enhanced?bb['talent@aoe_scale']:0,radius:enhanced?bb['talent@range_radius']:0};
  // One shared holder; equal/weaker producers extend the incumbent. Independent
  // S3 DOTs do not steal its diffusion ownership or compound the ATK debuff.
  const stronger=!old || (enhanced && !old.data.enhanced)
    || enhanced===old.data.enhanced && (enhanced?candidate.aoe>old.data.aoe:candidate.scale>old.data.scale);
  if (!stronger) {
    if (!old.data.enhanced) {
      old.timeLeft=Math.max(old.timeLeft,t.duration);
      const fragile=e.findBuff(FRAGILE);if(fragile)fragile.timeLeft=old.timeLeft;
    }
    return;
  }
  const applied=b.addBuff(e,{key:CINDER,source:u,duration:enhanced?Infinity:t.duration,
    mods:{atkPct:t.atk},data:candidate,onRemove:()=>b.removeBuff(e,FRAGILE)});
  // Arts Fragility competes with other producers independently of ATK reduction.
  if(applied)b.applyStatus(e,'artsFragile',{key:FRAGILE,source:u,duration:enhanced?Infinity:t.duration,value:t.damage_scale-1});
}
function ignite(b,u,e) {
  if (!third(u) || !live(e) || !talent(u)) return;
  mark(b,u,e,true);
  if (e.findBuff(dotKey(u))) return; // EXTEND retains the existing tick cadence
  const clock={next:b.time+.2,seq:u.deploySeq};
  b.addBuff(e,{key:dotKey(u),source:u,data:clock,onTick:()=>{
    if (!third(u) || u.deploySeq!==clock.seq) return;
    while(live(e) && b.time+1e-9>=clock.next) {
      clock.next+=1;
      b.dealDamage(u,e,{amount:u.s.atk*u.skill.bb['talent@s3_atk_scale'],type:'arts',
        canDodge:false,isSkill:true,applyWay:'none',tags:['reed2:dot']});
    }
  }});
}
function clearCinder(b,u,{all=false}={}) {
  for(const e of b.enemies) {
    b.removeBuff(e,dotKey(u));
    const mark=e.findBuff(CINDER);
    if(mark?.data.owner===u && (all || mark.data.enhanced)) b.removeBuff(e,CINDER);
  }
}
function diffuse(b,u,e) {
  const holder=e.findBuff(CINDER)?.data;
  if(!third(u) || !holder?.enhanced || holder.owner!==u) return;
  const seq=u.deploySeq,scale=holder.aoe;
  // Capture recipients at native CreateBuffInRange, attach holder/DOT first,
  // then resolve each independent splash buff 0.1s later. This permits chains.
  const victims=b.enemies.filter(a=>canTargetEnemy(u,a,{canHitFly:true})
    && Math.hypot(a.x-e.x,a.y-e.y)<=holder.radius+1e-9);
  b.fx('splash',{x:e.x,y:e.y,radius:holder.radius});
  for(const a of victims) {
    ignite(b,u,a);
    b.after(.1,()=>{
      // An already issued limited splash survives the skill's end, like other
      // fired damage. A new diffusion still requires a live, active producer.
      if (!live(a) || u.deploySeq!==seq) return;
      b.dealDamage(u,a,{amount:u.s.atk*scale,type:'arts',canDodge:false,isSkill:true,
        isSplash:true,applyWay:'none',tags:['reed2:blast']});
    });
  }
}
function flight(b,u,p,e,info) {
  if(!canTargetEnemy(u,e,p))return;
  b.addProjectile({from:u,target:e,source:u,speed:10,maxAge:10,visual:'orb',
    data:{arkpediaTrackedVisual:true},onHit:({target})=>{
      if(canTargetEnemy(u,target,p))b.dealDamage(u,target,{amount:u.s.atk*u.s.atkScaleMul,
        type:'arts',isAttack:true,isSkill:info.isSkill,isProjectile:true,applyWay:'ranged',attackId:info.attackId});
    }});
}
function contact(e,a,z,radius) {
  const dx=z.x-a.x,dy=z.y-a.y,n=dx*dx+dy*dy;
  const t=n?Math.max(0,Math.min(1,((e.x-a.x)*dx+(e.y-a.y)*dy)/n)):0;
  return bodyDist(e,a.x+t*dx,a.y+t*dy)<=radius+1e-9;
}
const fireComponents=evidence.projectiles.projectile_chr_reed2_fire.flatMap(r=>r.components).map(c=>c.data);
const fireRadius=fireComponents.find(c=>c.m_Radius!=null).m_Radius;
const fireSpeed=fireComponents.find(c=>c._aroundSpeed!=null)._aroundSpeed*Math.PI/180;
const firePoint=(o,i,angle=o.angle)=>({x:o.host.x+.5*Math.cos(angle+i*TAU/3),
  y:o.host.y-.5*Math.sin(angle+i*TAU/3)});
function fireVisual(b,u) {
  b.reedFireballs=(b.reedFireballs ?? []).filter(p=>p.owner!==u);
  for(const o of u.mem.reedOrbits) for(const p of o.particles)
    if(b.time+1e-9>=p.readyAt)b.reedFireballs.push(p);
}
function fireTick(b,u,dt) {
  u.mem.reedOrbits=u.mem.reedOrbits.filter(o=>live(u) && live(o.host)
    && o.seq===u.deploySeq && o.hostSeq===o.host.deploySeq && b.time<o.expires-1e-9);
  for(const o of u.mem.reedOrbits) {
    const previous=o.angle;o.angle=(o.angle+fireSpeed*dt)%TAU;
    const steps=Math.max(1,Math.ceil(fireSpeed*dt/(Math.PI/90)));
    for(const p of o.particles) {
      let start=firePoint(o,p.index,previous);Object.assign(p,start);
      if(b.time+1e-9<p.readyAt)continue;
      for(let i=1;i<=steps;i++) {
        const end=firePoint(o,p.index,previous+fireSpeed*dt*i/steps);
        const victims=b.enemies.filter(e=>canTargetEnemy(u,e,{groundOnly:true})
          && contact(e,start,end,fireRadius));
        // Shared geometry ties use spawn order. Native compiled collider order
        // and raw FP conversion are retained in evidence, not claimed as parity.
        victims.sort((a,z)=>a.spawnSeq-z.spawnSeq);
        const e=victims[0];Object.assign(p,end);
        if(e) {
          p.readyAt=b.time+o.cooldown;
          b.dealDamage(u,e,{amount:u.s.atk*u.s.atkScaleMul*o.scale,type:'arts',
            canDodge:false,isSkill:true,isProjectile:true,applyWay:'none',
            traitAlly:o.host,tags:['reed2:fireball']});
          break;
        }
        start=end;
      }
    }
  }
  fireVisual(b,u);
}
function emitFire(b,u,targets) {
  const bb=u.skill.bb;
  for(const host of targets) if(live(host)) {
    const o={host,hostSeq:host.deploySeq,seq:u.deploySeq,angle:0,
      expires:b.time+bb.projectile_life_time,scale:bb.atk_scale,cooldown:bb.cooldown};
    o.particles=Array.from({length:3},(_,index)=>({owner:u,index,readyAt:b.time,
      color:0xffa541,...firePoint(o,index)}));
    u.mem.reedOrbits.push(o);
  }
  fireVisual(b,u);
}
function castFire(b,u) {
  const seq=u.deploySeq,act=u.skill.activations;
  const clock=u.s.aspd/100,duration=evidence.models[ID].Front.durations.Skill_2/clock;
  let interrupted=false;
  // Reviewed local mapping uses the verified front event for all facings and
  // visibly switches to that art. The original eventless Back clip is intact.
  u.mem.regularFormVisual={clip:'Skill_2',loop:false,forceFront:true,speed:clock};
  b.addBuff(u,{key:'reed2:cast',duration,flags:{disarm:true}});
  const control=u.attackControlEpoch;
  const valid=()=>!interrupted && live(u) && u.canAct && u.deploySeq===seq
    && u.skill.activations===act && u.attackControlEpoch===control;
  const monitor=b.every(b.dt,()=>{if(!valid()) {interrupted=true;monitor.cancel();}}, {owner:u});
  b.after(event(evidence.models[ID].Front,'Skill_2')/clock,()=>{
    monitor.cancel();if(valid())emitFire(b,u,hosts(b,u));
  },{owner:u});
  b.after(duration,()=>{if(u.deploySeq===seq && u.skill.activations===act) {
    b.removeBuff(u,'reed2:cast');u.mem.regularFormVisual=null;
  }},{owner:u});
}
function transition(b,u,begin,next) {
  const generation=u.mem.reedForm=(u.mem.reedForm ?? 0)+1;
  u.mem.regularFormVisual={clip:begin,loop:false};
  b.addBuff(u,{key:'reed2:transition',duration:model(u).durations[begin],flags:{disarm:true}});
  b.after(model(u).durations[begin],()=>{
    if(live(u) && generation===u.mem.reedForm)
      u.mem.regularFormVisual=next?{clip:next,loop:true}:null;
  },{owner:u});
}
export function customizeReedAlterKit({battle:b,id,def,unit:u,kit}) {
  if(id!==ID)return;kit.install=null;
  kit.trait={attack:'ranged',dmgType:'arts',heal:null,projectile:'none',canHitFly:true,
    maxTargets:1,hits:1,allInRange:false,install:null,interruptOnSkillChange:true,
    attackVisual:'Attack',windup:(_b,a)=>event(model(a),'Attack')/rate(a),launchAttack:flight};
  const s=def.skill,bb=s.bb;
  if(s.id==='skcom_quickattack[3]')kit.skill={kind:'duration',duration:s.duration,
    mods:{atkPct:bb.atk,aspd:bb.attack_speed}};
  else if(s.id==='skchr_reed2_2')kit.skill={kind:'duration',duration:s.duration,
    canActivate:()=>u.canAct && !u.s.flags.disarm && hosts(b,u).length>0,
    onStart:()=>castFire(b,u)};
  else kit.skill={kind:'duration',duration:s.duration,mods:{atkPct:bb['reed2_skil_3[switch_mode].atk']},
    attack:{maxTargets:bb.max_target,attackVisual:'Skill_3_Attack',
      windup:(_b,a)=>event(model(a),'Skill_3_Attack')/rate(a),
      acquireTargets:(battle,a,p)=>sortEnemyTargets(battle,a,battle.enemies.filter(e=>canTargetEnemy(a,e,p)
        && bodyInKeys(e,a.rangeKeySet)),p.priority).slice(0,bb.max_target)},
    onStart:()=>{
      const t=talent(u);if(t)u.skill.bb={...u.skill.bb,'talent@atk':t.atk,'talent@damage_scale':t.damage_scale};
      transition(b,u,'Skill_3_Begin','Skill_3_Loop');
    },onEnd:({reason})=>{
      clearCinder(b,u);
      if(live(u) && reason!=='death')transition(b,u,'Skill_3_End',null);
      else {u.mem.reedForm++;u.mem.regularFormVisual=null;}
    }};
  Object.assign(kit.skill,{id:s.id,name:s.name});
}
export function installReedAlter({battle:b,unit:u,def}) {
  if(def.charId!==ID)return;u.mem.reedOrbits=[];
  b.on('outputDamage',({source,target,dmg})=>{
    if(source!==u || !live(u) || target.side!=='enemy' || isHpLoss(dmg)
      || !['phys','arts','true'].includes(dmg.type))return;
    const t=talent(u);if(!t)return;
    if(third(u))ignite(b,u,target);
    else if(b.rng()<t.prob)mark(b,u,target);
  },{owner:u});
  b.on('calculatedDamage',({source,target,dmg,amount})=>{
    if(source!==u || !live(u) || target.side!=='enemy' || isHpLoss(dmg)
      || !['phys','arts','true'].includes(dmg.type) || !(amount>0))return;
    // Explicit projectile trace-host branch never falls back to another ally.
    const host=dmg.traitAlly,a=host ? (healable(b,u,host)?host:null) : recipient(b,u);
    if(a)b.heal(u,a,amount*def.traitBb.scale);
  },{owner:u});
  b.on('calculatedHeal',({source,target,amount})=>{
    if(source===u && target!==u && target.side==='ally' && live(u) && amount>0 && reflected(u)>0)
      b.heal(u,u,amount*reflected(u)); // self-target receipt cannot recurse
  },{owner:u});
  b.on('tick',({dt})=>fireTick(b,u,dt),{owner:u});
  const cleanup=()=>{
    clearCinder(b,u,{all:true});u.mem.reedOrbits=[];fireVisual(b,u);
    u.mem.regularFormVisual=null;u.mem.reedForm++;
  };
  b.on('death',({unit,reason})=>{
    if(unit===u)cleanup();else if(unit.side==='enemy' && reason==='killed')diffuse(b,u,unit);
  },{owner:u});
  b.on('battleEnd',cleanup,{owner:u});
}
