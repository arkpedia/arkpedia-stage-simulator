// SPDX-License-Identifier: GPL-3.0-or-later
// Complete native graphs: arkpedia-civilight-prefabs.json. Orbit units and the
// S2 finish quirk are corroborated separately; this is not compiled C# parity.
import evidence from '../../../data/arkpedia-civilight-prefabs.json' with { type: 'json' };
import { bodyDist, bodyInKeys } from '../body.js';
import { aggregateMods } from '../buffs.js';
const ID = 'char_4134_cetsyr', TAU = Math.PI * 2;
const live = a => a?.alive && a.deployed && !a.hidden && !a._removing;
const mode = u => live(u) && u.skill.active ? Number(u.skill.id.at(-1)) : 0;
const eligible = a => live(a) && a.kind !== 'device';
const inside = (u, a) => eligible(a) && bodyInKeys(a, u.rangeKeySet);
const key = (u, name) => `cetsyr:${name}:${u.id}`;
const trait = u => u.def.talents[0].bb;
const nativeParts = name => evidence.projectiles[name].flatMap(r => r.components).map(c => c.data);
const collisionRadius = nativeParts('projectile_chr_cetsyr_talent').find(c => c.m_Radius != null).m_Radius;
const radiusStep = nativeParts('projectile_chr_cetsyr_talent_s2').find(c => c._aroundSpeed != null)._aroundSpeed;
const twoBuff = evidence.skills.skchr_cetsyr_2.flatMap(r=>r.components)
  .flatMap(c=>[...(c.data._passiveBuffs ?? []),...(c.data._buffs ?? [])]).find(b=>b.buffKey==='cetsyr_s_2');
const twoDefaults = Object.fromEntries(twoBuff.blackboard.map(v=>[v.key,v.valueStr || v.value]));

