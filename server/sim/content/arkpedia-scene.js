// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs, exact facings and bounded native dispatch assumptions are
// retained together in data/arkpedia-scene-prefabs.json.
import evidence from '../../../data/arkpedia-scene-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { absoluteRangeKeys } from '../targeting.js';

const OWNER = 'char_336_folivo', TOKEN = 'token_10010_folivo_car';
const live = u => u?.alive && u.deployed && !u.hidden;
const ownTokens = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && t.alive && t.deployed);
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const modeKey = u => `scene:mode:${u.id}`;
const camoKey = u => `scene:camouflage:${u.id}`;
const revealKey = t => `scene:reveal:${t.id}`;
const eligible = (b, u, t) => live(u) && live(t) && !t.s.flags.untargetable && b.allySelectable(t, u);

function syncReveal(b, t) {
  const expanded = t.mem.sceneMode === 2;
  const grid = expanded ? evidence.rangeTable['x-2'].grids.map(({ row, col }) => [row, col]) : t.def.talents[0].rangeGrid;
  const keys = absoluteRangeKeys(grid, t.tileR, t.tileC, t.dir), key = revealKey(t);
  for (const e of b.enemies) {
    // This is a non-HEAL/ATTACK purpose0 reveal aura, not an attack selection.
    // Invisible and Sleep are deliberately not ordinary attack exclusions here.
    const allowed = live(t) && live(t.ownerUnit) && live(e) && !e.s.flags.untargetable && bodyInKeys(e, keys);
    if (!allowed) b.removeBuff(e, key);
    else if (!e.findBuff(key)) b.addBuff(e, { key, source: t, flags: { reveal: true } });
  }
}
function syncOwner(b, u) {
  for (const t of ownTokens(b, u)) {
    const mode = u.skill.active && eligible(b, u, t) ? Number(u.skill.id.at(-1)) : 0;
    const bb = u.skill.bb;
    if (mode) {
      if (!t.findBuff(modeKey(u))) b.addBuff(t, { key: modeKey(u), source: u,
        mods: mode === 1 ? { atkPct: bb.atk } : { atkPct: bb.atk, defPct: bb.def, resFlat: bb.magic_resistance } });
    } else b.removeBuff(t, modeKey(u));
    t.mem.sceneMode = mode;
    // Native ConditionalBuff disables camouflage while blocked, restoreDelay0.
    if (mode === 1 && t.blocking.length === 0) {
      if (!t.findBuff(camoKey(u))) b.addBuff(t, { key: camoKey(u), source: u, flags: { camou: true } });
    } else b.removeBuff(t, camoKey(u));
    syncReveal(b, t);
  }
}
function clearReveal(b, t) { for (const e of b.enemies) b.removeBuff(e, revealKey(t)); }
function recharge(b, u, count) {
  const state = b.regularSummons?.get(`summon:${OWNER}`);
  if (state?.owner === u && live(u)) state.stock = Math.min(state.record.stats.maxDeckStackCnt, state.stock + count);
}

export function customizeSceneKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== OWNER) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'bolt', projectileSpeed: 10,
    canHitFly: true, maxTargets: 1, hitAllBlocked: false, hits: 1, install: null,
    retargetOnRelease: true, attackVisual: 'Attack',
    windup: (_b, unit) => model(unit).hits.Attack[0] / rate(unit) };
  const s = def.skill, first = s.id === 'skchr_folivo_1';
  kit.skill = { id: s.id, name: s.name, kind: first ? 'toggle' : 'duration',
    duration: s.duration, ...(first ? { trigger: 'SP_FULL' } : {}),
    onStart: () => {
      if (first) {
        const seq = u.deploySeq, activation = u.skill.activations;
        u.mem.regularFormVisual = { clip: 'Skill_1', loop: false };
        b.after(model(u).durations.Skill_1, () => {
          if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null;
        }, { owner: u });
      } else recharge(b, u, s.bb.cnt);
      syncOwner(b, u);
    },
    onTick: () => syncOwner(b, u),
    onEnd: () => {
      u.mem.regularFormVisual = null; syncOwner(b, u);
      if (!first && live(u)) {
        // Source postcast remote command has no animation or predelay. The
        // inherited waitEvent1/waitForCasting0 dispatch remains explicitly
        // bounded; this is not an ordinary attack or an emitted projectile.
        for (const t of ownTokens(b, u)) if (t.canAct && !t.s.flags.disarm)
          b.applyStatus(t, 'stun', { source: t, duration: s.bb.stun });
      }
    },
  };
  u.mem.summonSkillSync = () => syncOwner(b, u);
}
export function installScene({ battle: b, unit: u, def }) {
  if (def.charId !== OWNER) return;
  b.every(b.dt, () => syncOwner(b, u), { owner: u });
  b.on('deploy', () => { if (live(u)) syncOwner(b, u); }, { owner: u });
  b.on('death', ({ unit: dead }) => {
    if (dead !== u) return;
    for (const t of ownTokens(b, u)) { b.removeBuff(t, modeKey(u)); b.removeBuff(t, camoKey(u)); clearReveal(b, t); }
  }, { owner: u });
}

/** The root factory retains source card DP/stock/slots and original stat scaling.
 * No owner stats, ordinary skill runtime or fabricated device kit is copied. */
export function createSceneBuggyCam(b, state, row, col, dir) {
  if (state.record.id !== TOKEN || !state.record.talents[0]?.rangeGrid?.length)
    throw Error('Missing reviewed Scene camera source');
  const kit = { skill: null,
    trait: { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
      maxTargets: 1, hitAllBlocked: false, hits: 1, install: null, retargetOnRelease: true,
      attackVisual: 'Attack', windup: (_b, t) => model(t).hits.Attack[0] / rate(t) },
    install: (battle, t) => {
      battle.addBuff(t, { key: 'folivo_healfree', flags: { healFree: true }, persist: true, allowDead: true });
      battle.on('deploy', ({ unit }) => { if (unit === t) { syncOwner(battle, state.owner); syncReveal(battle, t); } }, { owner: t });
      battle.on('death', ({ unit }) => { if (unit === t) clearReveal(battle, t); }, { owner: t });
    } };
  return b.spawnToken(state.owner, TOKEN, row, col, { dir, def: state.record, kit });
}
