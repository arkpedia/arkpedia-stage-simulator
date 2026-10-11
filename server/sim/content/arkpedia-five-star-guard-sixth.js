// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_GUARD_SIXTH_OPERATORS } from '../../../shared/arkpedia/five-star-guard-sixth-operators.js';
import { acquireTargets, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { rotateOffset } from '../dir.js';
import { isHpLoss } from '../damage.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const speed = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
// timeMode0 attack animation follows the current interval, including BAT
// modifiers. Keep the native 2x animation cap separate from the actual BAT.
const tachRate = u => Math.min(2, u.base.bat / u.s.interval);
function mods(b, u, key, values, extra = {}) {
  const old = u.findBuff(key);
  if (!values) { if (old) b.removeBuff(u, old); }
  else if (!old || JSON.stringify(old.mods) !== JSON.stringify(values))
    b.addBuff(u, { key, source: u, mods: values, allowDead: true, ...extra });
}
function visual(b, u, clip, seconds, loop = false) {
  const seq = u.deploySeq, token = {};
  u.mem.sixthVisual = token; u.mem.regularFormVisual = { clip, loop };
  if (seconds > 0) b.after(seconds, () => {
    if (u.deploySeq === seq && u.mem.sixthVisual === token) u.mem.regularFormVisual = null;
  }, { owner: u });
}
/** Cast deadlines watch control continuously; recovery before release cannot revive an interrupted cast. */
function castWindow(b, u, clip, duration, releases, { interruptible = true, finish = null } = {}) {
  const seq = u.deploySeq, token = {}, key = `guard-sixth:cast:${u.id}`;
  u.mem.sixthCast = token; visual(b, u, clip, 0);
  b.addBuff(u, { key, source: u, flags: { disarm: true, noSp: true } });
  const controlEpoch = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === seq && u.mem.sixthCast === token
    && (!interruptible || u.attackControlEpoch === controlEpoch);
  const clear = reason => {
    if (u.mem.sixthCast !== token) { watch.cancel(); return; }
    u.mem.sixthCast = null; u.mem.regularFormVisual = null; b.removeBuff(u, key); watch.cancel();
    finish?.(reason);
  };
  const watch = b.every(b.dt, () => {
    if (!valid() || interruptible && !u.canAct) clear('interrupt');
  }, { owner: u });
  for (const [at, fn] of releases) b.after(at, () => {
    if (valid() && (!interruptible || u.canAct)) fn();
  }, { owner: u });
  b.after(duration, () => { if (valid()) clear('duration'); }, { owner: u });
  return token;
}

function blade(b, u, count) {
  const t = u.def.talents.find(t => t.bb.hit_num != null);
  u.mem.noirBlade = Math.max(0, Math.min(3, count));
  mods(b, u, 'noirc2:blade', { atkPct: t.bb.atk * u.mem.noirBlade });
  u.mem.regularSpineSkinKey = ['Default', 'WhiteBlade', 'YellowBlade', 'RedBlade'][u.mem.noirBlade];
  u.mem.regularSpineSkin = ['default', 'White', 'Yellow', 'Red'][u.mem.noirBlade];
}
function sheath(b, u, s) {
  u.mem.noirGuard = false; u.mem.noirCount = 0;
  visual(b, u, 'Skill_1_Begin', 0);
  const seq = u.deploySeq, activation = u.skill.activations;
  b.after(s.bb.nadaodonghua_duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation) {
      u.mem.noirGuard = true; visual(b, u, 'Skill_1_Loop', 0, true);
    }
  }, { owner: u });
}
function noirCounter(b, u) {
  const s = u.def.skill, bb = s.bb;
  u.mem.noirGuard = false; u.mem.noirEpoch++;
  const candidates = b.enemiesInKeys(absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir), u, { canHitFly: false });
  sortEnemyTargets(b,u,candidates); const target = candidates[0];
  const hits = Math.max(1, bb.multi_times), id = ++b._attackSeq;
  u.skill.timeLeft = Math.max(u.skill.timeLeft, 1.01);
  u.mem.noirCounterAttack = id; u.mem.noirCounterAffected = false;
  let killed = false;
  const releases = Array.from({ length: hits }, (_, i) => [.067 + i * bb.multi_hit_interval, () => {
    if (!target || !canTargetEnemy(u, target, { canHitFly: false })) return;
    b.dealDamage(u, target, { amount: u.s.atk * u.s.atkScaleMul * bb.multi_atk_scale, type: 'phys',
      isAttack: true, isSkill: true, attackId: id, applyWay: 'melee', tags: ['noirc2:s1'] });
    if (!target.alive) killed = true;
  }]);
  castWindow(b, u, 'Skill_1_End', 1, releases, { finish: reason => {
    if (!u.skill.active) return;
    if (reason === 'duration' && killed && live(u)) { u.skill.timeLeft = s.duration; sheath(b, u, s); }
    else u.skill.end(reason);
  } });
}
function noirS2(b, u, s) {
  u.mem.noirCount = 0; u.mem.noirEpoch++;
  const candidates = b.enemiesInKeys(u.baseRangeKeys,u,{canHitFly:true});sortEnemyTargets(b,u,candidates);const target=candidates[0];
  const id = ++b._attackSeq, times = [.467, .533, .6, .667, .733, .8, .867];
  castWindow(b, u, 'Skill_2', s.duration, times.slice(0, s.bb.multi_times).map(at => [at, () => {
    if (target && canTargetEnemy(u, target, { canHitFly: true })) b.dealDamage(u, target, {
      amount: u.s.atk * u.s.atkScaleMul * s.bb.multi_atk_scale, type: 'phys', isAttack: true, isSkill: true,
      attackId: id, applyWay: 'melee', tags: ['noirc2:s2'] });
  }]), { finish: reason => {
    if (u.skill.active) u.skill.end(reason);
  } });
}

