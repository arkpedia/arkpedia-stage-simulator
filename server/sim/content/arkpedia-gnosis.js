// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-gnosis-prefabs.json' with { type: 'json' };
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_206_gnosis';
const present = u => u?.alive && u.deployed && !u.hidden;
const third = u => u.skill.active && u.skill.id === 'skchr_gnosis_3';
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = (u, capped = true) => capped ? Math.min(1, u.s.aspd / 100) : u.s.aspd / 100;
const plain = { attack: 'ranged', dmgType: 'arts', canHitFly: true, projectile: 'none' };
const key = (name, u) => `gnosis:${name}:${u.id}`;
const firstTalent = u => u.def.talents.find(t => t.bb.cold != null)?.bb;
const component = (name, field) => evidence.projectiles[name].flatMap(g => g.components)
  .map(c => c.data).find(c => c[field] != null)[field];

function targets(b, u, p, count = 1) {
  const selected = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of b.blockedTargets(u, p)) if (!selected.includes(e)) selected.push(e);
  sortEnemyTargets(b, u, selected, p.priority);
  if (third(u)) {
    // Native postFilter40: unfrozen Cold, ordinary, then Frozen. Preserve the
    // ordinary route/taunt order within each source status class.
    const rank = e => e.s.flags.freeze ? 2 : e.s.flags.cold ? 0 : 1;
    selected.sort((a, z) => rank(a) - rank(z));
  }
  return selected.slice(0, count);
}

function coldModifiers(b, e) {
  const frozen = !!e.s.flags.freeze;
  const cold = e.buffs.filter(buff => buff.status === 'cold');
  // The original abnormal flag owns one debuff. Independent pairing credits
  // must not turn several Cold producers into several -30 ASPD modifiers.
  for (const buff of cold) if (buff.mods?.aspd) {
    buff.mods = { ...buff.mods, aspd: 0 }; e.markDirty();
  }
  if (cold.length && !frozen) {
    if (!e.findBuff('gnosis:cold-aspd')) b.addBuff(e, {
      key: 'gnosis:cold-aspd', mods: { aspd: -30 } });
  } else b.removeBuff(e, 'gnosis:cold-aspd');
  const held = e.buffs.some(buff => buff.data.gnosisFreezeHolder);
  const nativeCut = e.buffs.some(buff => buff.status === 'freeze' && buff.mods?.resFlat < 0);
  if (held && !nativeCut) {
    if (!e.findBuff('gnosis:freeze-res')) b.addBuff(e, { key: 'gnosis:freeze-res',
      mods: { resFlat: evidence.buffDatabase.c2e_freeze.attributes.attributeModifiers
        .find(v => v.attributeType === 'MAGIC_RESISTANCE').value } });
  } else b.removeBuff(e, 'gnosis:freeze-res');
}

function applyCold(b, u, e, duration) {
  // disableOverride=true and triggerCnt=1: retain Cold layers, but consume each
  // layer's pairing credit once. An existing Frozen flag is not a Cold credit.
  const old = e.buffs.find(v => v.status === 'cold' && !v.data.gnosisPaired);
  const owned = `gnosis:cold:${++b._gnosisColdSeq}`;
  if (!b.applyStatus(e, 'cold', { duration, source: u, key: owned, coldPairing: 'independent' })) return;
  const added = e.findBuff(owned);
  if (old && added && !e.def.immune.has('frozen')) {
    old.data.gnosisPaired = added.data.gnosisPaired = true;
    b.applyStatus(e, 'freeze', { duration: Math.max(old.timeLeft, added.timeLeft),
      source: u, resistApplied: true });
  }
  coldModifiers(b, e); syncAll(b);
}

