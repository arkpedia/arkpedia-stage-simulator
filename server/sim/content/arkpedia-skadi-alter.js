// SPDX-License-Identifier: GPL-3.0-or-later
// Full owner/token source graphs: arkpedia-skadi-alter-prefabs.json. Runtime
// clocks and DamageSplit's post-mitigation/pre-shield receipt are explicit
// bounded mappings; serialized NORMAL is not treated as another attack.
import evidence from '../../../data/arkpedia-skadi-alter-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { aggregateMods } from '../buffs.js';
const ID = 'char_1012_skadi2', TOKEN = 'token_10017_skadi2_dedant';
const live = a => a?.alive && a.deployed && !a.hidden && !a._removing;
const mode = u => live(u) && u.skill.active ? Number(u.skill.id.at(-1)) : 0;
const eligible = a => live(a) && a.kind !== 'device';
const own = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && live(t));
const areas = (b, u) => live(u) ? [u, ...own(b, u)] : [];
const inside = (b, u, a) => areas(b, u).some(t => bodyInKeys(a, t.rangeKeySet));
const key = (u, name) => `skadi2:${name}:${u.id}`;
function clear(b, u, names = ['heal', 'inspire', 'inspire-clock', 'protect']) {
  for (const a of b.allyUnits) for (const name of names) b.removeBuff(a, key(u, name));
}
function predatory(b, u) {
  const bb = u.def.talents[1]?.bb, k = key(u, 'predatory');
  if (!bb || !live(u)) { b.removeBuff(u, k); return; }
  const allies = b.allyUnits.filter(a => a !== u && a.kind === 'op' && live(a) && inside(b, u, a));
  const value = allies.length ? bb[allies.some(a => a.def.tags.includes('abyssal'))
    ? 'skadi2_t_2[atk][2].atk' : 'skadi2_t_2[atk][1].atk'] : 0;
  if (!value) b.removeBuff(u, k);
  else if (u.findBuff(k)?.mods.atkPct !== value) b.addBuff(u, { key: k, source: u, mods: { atkPct: value } });
}
function recovery(b, u, a) {
  if (!live(u) || !eligible(a) || a.s.flags.isolated || !inside(b, u, a) || mode(u) === 3) return;
  const ratio = mode(u) ? u.skill.bb['attack@atk_to_hp_recovery_ratio']
    : u.def.traitBb['attack@atk_to_hp_recovery_ratio'];
  // Regeneration reaches heal-free/no-heal recipients. This bounded regeneration
  // path skips healing modifiers; hpRegenMul still scales regeneration.
  const mul = aggregateMods(a.buffs).mul.hpRegenMul ?? 1;
  b.heal(u, a, u.s.atk * ratio * mul, { self: true, regen: true, skipModifierEvent: true });
}
function inspire(b, u, a) {
  if (!live(u) || !eligible(a) || !inside(b, u, a) || mode(u) < 2
    || a.def.subProf === 'bard' || a.mem.noInspire || a.findBuff('immune_to_encourage')) return;
  const mods = { atkFinalFlat: u.s.atk * u.skill.bb.atk };
  const priority = { atkFinalFlat: u.skill.bb.atk };
  if (mode(u) === 2) { mods.defFinalFlat = u.s.def * u.skill.bb.def; priority.defFinalFlat = u.skill.bb.def; }
  const k = key(u, 'inspire'), old = a.findBuff(k);
  if (!old || Object.keys(mods).some(k => old.mods[k] !== mods[k]))
    b.addBuff(a, { key: k, source: u, tags: ['inspire'], mods, data: { inspirePriority: priority } });
}
function sync(b, u) {
  predatory(b, u);
  const m = mode(u);
  for (const a of b.allyUnits) {
    const allowed = live(u) && eligible(a) && inside(b, u, a);
    const healKey = key(u, 'heal'), clockKey = key(u, 'inspire-clock'), inspireKey = key(u, 'inspire');
    if (!allowed || m === 3 || a.s.flags.isolated) b.removeBuff(a, healKey);
    else if (!a.findBuff(healKey)) {
      b.addBuff(a, { key: healKey, source: u, interval: 1, onTick: () => recovery(b, u, a) });
      recovery(b, u, a);
    }
    const canInspire = allowed && m >= 2 && a.def.subProf !== 'bard'
      && !a.mem.noInspire && !a.findBuff('immune_to_encourage');
    if (!canInspire) { b.removeBuff(a, clockKey); b.removeBuff(a, inspireKey); }
    else if (!a.findBuff(clockKey)) {
      b.addBuff(a, { key: clockKey, source: u, interval: 1, onTick: () => inspire(b, u, a) });
      inspire(b, u, a);
    }
    const protectKey = key(u, 'protect');
    if (allowed && a !== u && m === 1) {
      if (!a.findBuff(protectKey)) b.addBuff(a, { key: protectKey, source: u,
        tags: ['skadi2:protect'], data: { ratio: u.skill.bb.damage_resistance } });
    } else b.removeBuff(a, protectKey);
  }
}
// One hook for every owner and overlapping Seaborn area. An HP loss never
// enters damageFinal, which prevents recursion and receiving DEF/RES twice.
function installShare(b) {
  if (b._skadi2Share) return;
  b._skadi2Share = b.on('damageFinal', ctx => {
    const protections = ctx.target.buffs.filter(x => x.tags.includes('skadi2:protect')
      && live(x.source) && x.source !== ctx.target && mode(x.source) === 1
      && inside(b, x.source, ctx.target)).sort((a, z) => z.data.ratio - a.data.ratio);
    const p = protections[0];
    if (!p || !(ctx.amount > 0)) return;
    const transfer = ctx.amount * p.data.ratio;
    ctx.amount -= transfer;
    b.loseHp(p.source, transfer, { source: ctx.credit, from: ctx.dmg, tags: ['skadi2:share'] });
  }, { priority: -2000 });
}
// Original per-recipient damage aura waits on entry, then repeats once a
// second. Owner and Seaborn own separate clocks and both credit owner ATK.
function startDamageAura(b, area, u, delay) {
  const clocks = new Map();
  const tick = () => {
    if (!live(area) || !live(u) || mode(u) !== 3) { clocks.clear(); return; }
    const victims = b.enemies.filter(e => live(e) && !e.s.flags.untargetable && bodyInKeys(e, area.rangeKeySet));
    const current = new Set(victims);
    for (const e of clocks.keys()) if (!current.has(e)) clocks.delete(e);
    for (const e of victims) {
      if (!clocks.has(e)) clocks.set(e, b.time + delay);
      if (b.time + 1e-9 < clocks.get(e)) continue;
      clocks.set(e, clocks.get(e) + 1);
      b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * u.skill.bb.atk_scale,
        type: 'true', canDodge: false, isSkill: true, isSplash: true,
        tags: ['skadi2:s3', area === u ? 'skadi2:owner' : 'skadi2:seaborn'] });
    }
  };
  tick();
  const clock = b.every(b.dt, tick, { owner: area });
  return () => { clock.cancel(); clocks.clear(); };
}
function setTokenMode(b, t, u) {
  const m = mode(u);
  if (t.mem.skadi2Mode === m) return;
  t.mem.skadi2Mode = m; t.mem.skadi2Damage?.(); t.mem.skadi2Damage = null;
  // The hidden passive wrapper has no player activation, SP or skill bar.
  if (m === 3) t.mem.skadi2Damage = startDamageAura(b, t, u, .85);
  if (!t.mem.skadi2Starting) t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: 'Idle' };
}
export function customizeSkadiAlterKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { canAttack: () => false, attack: 'ranged', dmgType: 'arts', projectile: 'none',
    canHitFly: true, maxTargets: 1, hits: 1, allInRange: false, install: null };
  const s = def.skill, m = Number(s.id.at(-1));
  kit.skill = { id: s.id, name: s.name, kind: m === 2 ? 'toggle' : 'duration',
    ...(m === 2 ? { trigger: 'SP_FULL' } : {}),
    onStart: () => {
      clear(b, u);
      if (m === 1) {
        b.heal(u, u, u.s.maxHp, { ignoreHealFree: true });
        b.addBuff(u, { key: key(u, 'max-hp'), mods: { hpPct: s.bb.max_hp } }); void u.s;
      }
      const generation = u.mem.skadi2Generation = (u.mem.skadi2Generation ?? 0) + 1;
      const clip = `Skill_${m}_Begin`;
      u.mem.regularFormVisual = { clip, loop: false };
      b.after(evidence.models[ID].Front.durations[clip], () => {
        if (live(u) && u.skill.active && generation === u.mem.skadi2Generation)
          u.mem.regularFormVisual = { clip: `Skill_${m}_Loop`, loop: true };
      }, { owner: u });
      if (m === 3) {
        u.mem.skadi2Damage = startDamageAura(b, u, u, .9);
        let next = b.time + .95;
        u.mem.skadi2Bleed = b.every(b.dt, () => {
          if (!live(u) || mode(u) !== 3 || b.time + 1e-9 < next) return;
          next += 1;
          b.loseHp(u, u.s.maxHp * s.bb.hp_ratio, { source: u, tags: ['skadi2:bleeding'] });
        }, { owner: u });
      }
      for (const t of own(b, u)) setTokenMode(b, t, u);
      sync(b, u);
    },
    onEnd: () => {
      u.mem.skadi2Generation = (u.mem.skadi2Generation ?? 0) + 1;
      u.mem.skadi2Damage?.(); u.mem.skadi2Damage = null;
      u.mem.skadi2Bleed?.cancel(); u.mem.skadi2Bleed = null;
      b.removeBuff(u, key(u, 'max-hp')); clear(b, u);
      u.mem.regularFormVisual = null;
      for (const t of own(b, u)) setTokenMode(b, t, u);
      sync(b, u);
    },
  };
}
export function installSkadiAlter({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.addBuff(u, { key: 'immune_to_encourage', persist: true, allowDead: true });
  b.addBuff(u, { key: 'skadi2_c[mark]', persist: true, allowDead: true });
  installShare(b);
  for (const event of ['deploy', 'death', 'tick']) b.on(event, () => sync(b, u), { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) {
    clear(b, u); b.removeBuff(u, key(u, 'predatory'));
    u.mem.skadi2Damage?.(); u.mem.skadi2Bleed?.cancel();
  } }, { owner: u });
}
export function createSkadiSeaborn(b, state, row, col) {
  const u = state.owner, r = state.record;
  if (r.id !== TOKEN || !r.skill || Number(r.skill.skillId.at(-1)) !== Number(u.def.skill.id.at(-1)))
    throw Error('Seaborn does not match its selected owner skill');
  const kit = { skill: null, trait: { canAttack: () => false, attack: 'ranged', projectile: 'none', canHitFly: true },
    install: (battle, t) => {
      t.kind = 'device'; t.deploymentSlotCost = 0;
      battle.addBuff(t, { key: 'skadi2:seaborn', persist: true, allowDead: true,
        flags: { invulnerable: true, untargetable: true, noSp: true } });
      battle.on('deploy', ({ unit }) => { if (unit !== t) return;
        t.mem.skadi2Starting = true;
        t.mem.regularFormVisual = { clip: 'Start', loop: false, die: 'Idle' };
        setTokenMode(battle, t, u); sync(battle, u);
        battle.after(evidence.models[TOKEN].Front.durations.Start, () => {
          if (live(t)) { t.mem.skadi2Starting = false;
            t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: 'Idle' }; }
        }, { owner: t });
        battle.after(r.talents[0].bb.duration, () => { if (live(t))
          battle.retreat(t, { permanent: true, reason: 'seaborn-expired' });
        }, { owner: t });
      }, { owner: t });
      battle.on('death', ({ unit }) => { if (unit !== t) return;
        t.mem.skadi2Damage?.();
        state.stock = Math.min(1, state.stock + 1); state.readyAt = battle.time + r.stats.respawnTime;
        sync(battle, u);
      }, { owner: t });
    } };
  return b.spawnToken(u, TOKEN, row, col, { dir: 'RIGHT', def: r, kit });
}