function docHeal(b, u, target, amount) { b.heal(u, target, amount); }
function docShield(b, u, target, excess, talent) {
  const key = 'rdoc:barrier', cap = u.s.atk * talent.scale;
  let old = target.findBuff(key);
  if (old && old.shield >= cap) return;
  if (old) { old.shield = Math.min(cap, old.shield + excess); target.markDirty(); return; }
  old = b.addBuff(target, { key, source: u, shield: Math.min(cap, excess), visible: true });
  if (!old) return;
  // Native barrier is HIGH_PRIORITY. Place its owned absorber before ordinary
  // HP shields without altering their amounts or lifetimes.
  const ix = target.buffs.indexOf(old); if (ix > 0) { target.buffs.splice(ix, 1); target.buffs.unshift(old); }
  const seq = target.deploySeq;
  const decay = () => {
    if (!live(target) || target.deploySeq !== seq || target.findBuff(key) !== old) return;
    old.shield = Math.max(0, old.shield + Math.floor(old.shield * talent.dec_rate * .1)); target.markDirty();
    if (old.shield <= 0) { b.removeBuff(target, old); return; }
    b.after(.1, decay, { owner: target });
  };
  b.after(1, decay, { owner: target });
}
function docShot(b, u, bb) {
  const [dy, dx] = rotateOffset(0, 1, u.dir), origin = { x: u.x, y: u.y };
  const projectile = b.addProjectile({ from: origin, to: { x: u.x + dx * 3.5, y: u.y + dy * 3.5 },
    speed: 5, visual: 'arrow', source: u });
  let previous = origin, ended = false;
  const timer = b.every(b.dt, () => {
    if (ended) return;
    const current = { x: projectile.x, y: projectile.y }, vx = current.x - previous.x, vy = current.y - previous.y;
    const length2 = vx * vx + vy * vy;
    const collisions = [];
    for (const a of b.units.values()) {
      if (a === u || a.side !== 'ally' || a.kind !== 'op' || !live(a) || a.isFlying || a.s.flags.untargetable
        || !b.allySelectable(a,u) || a.s.flags.noHeal || a.profile?.noHeal || a.s.flags.healFree) continue;
      const t = length2 ? Math.max(0, Math.min(1, ((a.x - previous.x) * vx + (a.y - previous.y) * vy) / length2)) : 0;
      if (Math.hypot(a.x - previous.x - vx * t, a.y - previous.y - vy * t) <= .2 + (a.colliderRadius ?? .1))
        collisions.push({ a, t });
    }
    collisions.sort((a, c) => a.t - c.t || a.a.id - c.a.id);
    if (collisions.length) {
      ended = true; timer.cancel(); b.projectiles.list = b.projectiles.list.filter(p => p !== projectile);
      docHeal(b, u, collisions[0].a, u.s.atk * bb.heal_scale);
    } else if (projectile.age >= .7 - 1e-9) { ended = true; timer.cancel(); }
    previous = current;
  });
}
function docS1(b, u, s) {
  u.mem.sixthUses++; u.mem.docOpening = false;
  const r = speed(u), token = castWindow(b, u, 'Skill_1_Heal', 1.167 / r, [
    [.433 / r, () => docHeal(b, u, u, u.s.atk * s.bb.heal_scale)],
  ], { finish: reason => {
    if (reason !== 'duration') { if (u.skill.active) u.skill.end(reason); return; }
    if (!u.skill.active) return;
    mods(b, u, 'rdoc:ammo-bat', { batFlat: s.bb.base_attack_time });
    visual(b, u, 'Skill_1_Begin', 0);
    const seq = u.deploySeq, act = u.skill.activations;
    b.addBuff(u, { key: 'rdoc:begin', source: u, duration: .333, flags: { disarm: true } });
    b.after(.333, () => { if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === act)
      visual(b, u, 'Skill_1_Idle', 0, true); }, { owner: u });
  } });
  return token;
}
function docS2(b, u, s) {
  u.mem.sixthUses++;
  const r = speed(u);
  castWindow(b, u, 'Skill_2', 1.067 / r, [[.333 / r, () => docShot(b, u, s.bb)]], { interruptible: false });
}