function syncOwner(b, u) {
  const t = firstTalent(u), inRange = present(u) ? new Set(b.enemiesInKeys(u.rangeKeys, u, plain)) : new Set();
  const holding = present(u) && third(u);
  for (const e of b.enemies) {
    const holdKey = key('freeze', u), weakKey = key('weak', u);
    const eligible = inRange.has(e) && present(e);
    if (eligible && holding && e.s.flags.freeze && !e.def.immune.has('frozen')) {
      if (!e.findBuff(holdKey)) b.addBuff(e, { key: holdKey, source: u,
        flags: { freeze: true, stun: true }, status: 'freeze', data: { gnosisFreezeHolder: true } });
    } else b.removeBuff(e, holdKey);
    const value = eligible && t ? e.s.flags.freeze ? t.damage_scale_freeze - 1
      : e.s.flags.cold ? t.damage_scale_cold - 1 : 0 : 0;
    const old = e.findBuff(weakKey);
    if (!value) b.removeBuff(e, weakKey);
    else if (old?.data.value !== value) {
      b.removeBuff(e, weakKey);
      b.applyStatus(e, 'fragile', { key: weakKey, value, source: u });
    }
  }
  const resist = u.def.talents.find(t => t.bb.interval != null)?.bb;
  for (const a of b.allyUnits) {
    const active = present(u) && u.mem.gnosisResist && present(a) && a.kind === 'op'
      && a.def.tags.includes('kjerag') && b.allySelectable(a, u);
    const owned = key('resist', u);
    if (!active) b.removeBuff(a, owned);
    else if (!a.findBuff(owned)) b.applyStatus(a, 'resist', { key: owned,
      value: -resist.one_minus_status_resistance, source: u });
  }
}
function syncAll(b) {
  if (b._gnosisSyncing) return;
  b._gnosisSyncing = true;
  try {
    for (const u of b.allyUnits) if (u.defId === ID) syncOwner(b, u);
    for (const e of b.enemies) coldModifiers(b, e);
  } finally { b._gnosisSyncing = false; }
}
function hit(b, u, e, scale, info, cold = null) {
  if (!canTargetEnemy(u, e, plain)) return;
  if (cold != null) applyCold(b, u, e, cold);
  syncAll(b);
  b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * scale, type: 'arts',
    applyWay: 'ranged', isAttack: true, isProjectile: true, isSkill: info.isSkill,
    attackId: info.attackId, tags: ['gnosis:attack'] });
}
function shoot(b, u, e, name, scale, info, done = () => {}) {
  if (!canTargetEnemy(u, e, plain)) { done(); return; }
  let finished = false;
  const complete = () => { if (!finished) { finished = true; done(); } };
  const p = b.addProjectile({ from: u, target: e, source: u, speed: component(name, '_speed'),
    maxAge: component(name, '_lifeTime'), visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: ({ target }) => { if (target) hit(b, u, target, scale, info, firstTalent(u)?.cold); complete(); } });
  // The shared projectile system silently removes lost targets. Observe this
  // source projectile's lifetime so the native wait-for-invalid SP lock ends.
  const watch = b.every(b.dt, () => {
    if (!b.projectiles.list.includes(p) && !b.projectiles.arriving.includes(p)) {
      complete(); watch.cancel();
    }
  });
}
function clearCast(b, u, token) {
  if (u.mem.gnosisCast !== token) return;
  u.mem.gnosisCast = null; u.mem.regularFormVisual = null;
  b.removeBuff(u, 'gnosis:cast');
}
function firstShot(b, u, p, e, info) {
  const token = u.mem.gnosisCast;
  if (!canTargetEnemy(u, e, p)) return;
  token.emitted = true; token.flying = 1; token.tail = true;
  const done = () => { token.flying--; if (!token.flying && !token.tail) clearCast(b, u, token); };
  shoot(b, u, e, 'projectile_chr_gnosis_s1', u.skill.bb.atk_scale, info, done);
  const delta = evidence.skills.skchr_gnosis_1.flatMap(g => g.components).map(c => c.data)
    .find(c => c._triggerDelta != null)._triggerDelta / token.rate;
  b.after(delta, () => {
    token.tail = false;
    if (u.mem.gnosisCast === token && present(u) && u.deploySeq === token.seq
      && u.attackControlEpoch === token.epoch && u.canAct && canTargetEnemy(u, e, p)) {
      token.flying++; shoot(b, u, e, 'projectile_chr_gnosis_s1', u.skill.bb.atk_scale, info, done);
    }
    if (!token.flying) clearCast(b, u, token);
  }, { owner: u });
}
function castSecond(b, u) {
  const charged = u.skill.charges >= 1; // Runtime already spent one charge.
  u.skill.setSpTotal(0); u.atkCd = 0;
  const animation = charged ? 'Skill_3' : 'Skill_2', playback = rate(u, false);
  const token = { seq: u.deploySeq, epoch: u.attackControlEpoch, charged, rate: playback };
  u.mem.gnosisCast = token;
  u.mem.regularFormVisual = { clip: animation, loop: false, attack: 'none', speed: playback };
  b.addBuff(u, { key: 'gnosis:cast', source: u, flags: { noSp: true, disarm: true } });
  // Capture control epoch after the adapter's own attack disarm.
  token.epoch = u.attackControlEpoch;
  const valid = () => present(u) && u.mem.gnosisCast === token && u.deploySeq === token.seq
    && u.attackControlEpoch === token.epoch && u.canAct;
  const watch = b.every(b.dt, () => { if (!valid()) { release.cancel(); finish.cancel();
    watch.cancel(); clearCast(b, u, token); } }, { owner: u });
  const release = b.after(model(u).hits[animation][0] / playback, () => {
    if (!valid()) return;
    const info = { isSkill: true, attackId: ++b._attackSeq };
    // Source target buffs precede damage; native S2 is direct, not a projectile.
    for (const e of b.enemiesInKeys(u.rangeKeys, u, plain)) {
      if (charged && !e.s.flags.cold && !e.def.immune.has('frozen'))
        b.applyStatus(e, 'freeze', { source: u, duration: u.skill.bb.cold });
      else applyCold(b, u, e, u.skill.bb.cold);
      syncAll(b);
      b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * u.skill.bb.atk_scale,
        type: 'arts', applyWay: 'ranged', isAttack: true, isSkill: true,
        attackId: info.attackId, tags: ['gnosis:s2'] });
    }
  }, { owner: u });
  const finish = b.after(model(u).durations[animation] / playback, () => {
    watch.cancel(); clearCast(b, u, token);
  }, { owner: u });
}
function finalAttack(b, u, reason, releaseAt = null) {
  if (!present(u) || !u.canAct || ['death', 'retreat'].includes(reason)) {
    u.mem.gnosisFinisher = null; u.mem.regularFormVisual = null; syncAll(b); return;
  }
  const token = { seq: u.deploySeq, epoch: u.attackControlEpoch };
  u.mem.gnosisFinisher = token;
  u.mem.regularFormVisual = { clip: 'Skill_4_End', loop: false, attack: 'none' };
  b.addBuff(u, { key: 'gnosis:final', source: u, flags: { noSp: true, disarm: true } });
  token.epoch = u.attackControlEpoch;
  const valid = () => present(u) && u.mem.gnosisFinisher === token && u.deploySeq === token.seq
    && u.canAct && u.attackControlEpoch === token.epoch;
  const finish = () => {
    if (u.mem.gnosisFinisher !== token) return;
    u.mem.gnosisFinisher = null; u.mem.regularFormVisual = null; u.atkCd = 0;
    b.removeBuff(u, 'gnosis:final'); syncAll(b);
  };
  const watch = b.every(b.dt, () => { if (!valid()) { release.cancel(); cleanup.cancel();
    watch.cancel(); finish(); } }, { owner: u });
  const delay = releaseAt == null ? model(u).hits.Skill_4_End[0] / rate(u) : Math.max(0, releaseAt - b.time);
  const release = b.after(delay, () => {
    if (!valid()) return;
    const victims = b.enemiesInKeys(u.rangeKeys, u, plain).filter(e => e.s.flags.freeze);
    const info = { isSkill: true, attackId: ++b._attackSeq };
    for (const e of victims) {
      hit(b, u, e, u.skill.bb.atk_scale, info);
      // Native clear_freeze action finishes its short .01-second buff AFTER
      // damage, with no source check. Keep other status families intact.
      b.after(.01, () => { for (const buff of [...e.buffs]) if (buff.status === 'freeze')
        b.removeBuff(e, buff.key); syncAll(b); });
    }
  }, { owner: u });
  const cleanup = b.after(model(u).durations.Skill_4_End / rate(u), () => {
    watch.cancel(); finish();
  }, { owner: u });
}
export function customizeGnosisKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { ...plain, hits: 1, hitsFn: null, chain: null, splashRadius: 0,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false,
    rangeAoe: false, dmgMul: null, heal: null, install: null, interruptOnSkillChange: true,
    canAttack: () => !u.mem.gnosisCast && !u.mem.gnosisFinisher,
    acquireTargets: (_b, a, p) => targets(_b, a, p, third(a) ? a.skill.bb.max_target : 1),
    attackVisual: (_b, a) => third(a) ? 'none' : a.skill.pending ? 'Skill' : 'Attack',
    windup: (_b, a) => third(a) ? 0 : model(a).hits[a.skill.pending ? 'Skill' : 'Attack'][0] / rate(a),
    launchAttack: (_b, a, p, e, info) => {
      if (info.isSkill && a.skill.id.endsWith('_1')) firstShot(_b, a, p, e, info);
      else shoot(_b, a, e, third(a) ? 'projectile_chr_gnosis_s3' : 'projectile_chr_gnosis', 1, info);
    } };
  const s = def.skill;
  if (s.id.endsWith('_1')) kit.skill = { kind: 'instant', attack: { retargetOnRelease: true,
    afterAttack: (_b, a, victims, ctx) => {
      const token = a.mem.gnosisCast;
      if (token && !token.emitted) {
        if (ctx.inputTargets.length && ctx.inputTargets.every(e => !e.alive)) a.skill.addCharge(1);
        clearCast(_b, a, token);
      }
    } }, canActivate: () => !u.mem.gnosisCast, onStart: () => {
      u.mem.gnosisCast = { seq: u.deploySeq, epoch: u.attackControlEpoch, rate: rate(u), emitted: false };
      b.addBuff(u, { key: 'gnosis:cast', source: u, flags: { noSp: true } });
    }, onEnd: ({ reason }) => { if (reason !== 'instant') clearCast(b, u, u.mem.gnosisCast); } };
  else if (s.id.endsWith('_2')) kit.skill = { kind: 'instant', charges: 2, trigger: 'NEVER', chargedState: () => u.skill.charges === 2,
    canActivate: () => !u.mem.gnosisCast, onStart: () => castSecond(b, u) };
  else kit.skill = { kind: 'duration', duration: s.duration, trigger: 'NEVER',
    canActivate: () => !u.mem.gnosisFinisher, mods: { aspd: s.bb.attack_speed }, attack: {},
    onStart: () => {
      u.atkCd = 0; const seq = u.deploySeq, act = u.skill.activations;
      u.mem.regularFormVisual = { clip: 'Skill_4_Begin', loop: false, attack: 'none' };
      b.addBuff(u, { key: 'gnosis:begin', duration: model(u).durations.Skill_4_Begin,
        flags: { disarm: true } });
      b.after(model(u).durations.Skill_4_Begin, () => {
        if (present(u) && u.deploySeq === seq && third(u) && u.skill.activations === act)
          u.mem.regularFormVisual = { clip: 'Skill_4_Loop', loop: true, attack: 'none' };
      }, { owner: u });
      // No attack events exist on the original continuous loop. The local
      // dispatcher reserves the native End hit window inside the selected
      // duration; compiled same-frame/early-finish ordering is still unverified.
      const endBoundary = b.time + s.duration - b.dt; // SkillRuntime expires in the allies phase of this tick.
      b.after(Math.max(0, endBoundary - b.time - model(u).hits.Skill_4_End[0] / rate(u)), () => {
        if (present(u) && u.deploySeq === seq && third(u) && u.skill.activations === act)
          finalAttack(b, u, 'duration', endBoundary);
      }, { owner: u }); syncAll(b);
    }, onEnd: () => syncAll(b) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installGnosis({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b._gnosisColdSeq ??= 0;
  if (!b._gnosisInstalled) {
    b._gnosisInstalled = true;
    b.on('statusApplied', () => syncAll(b)); b.on('tick', () => syncAll(b));
  }
  b.on('deploy', ({ unit }) => {
    if (unit === u) {
      u.mem.gnosisCast = null; u.mem.gnosisFinisher = null; u.mem.gnosisResist = false;
      u.mem.regularFormVisual = null;
      const t = def.talents.find(t => t.bb.interval != null)?.bb, seq = u.deploySeq;
      if (t) b.after(t.interval, () => {
        if (present(u) && u.deploySeq === seq) { u.mem.gnosisResist = true; syncAll(b); }
      }, { owner: u });
    }
    syncAll(b);
  }, { owner: u });
  b.on('tick', () => {
    const cast = u.mem.gnosisCast;
    if (cast && (!present(u) || !u.canAct || u.attackControlEpoch !== cast.epoch)) {
      clearCast(b, u, cast); if (u.skill.pending) u.skill.end('interrupted');
    }
  }, { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => {
    if (unit === u) {
      clearCast(b, u, u.mem.gnosisCast); u.mem.gnosisFinisher = null;
      u.mem.gnosisResist = false; u.mem.regularFormVisual = null;
      b.removeBuff(u, 'gnosis:final'); b.removeBuff(u, 'gnosis:begin');
    }
    syncAll(b);
  }, { owner: u });
}
