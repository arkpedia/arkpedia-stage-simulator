// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_MEDIC_FOURTH_OPERATORS } from '../../../shared/arkpedia/five-star-medic-fourth-operators.js';
import evidence from '../../../data/arkpedia-five-star-medic-fourth-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { isHpLoss } from '../damage.js';

const SILENCE = 'char_108_silent', VENDELA = 'char_494_vendla';
const live = a => a?.alive && a.deployed && !a.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const timed = clip => (_b, u) => model(u).hits[clip][0] / rate(u);
const healable = (b, a, u) => live(a) && a.kind !== 'device' && !a.s.flags.untargetable
  && b.allySelectable(a, u) && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
const hpOrder = (a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq;
const injured = (b, u) => b.allyUnits.filter(a => healable(b, a, u)
  && bodyInKeys(a, u.rangeKeySet) && a.hp < a.s.maxHp - .01).sort(hpOrder);
// Original non-HEAL postFilter19 / professionMask639 selector explicitly ignores
// target-free and ally-target-free. Healing restrictions do not apply to marking.
const maxHpOperator = (b, u) => b.allyUnits.filter(a => live(a) && a.kind === 'op'
  && bodyInKeys(a, u.rangeKeySet)).sort((a, z) => z.s.maxHp - a.s.maxHp || a.deploySeq - z.deploySeq)[0];

export function customizeFiveStarMedicFourthKit({ id, def, unit: u, kit }) {
  if (!FIVE_STAR_MEDIC_FOURTH_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, first = s.id === FIVE_STAR_MEDIC_FOURTH_OPERATORS[id].skillIds[0];
  kit.trait = { ...kit.trait, install: null, attack: 'ranged', projectile: 'none', canHitFly: true,
    windup: timed('Attack'), attackVisual: 'Attack', interruptOnSkillChange: true };
  if (id === SILENCE) {
    // A custom projectile checks HEAL eligibility again on impact. An already
    // emitted projectile survives source withdrawal, as the original does.
    kit.trait.dmgType = 'heal'; kit.trait.heal = null;
    kit.trait.acquireTargets = (b, unit) => injured(b, unit).slice(0, 1 + Math.max(0, Math.floor(unit.s.maxTargets)));
    kit.trait.launchAttack = (b, unit, _prof, target) => b.addProjectile({
      from: unit, target, speed: 5, source: unit, visual: 'orb', data: { arkpediaTrackedVisual: true },
      onHit: ({ target: a }) => { if (healable(b, a, unit)) b.heal(unit, a, unit.s.atk); },
    });
    kit.skill = first ? { kind: 'duration', mods: { atkPct: bb.atk } }
      : { kind: 'instant', trigger: 'SP_FULL',
        canActivate: () => (u.mem.silentState?.stock ?? 1) < 1,
        onStart: ({ battle: b }) => {
          const state = u.mem.silentState;
          if (state) { state.stock = Math.min(1, state.stock + bb.cnt); syncSilenceStock(b, u); }
        } };
  } else {
    kit.trait.dmgType = 'arts'; kit.trait.heal = null;
    kit.trait.projectile = 'orb'; kit.trait.projectileSpeed = 10;
    kit.skill = first ? { kind: 'duration', mods: { aspd: bb.attack_speed } }
      : { kind: 'duration', onStart: ({ battle: b }) => vendelaCast(b, u, def),
        onEnd: ({ battle: b }) => clearVendelaCast(b, u) };
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}

function syncSilenceStock(b, u) {
  const key = 'silence:stock-full', state = u.mem.silentState;
  if (live(u) && state?.stock >= 1) {
    if (!u.findBuff(key)) b.addBuff(u, { key, flags: { noSp: true } });
  } else b.removeBuff(u, key);
}

function registerSilenceSpeed(b, u, value) {
  const sources = b._arkpediaSilenceSpeed ??= new Map();
  sources.set(u.id, { unit: u, value });
  const sync = () => {
    for (const a of b.allyUnits) {
      let highest = null;
      if (live(a) && a.kind === 'op' && a.def.profession === 'MEDIC'
        && !a.s.flags.untargetable && !a.s.flags.isolated)
        for (const entry of sources.values()) if (live(entry.unit)
          && (!highest || entry.value > highest.value)) highest = entry;
      const old = a.findBuff('silent_t_1');
      if (!highest) b.removeBuff(a, 'silent_t_1');
      else if (old?.mods.aspd !== highest.value || old.source !== highest.unit)
        b.addBuff(a, { key: 'silent_t_1', source: highest.unit, mods: { aspd: highest.value } });
    }
  };
  for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: u });
  return sync;
}

function registerVendelaHealing(b, u, value) {
  const sources = b._arkpediaVendelaHealing ??= new Map();
  sources.set(u.id, { unit: u, value, target: null });
  const sync = () => {
    for (const entry of sources.values()) entry.target = live(entry.unit) ? maxHpOperator(b, entry.unit) : null;
    for (const a of b.allyUnits) {
      const highest = [...sources.values()].filter(x => x.target === a).sort((x, y) => y.value - x.value)[0];
      const old = a.findBuff('vendla_t_1');
      if (!highest) b.removeBuff(a, 'vendla_t_1');
      else if (old?.mods.healingTakenMul !== highest.value || old.source !== highest.unit)
        b.addBuff(a, { key: 'vendla_t_1', source: highest.unit, mods: { healingTakenMul: highest.value } });
    }
  };
  for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: u });
  return sync;
}