function laiosLearned(b, u) {
  b.laiosKnowledge ??= new Map(); const key = `${u.ownerId}:${u.def.charId}`;
  if (!b.laiosKnowledge.has(key)) b.laiosKnowledge.set(key, new Set()); return b.laiosKnowledge.get(key);
}
function laiosFrighten(b, u, active) {
  const owned = `laios:tremble:${u.id}`, blocked = new Set(active ? b.blockedTargets(u) : []);
  for (const e of b.enemies) {
    const old = e.findBuff(owned);
    if (blocked.has(e)) { if (!old) b.applyStatus(e, 'tremble', { key: owned, source: u }); }
    else if (old) b.removeBuff(e, old);
  }
}
function laiosEnd(b, u, s, reason) {
  laiosFrighten(b, u, false);
  if (reason !== 'duration' || !live(u)) { u.mem.regularFormVisual = null; return; }
  const r = speed(u);
  castWindow(b, u, 'Skill_2_End', 1.4 / r, [[.667 / r, () => {
    const id = ++b._attackSeq;
    for (const e of b.blockedTargets(u)) if (e.alive) b.dealDamage(u, e, {
      amount: u.s.atk * u.s.atkScaleMul * s.bb.atk_scale, type: 'phys', isAttack: true, isSkill: true,
      attackId: id, applyWay: 'melee', tags: ['laios:s2'] });
  }]]);
}

function tachLaunch(b, u, p, target, info) {
  const profile = { ...p, hits: 1, hitsFn: null };
  const launch = () => b.addProjectile({ from: u, target, speed: 30, visual: 'arrow', source: u,
    onHit: ({ target: t }) => { if (t && canTargetEnemy(u, t, profile)) resolveHit(b, u, profile, t, info, t.x, t.y); } });
  launch();
  const seq = u.deploySeq, act = u.skill.activations, controlEpoch = u.attackControlEpoch; let interrupted = false;
  const valid = () => live(u) && u.deploySeq === seq && u.skill.activations === act && u.canAct && !u.s.flags.disarm
    && u.attackControlEpoch === controlEpoch;
  const watch = b.every(b.dt, () => { if (!valid()) interrupted = true; }, { owner: u });
  b.after(.16 / u.mem.tachRate, () => { watch.cancel(); if (!interrupted && valid() && canTargetEnemy(u, target, profile)) launch(); }, { owner: u });
}
function tachZone(b, u, s, amount, x, y) {
  const keys = new Set(absoluteRangeKeys([[0,0],[0,1],[0,-1],[1,0],[-1,0]], Math.round(y), Math.round(x), 'RIGHT'));
  const key = `tachak:zone:${u.id}:${++u.mem.tachZones}`, until = b.time + s.bb.projectile_delay_time;
  const tick = () => {
    if (b.time >= until - 1e-9) return;
    for (const e of b.enemies) if (bodyInKeys(e, keys) && canTargetEnemy(u, e, { canHitFly: false })) {
      const mark = b.addBuff(e, { key, source: u, duration: 1, refresh: 'extend' });
      if (mark) mark.tachDefIgnore = s.bb.def_penetrate_fixed;
      b.dealDamage(u, e, { amount, type: 'arts', isSkill: true, applyWay: 'ranged', tags: ['tachak:s1-zone'] });
    }
  };
  tick(); const timer = b.every(s.bb.interval, tick);
  b.after(s.bb.projectile_delay_time, () => { timer.cancel(); for (const e of b.enemies) b.removeBuff(e, key); });
}
function tachS1(b, u, s) {
  const target = acquireTargets(b,u,{...u.profile,canHitFly:false})[0];
  castWindow(b, u, 'Skill', 2.367, [[.867, () => {
    const t = target;
    if (!t || !t.alive) return;
    const amount = u.s.atk * u.s.atkScaleMul * s.bb.atk_scale;
    b.addProjectile({ from: u, target: t, hitDead: true, speed: 16, visual: 'arrow', source: u,
      onHit: ({ x, y }) => tachZone(b, u, s, amount, x, y) });
  }]]);
}