function clear(b, u) {
  for (const a of b.allyUnits) for (const name of ['heal','inspire','inspire-clock'])
    b.removeBuff(a, key(u, name));
}
function inspire(b, u, a) {
  const m = mode(u);
  if (m < 2 || !inside(u, a) || a.def.subProf === 'bard'
    || a.mem.noInspire || a.findBuff('immune_to_encourage')) return;
  const stat = m === 2 ? 'atkFinalFlat' : 'hpFinalFlat';
  const ratio = u.skill.bb[m === 2 ? 'attack@atk' : 'max_hp'];
  const mods = { [stat]: u.s[m === 2 ? 'atk' : 'maxHp'] * ratio };
  const old = a.findBuff(key(u,'inspire'));
  if (!old || old.mods[stat] !== mods[stat]) b.addBuff(a, { key: key(u,'inspire'), source: u,
    tags: ['inspire'], mods, data: { inspirePriority: { [stat]: ratio } } });
}
function recovery(b, u, a) {
  if (!live(u) || !inside(u,a) || a.s.flags.isolated) return;
  const m = mode(u);
  const ratio = [1,3].includes(m) ? u.skill.bb['attack@atk_to_hp_recovery_ratio']
    : u.def.traitBb['attack@atk_to_hp_recovery_ratio'];
  const mark = a.findBuff(key(u,'mark')) ? trait(u)['attack@trait_mul'] : 1;
  const regen = aggregateMods(a.buffs).mul.hpRegenMul ?? 1;
  b.heal(u,a,u.s.atk * ratio * mark * regen,
    { self: true, regen: true, skipModifierEvent: true });
}
function sync(b,u) {
  for (const a of b.allyUnits) {
    const allowed = live(u) && inside(u,a), heal = key(u,'heal');
    if (!allowed || a.s.flags.isolated) b.removeBuff(a,heal);
    else if (!a.findBuff(heal)) b.addBuff(a, { key: heal, source: u,
      interval: 1, onTick: () => recovery(b,u,a) }); // source waits one second on entry
    const clock = key(u,'inspire-clock'), buff = key(u,'inspire');
    const canInspire = allowed && mode(u)>=2 && a.def.subProf!=='bard'
      && !a.mem.noInspire && !a.findBuff('immune_to_encourage');
    if (!canInspire) { b.removeBuff(a,clock); b.removeBuff(a,buff); }
    else if (!a.findBuff(clock)) {
      b.addBuff(a, { key: clock, source: u, interval: 1, onTick: () => inspire(b,u,a) });
      inspire(b,u,a);
    }
  }
}
function redistribute(b,u) {
  if (mode(u)!==3) return;
  // One atomic collect/calculate/apply pass. Reading every live maxHP first also
  // resolves lazy Inspiration stats before recording current HP. The native
  // collectors' same-frame ordering remains a documented simulator contract.
  const recipients = b.allyUnits.filter(a=>inside(u,a) && !a.s.flags.isolated);
  const rows = recipients.map(a=>({a,max:a.s.maxHp})).map(r=>({...r,hp:r.a.hp}));
  const max = rows.reduce((sum,r)=>sum+r.max,0);
  if (!(max>0)) return;
  const ratio = Math.max(0,Math.min(1,rows.reduce((sum,r)=>sum+r.hp,0)/max));
  for (const r of rows) if (live(r.a)) r.a.hp = r.max * ratio;
  // EqualizeTargetHpRatio skips modifier, damage, healing and SP receipts.
}
function contact(target,a,z,radius) {
  const dx=z.x-a.x,dy=z.y-a.y,n=dx*dx+dy*dy;
  const t=n ? Math.max(0,Math.min(1,((target.x-a.x)*dx+(target.y-a.y)*dy)/n)) : 0;
  return bodyDist(target,a.x+t*dx,a.y+t*dy)<=radius+1e-9;
}
function point(u,o,index,count,angle=o.angle,radius=o.radius) {
  const theta=angle+index*TAU/count;
  return {x:u.x+radius*Math.cos(theta),y:u.y-radius*Math.sin(theta)};
}
function resetParticles(b,u,count) {
  const o=u.mem.cetsyrOrbit;
  o.particles=Array.from({length:count},(_,i)=>({owner:u,index:i,alive:true,readyAt:0,
    ...point(u,o,i,count),color:mode(u)===2?0xf2bf80:0xe5daed}));
  visual(b,u);
}
function visual(b,u) {
  b.civilightParticles = (b.civilightParticles ?? []).filter(p=>p.owner!==u);
  if (live(u)) b.civilightParticles.push(...u.mem.cetsyrOrbit.particles.filter(p=>p.alive));
}
function collide(b,u,p,start,end) {
  const m=mode(u),o=u.mem.cetsyrOrbit;
  const targets=m===2 ? b.enemies.filter(e=>live(e) && !e.s.flags.untargetable)
    : b.allyUnits.filter(a=>live(a) && a.kind==='op' && !a.s.flags.isolated
      && !a.findBuff(key(u,'mark')));
  // Original collider follows an arc. Small swept chords avoid point sampling
  // tunneling; moving bodies/huge colliders and tie order are bounded mappings.
  for (const a of targets) if (contact(a,start,end,collisionRadius)) {
    if (m===2) b.dealDamage(u,a,{amount:u.s.atk*u.s.atkScaleMul*u.skill.bb.atk_scale,
      type:'true',canDodge:false,isSkill:true,applyWay:'none',tags:['cetsyr:particle']});
    else b.addBuff(a,{key:key(u,'mark'),source:u,duration:trait(u).talent_duration});
    if (m!==3) { p.alive=false;p.readyAt=b.time+o.cooldown;break; }
  }
}
function tickOrbit(b,u,dt) {
  if (!live(u)) { visual(b,u);return; }
  const o=u.mem.cetsyrOrbit,previous=o.angle,oldRadius=o.radius;
  o.angle=(o.angle+o.speed*dt)%TAU;
  const distance=o.finalRadius-o.radius;
  o.radius+=Math.sign(distance)*Math.min(Math.abs(distance),radiusStep*30*dt);
  const steps=Math.max(1,Math.ceil(Math.abs(o.speed*dt)/(Math.PI/90)));
  for (const p of o.particles) {
    if (!p.alive && b.time+1e-9>=p.readyAt) {p.alive=true;Object.assign(p,point(u,o,p.index,o.particles.length,previous,oldRadius));}
    if (!p.alive) continue;
    let start={x:p.x,y:p.y};
    for (let i=1;i<=steps && p.alive;i++) {
      const end=point(u,o,p.index,o.particles.length,previous+o.speed*dt*i/steps,
        oldRadius+(o.radius-oldRadius)*i/steps);
      collide(b,u,p,start,end);Object.assign(p,end);start=end;
    }
  }
  visual(b,u);
}
function begin(b,u,m) {
  const generation=u.mem.cetsyrGeneration=(u.mem.cetsyrGeneration ?? 0)+1;
  const clip=`Skill_${m}_Begin`;
  u.mem.regularFormVisual={clip,loop:false};
  b.after(evidence.models[ID].Front.durations[clip],()=>{
    if (live(u) && u.skill.active && generation===u.mem.cetsyrGeneration)
      u.mem.regularFormVisual={clip:`Skill_${m}_Loop`,loop:true};
  },{owner:u});
}
function finishVisual(b,u,m,reason) {
  const generation=u.mem.cetsyrGeneration=(u.mem.cetsyrGeneration ?? 0)+1;
  if (!live(u) || reason==='death') {u.mem.regularFormVisual=null;return;}
  const clip=`Skill_${m}_End`;
  u.mem.regularFormVisual={clip,loop:false};
  b.after(evidence.models[ID].Front.durations[clip],()=>{
    if (live(u) && generation===u.mem.cetsyrGeneration) u.mem.regularFormVisual=null;
  },{owner:u});
}
export function customizeCivilightKit({battle:b,id,def,unit:u,kit}) {
  if (id!==ID) return;
  kit.install=null;
  kit.trait={canAttack:()=>false,attack:'ranged',dmgType:'arts',projectile:'none',
    canHitFly:true,maxTargets:1,hits:1,allInRange:false,install:null};
  const s=def.skill,m=Number(s.id.at(-1));
  kit.skill={id:s.id,name:s.name,kind:m===1?'toggle':'duration',
    ...(m===1?{trigger:'SP_FULL'}:{}),
    ...(m===3?{targeting:{rangeGrid:s.rangeGrid}}:{}),
    onStart:()=>{
      clear(b,u);const o=u.mem.cetsyrOrbit;
      if (m===1) {o.cooldown=s.bb.talent_cool_down;resetParticles(b,u,trait(u).cnt);}
      if (m===2) {o.speed=s.bb.dynamic_spd;o.finalRadius=s.bb.outside_radius;resetParticles(b,u,s.bb.extra_cnt);}
      if (m===3) {resetParticles(b,u,trait(u).cnt);o.nextRedistribute=b.time;}
      begin(b,u,m);sync(b,u);
      if (m===3) {redistribute(b,u);o.nextRedistribute=b.time+s.bb['attack@cetsyr_s_3[cal_hp_ratio].interval'];}
    },
    onEnd:({reason})=>{
      clear(b,u);const o=u.mem.cetsyrOrbit;
      o.nextRedistribute=Infinity;o.cooldown=trait(u).cooldown;
      if (m===2) {o.speed=twoDefaults.default_rotate_spd;o.finalRadius=twoDefaults.inside_radius;}
      if (live(u)) resetParticles(b,u,trait(u).cnt);
      finishVisual(b,u,m,reason);
    }};
}
export function installCivilight({battle:b,unit:u,def}) {
  if (def.charId!==ID) return;
  b.addBuff(u,{key:'immune_to_encourage',persist:true,allowDead:true});
  const t=trait(u);
  u.mem.cetsyrOrbit={angle:0,radius:t.range_radius,finalRadius:t.range_radius,
    speed:t.dynamic_spd*Math.PI/180,cooldown:t.cooldown,particles:[],nextRedistribute:Infinity};
  if (!b._civilightResistance) b._civilightResistance=b.on('hit',({source,target,dmg})=>{
    if (target.side!=='ally' || !source?.tags?.has('sarkaz')) return;
    const cut=Math.max(0,...b.allyUnits.filter(a=>a.defId===ID && live(a))
      .map(a=>a.def.talents.find(t=>t.bb.damage_resistance!=null)?.bb.damage_resistance ?? 0));
    dmg.mul*=1-cut; // one strongest live owner; no duplicate/recursive stacking
  });
  b.on('outputDamage',({source,target})=>{
    if (source===u && mode(u)===2 && live(target) && target.side==='enemy')
      b.applyStatus(target,'bind',{duration:u.skill.bb.unmoveable_duration,source:u});
  },{owner:u});
  b.on('deploy',({unit})=>{if(unit===u){resetParticles(b,u,t.cnt);sync(b,u);}}, {owner:u});
  b.on('tick',({dt})=>{
    sync(b,u);tickOrbit(b,u,dt);
    const o=u.mem.cetsyrOrbit;
    if (mode(u)===3 && b.time+1e-9>=o.nextRedistribute) {
      redistribute(b,u);o.nextRedistribute+=u.skill.bb['attack@cetsyr_s_3[cal_hp_ratio].interval'];
    }
  },{owner:u});
  const cleanup=()=>{
    clear(b,u);u.mem.cetsyrOrbit.particles=[];
    b.civilightParticles=(b.civilightParticles ?? []).filter(p=>p.owner!==u);
    for (const a of b.allyUnits) b.removeBuff(a,key(u,'mark'));
  };
  b.on('death',({unit})=>{if(unit===u)cleanup();},{owner:u});
  b.on('battleEnd',cleanup,{owner:u});
}