function clearVendelaCast(b, u) {
  for (const a of b.allyUnits) {
    const marker = a.findBuff('vendla_s_2');
    if (marker?.source === u) b.removeBuff(a, 'vendla_s_2');
  }
  b.removeBuff(u, 'vendela:cast'); b.removeBuff(u, 'vendla_s_2:atk');
  u.mem.regularFormVisual = null; u.mem.vendelaMarked = null;
}

function vendelaCast(b, u, def) {
  const seq = u.deploySeq, activation = u.skill.activations, r = rate(u);
  const release = model(u).hits.Skill[0] / r, total = model(u).durations.Skill / r;
  let interrupted = false;
  u.mem.regularFormVisual = { clip: 'Skill', loop: false };
  b.addBuff(u, { key: 'vendela:cast', duration: total, flags: { disarm: true, noSp: true } });
  const valid = () => !interrupted && live(u) && u.deploySeq === seq
    && u.skill.activations === activation && u.skill.active;
  const watch = b.every(b.dt, () => {
    if (valid() && u.canAct) return;
    interrupted = true; watch.cancel();
    if (u.deploySeq === seq && u.skill.activations === activation && u.skill.active) u.skill.end('cast-interrupted');
  }, { owner: u });
  b.after(release, () => {
    watch.cancel(); if (!valid() || !u.canAct) return;
    const target = maxHpOperator(b, u);
    if (!target) { u.skill.end('no-target'); return; }
    u.mem.vendelaMarked = target;
    b.addBuff(target, { key: 'vendla_s_2', source: u, duration: u.skill.timeLeft,
      mods: { taunt: def.skill.bb.taunt_level } });
  }, { owner: u });
  b.after(total, () => {
    if (!valid()) return;
    b.removeBuff(u, 'vendela:cast'); u.mem.regularFormVisual = null;
    b.addBuff(u, { key: 'vendla_s_2:atk', source: u, duration: u.skill.timeLeft,
      mods: { atkPct: def.skill.bb.atk } });
  }, { owner: u });
}

/** Device category2 and ordinary HEAL purpose are preserved. `_isCont1` has no
 * recovered native tick dispatcher; ATK/BAT integrated over dt is our explicit
 * continuous interpretation, not a claim of original first/last-frame cadence. */
export function installSilenceDrone(b, token, state) {
  token.kind = 'device';
  const expires = b.time + 10;
  b.on('tick', ({ dt }) => {
    if (!live(token) || !live(state.owner) || !token.canAct || b.time >= expires - 1e-9) return;
    for (const a of b.allyUnits) if (healable(b, a, token) && bodyInKeys(a, token.rangeKeySet))
      b.heal(token, a, token.s.atk * dt / token.s.interval);
  }, { owner: token });
  b.after(10, () => { if (live(token)) b.retreat(token, { permanent: true, reason: 'drone-expired' }); }, { owner: token });
  syncSilenceStock(b, state.owner);
}

export function installFiveStarMedicFourth({ battle: b, unit: u, def }) {
  if (!FIVE_STAR_MEDIC_FOURTH_OPERATORS[def.charId]) return;
  const talent = def.talents[0]?.bb;
  if (def.charId === SILENCE) {
    if (talent) registerSilenceSpeed(b, u, talent.attack_speed);
    for (const event of ['deploy', 'tick']) b.on(event, () => syncSilenceStock(b, u), { owner: u });
    return;
  }
  if (talent) registerVendelaHealing(b, u, talent.heal_scale);
  b.on('damaged', ({ source, target, amount, dmg }) => {
    if (!live(u) || !dmg || isHpLoss(dmg) || dmg.type === 'element' || dmg.type === 'elemental') return;
    if (source === u && target.side === 'enemy' && amount > 0) {
      const counter = dmg.tags.includes('vendela:s2-counter');
      const candidates = b.allyUnits.filter(a => healable(b, a, u) && bodyInKeys(a, u.rangeKeySet)
        && (!counter || a.findBuff('vendla_s_2'))).sort(hpOrder);
      if (candidates[0]) b.heal(u, candidates[0], amount * def.traitBb.scale);
    }
    // Source ON_TAKE_DAMAGE checks ENEMY modifier source, not IsAttack. A
    // fully absorbed accepted hit can counter; dodge/cancel never emits here.
    const marker = target.findBuff('vendla_s_2');
    if (source?.side !== 'enemy' || marker?.source !== u || !live(source)
      || !u.skill.active || u.skill.id !== 'skchr_vendla_2') return;
    b.dealDamage(u, source, { amount: u.s.atk * def.skill.bb.atk_scale, type: 'arts',
      isAttack: true, isSkill: true, applyWay: 'ranged', tags: ['vendela:s2-counter'] });
  }, { owner: u });
  // Already emitted attacks do not heal through an invalid recipient. Counter
  // damage targets its actual source directly; no range/acquisition is invented.
  b.on('death', ({ unit: removed }) => { if (removed === u) clearVendelaCast(b, u); }, { owner: u });
}