export function customizeFiveStarGuardSixthKit({ id, def, unit: u, kit }) {
  if (!FIVE_STAR_GUARD_SIXTH_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', hits: 1, hitsFn: null,
    maxTargets: 1, hitAllBlocked: false, canHitFly: false, splashRadius: 0, chain: null, dmgMul: null,
    attackVisual: 'Attack', interruptOnSkillChange: true };
  const timed = { id: s.id, name: s.name, kind: 'duration', duration: s.duration, trigger: 'NEVER' };
  const instant = { id: s.id, name: s.name, kind: 'instant', trigger: 'NEVER' };
  if (id === 'char_1030_noirc2') {
    Object.assign(kit.trait, { noHeal: true, attackEpoch: (_b, u) => u.mem.noirEpoch,
      windup: (_b, u) => { u.mem.noirAttack = ((u.mem.noirAttack ?? -1) + 1) % 5; return (u.mem.noirAttack === 4 ? .433 : .467) / speed(u); },
      attackVisual: (_b, u) => ['Attack_1','Attack_2','Attack_3','Attack_1','Attack_4'][u.mem.noirAttack] });
    kit.skill = { ...timed, flags: { disarm: true }, onStart: ({ battle, unit }) =>
      s.id.endsWith('_1') ? sheath(battle, unit, s) : noirS2(battle, unit, s),
      onEnd: ({ battle, unit, reason }) => { unit.mem.noirGuard = false; unit.mem.noirCounterAttack = null;
        if (s.id.endsWith('_2') && reason === 'duration') blade(battle, unit, unit.mem.noirBlade - 1);
        if (reason !== 'duration' && unit.mem.sixthCast) unit.mem.sixthCast = null;
        unit.mem.regularFormVisual = null; battle.removeBuff(unit, `guard-sixth:cast:${unit.id}`); } };
  } else if (id === 'char_4125_rdoc') {
    Object.assign(kit.trait, { attack: 'ranged', projectile: 'none', launchAttack: (b,u,p,t,info) => {
      b.addProjectile({ from:u,target:t,speed:10,visual:'arrow',source:u,onHit:({target})=>{
        if(target&&canTargetEnemy(u,target,p)) resolveHit(b,u,p,target,info,target.x,target.y); } }); },
      windup: (_b,u) => { const opening=!u.mem.docOpening; u.mem.docOpening=true; u.mem.docFirstShot=opening;return (opening?.233:.033)/speed(u); },
      attackVisual: (_b,u) => u.mem.docFirstShot?{begin:'Attack_Begin',loop:'Attack_Loop',beginDuration:.2/speed(u)}:'Attack_Loop' });
    const limited = { isExhausted: () => (u.mem.sixthUses ?? 0) >= bb.skill_max_trigger_time,
      remainingUses: () => Math.max(0, bb.skill_max_trigger_time - (u.mem.sixthUses ?? 0)),
      canActivate: () => u.canAct && !u.s.flags.disarm && !u.mem.sixthCast && (u.mem.sixthUses ?? 0) < bb.skill_max_trigger_time };
    kit.skill = s.id.endsWith('_1') ? { ...instant, ...limited, kind:'ammo', ammo:bb['attack@trigger_time'], duration:0, manualCancel:true,
      attack:{ attackVisual:'Skill_1_Loop',windup:(_b,u)=>.1/speed(u,1) },
      onStart:({battle,unit})=>docS1(battle,unit,s), onEnd:({battle,unit,reason})=>{
        mods(battle,unit,'rdoc:ammo-bat',null);battle.removeBuff(unit,'rdoc:begin');unit.mem.sixthCast=null;
        battle.removeBuff(unit,`guard-sixth:cast:${unit.id}`);unit.mem.docOpening=false;
        if(live(unit)&&['ammo','manual'].includes(reason)){visual(battle,unit,'Skill_1_End',.4);battle.addBuff(unit,{key:'rdoc:end',source:unit,duration:.4,flags:{disarm:true}});}
        else unit.mem.regularFormVisual=null;
      } } : { ...instant,...limited,onStart:({battle,unit})=>docS2(battle,unit,s) };
  } else if (id === 'char_4142_laios') {
    kit.trait.windup = (_b,u)=>.6/speed(u);
    kit.skill = s.id.endsWith('_1') ? { id:s.id,name:s.name,kind:'passive' }
      : { ...timed, flags:{disarm:true},onStart:({battle,unit})=>{visual(battle,unit,'Skill_2_Loop',0,true);laiosFrighten(battle,unit,true);},
        onTick:({battle,unit})=>laiosFrighten(battle,unit,true),onEnd:({battle,unit,reason})=>laiosEnd(battle,unit,s,reason) };
  } else {
    const t=def.talents[0];
    Object.assign(kit.trait,{canHitFly:true,attack:'ranged',projectile:'none',rangeExtend:t.bb.ability_range_forward_extend,
      launchAttack:tachLaunch,windup:(_b,u)=>{u.mem.tachRate=tachRate(u);u.mem.tachClip=['Attack_A','Attack_B','Attack_C'][((u.mem.tachAnim??-1)+1)%3];u.mem.tachAnim=((u.mem.tachAnim??-1)+1)%3;return .333/u.mem.tachRate;},
      attackVisual:(_b,u)=>u.mem.tachClip });
    kit.skill = s.id.endsWith('_1') ? { ...instant,canActivate:()=>u.canAct&&!u.s.flags.disarm&&!u.mem.sixthCast&&acquireTargets(u.skill.battle,u,{...u.profile,canHitFly:false}).length>0,
      onStart:({battle,unit})=>tachS1(battle,unit,s) }
      : { ...timed,mods:{batPct:bb.base_attack_time},targeting:{rangeGrid:s.rangeGrid,noRangeExtend:true},
        attack:{acquireTargets:(b,u)=>{const targets=b.enemiesInKeys(u.rangeKeys,u,{canHitFly:true});return targets.length?[b.rng.pick(targets)]:[];} } };
  }
  kit.skill.canActivate ??= () => u.canAct && !u.s.flags.disarm && !u.mem.sixthCast;
}

export function installFiveStarGuardSixth({ battle:b,unit:u,def }) {
  const id=def.charId;if(!FIVE_STAR_GUARD_SIXTH_OPERATORS[id])return;
  u.mem.sixthUses=0;
  if(id==='char_1030_noirc2'){
    u.mem.noirEpoch=0;u.mem.noirCount=0;u.mem.noirLast=-Infinity;blade(b,u,0);
    const t=def.talents.find(t=>t.bb.min_attack_speed!=null),count=def.talents.find(t=>t.bb.hit_num!=null);
    const sync=()=>{const ratio=Math.min(1,(1-u.hpRatio)/(1-t.bb.min_hp_ratio));mods(b,u,'noirc2:tenacity',{aspd:t.bb.min_attack_speed*ratio,defPct:t.bb.min_def*ratio});};
    b.every(.25,()=>{if(live(u))sync();},{owner:u});sync();
    b.on('damaged',({source,target,dmg})=>{
      if(source!==u||!live(u)||target?.side!=='enemy'||isHpLoss(dmg)||dmg.type==='element')return;
      b.heal(u,u,def.traitBb.value,{self:true,ignoreHealFree:true});
      // checkTarget grants once on accepted ON_OUTPUT_DAMAGE, after mitigation.
      // A fully dodged attempt has no such event; an absorbed output still does.
      if(u.skill.active&&dmg.attackId===u.mem.noirCounterAttack&&!u.mem.noirCounterAffected){
        u.mem.noirCounterAffected=true;blade(b,u,u.mem.noirBlade+1);
      }
      if(u.skill.active)return;
      if(b.time-u.mem.noirLast>count.bb['attack@clear_attackcount_time'])u.mem.noirCount=0;
      u.mem.noirLast=b.time;u.mem.noirCount++;
      if(u.mem.noirCount>=count.bb.hit_num){u.mem.noirCount=0;blade(b,u,u.mem.noirBlade+1);}
    },{owner:u});
    b.on('statusApplied',({target,status})=>{if(target===u&&['stun','freeze','disarm'].includes(status)){u.mem.noirCount=0;if(u.skill.active)u.skill.end('interrupt');}},{owner:u});
    b.on('hit',({target,dmg})=>{
      if(target!==u||!live(u)||!u.skill.active||u.skill.id!=='skchr_noirc2_1'||!u.mem.noirGuard||isHpLoss(dmg)||dmg.type==='element')return;
      dmg.mul=0;noirCounter(b,u);
    },{owner:u});
  }else if(id==='char_4125_rdoc'){
    const t=def.talents.find(t=>t.bb.def_penetrate_fixed!=null),shield=def.talents.find(t=>t.bb.dec_rate!=null)?.bb;
    b.on('hit',({source,target,dmg})=>{if(source!==u||target?.side!=='enemy'||!dmg.isAttack)return;
      dmg.defIgnoreFlat+=t.bb.def_penetrate_fixed;
      if(target.blockedBy!==u)dmg.amount*=def.traitBb.atk_scale;
    },{owner:u});
    if(shield)b.on('heal',({source,target,amount})=>{if(source!==u||target.side!=='ally')return;const excess=Math.max(0,amount-Math.max(0,target.s.maxHp-target.hp));if(excess>0)docShield(b,u,target,excess,shield);},{owner:u});
    b.on('tick',()=>{if(live(u)&&!u.mem.sixthCast&&!u.skill.active&&!acquireTargets(b,u,u.profile).length)u.mem.docOpening=false;},{owner:u});
  }else if(id==='char_4142_laios'){
    const learned=laiosLearned(b,u),t=def.talents[0];
    if(t){b.on('kill',({killer,victim})=>{if(killer===u&&victim.side==='enemy')learned.add(victim.def.id);},{owner:u});
      b.on('hit',({source,target,dmg})=>{if(source===u&&target?.side==='enemy'&&learned.has(target.def.id))dmg.defIgnorePct+=t.bb.def_penetrate;},{owner:u});}
    if(u.skill.id==='skchr_laios_1'){
      const sync=()=>{if(!live(u))return;mods(b,u,'laios:vigor',u.hpRatio>def.skill.bb['peak_performance.hp_ratio']?{atkPct:def.skill.bb['peak_performance.atk']}:null,
        {status:'vigor',data:{value:def.skill.bb['peak_performance.atk']}});
        b.laiosBossSeen??=new Set();const key=`${u.ownerId}:${id}`;
        if(!b.laiosBossSeen.has(key)&&b.enemies.some(e=>e.alive&&e.deployed&&!e.hidden&&e.def.rank==='BOSS')){
          b.laiosBossSeen.add(key);b.addBuff(u,{key:'laios:boss-fear',source:u,duration:def.skill.duration,flags:{disarm:true}});
          visual(b,u,'Skill_1_Begin',0);const seq=u.deploySeq;
          b.after(4.5,()=>{if(live(u)&&u.deploySeq===seq&&u.findBuff('laios:boss-fear'))visual(b,u,'Skill_1_Loop',0,true);},{owner:u});
          b.after(def.skill.duration,()=>{if(live(u)&&u.deploySeq===seq)u.mem.regularFormVisual=null;},{owner:u});
        }};
      b.on('tick',sync,{owner:u});b.on('enemySpawn',sync,{owner:u});b.on('enemyBeforeAppear',sync,{owner:u});
    }
  }else{
    u.mem.tachZones=0;
    mods(b,u,'tachak:range',{rangeExtend:def.talents[0].bb.ability_range_forward_extend});
    b.on('hit',({source,target,dmg})=>{if(source!==u||target?.side!=='enemy'||isHpLoss(dmg))return;
      if(u.skill.active&&u.skill.id==='skchr_tachak_2'&&dmg.isAttack&&b.rng.chance(u.skill.bb.prob))dmg.amount*=u.skill.bb.atk_scale;
      const marks=target.buffs.filter(x=>x.key.startsWith('tachak:zone:'));
      if(marks.length)dmg.defIgnoreFlat+=Math.max(...marks.map(x=>x.tachDefIgnore??0));
    },{owner:u});
  }
}
