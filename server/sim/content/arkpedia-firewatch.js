// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs and unresolved native dispatch are retained in
// data/arkpedia-firewatch-prefabs.json. S2 uses an explicit bounded fallback.
import evidence from '../../../data/arkpedia-firewatch-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy, absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';

const ID = 'char_158_milu', SECOND = 'skchr_milu_2';
const live = u => u?.alive && u.deployed && !u.hidden;
const rate = u => Math.min(1, u.s.aspd / 100);
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const legal = (u, e) => canTargetEnemy(u, e, { canHitFly: true });
const scale = (u, e) => e.def?.applyWay === 'RANGED'
  ? u.def.talents.find(t => t.bb.atk_scale != null)?.bb.atk_scale ?? 1 : 1;

function arrow(b, u, p, target, info) {
  if (!legal(u, target)) return;
  b.addProjectile({ from: u, target, source: u, speed: 14, maxAge: 7, visual: 'arrow',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: current, x, y }) => {
      if (!current || !legal(u, current)) return;
      // The selected Global talent describes the victim's attack mode, not
      // a blanket bonus to every arrow fired by this ranged operator.
      resolveHit(b, u, { ...p, atkScale: (p.atkScale ?? 1) * scale(u, current) }, current, info, x, y);
    } });
}

function destinations(b, u, count) {
  const keys = absoluteRangeKeys(u.def.rangeGrid, u.tileR, u.tileC, u.dir);
  const preferred = keys.filter(key => b.enemies.some(e => legal(u, e) && bodyInKeys(e, [key])));
  const empty = keys.filter(key => !preferred.includes(key));
  // Native filter6/sort0/RNG dispatch is unresolved. Select unique in-range
  // tiles, enemy-occupied first, with seeded random order inside each group.
  return [...b.rng.shuffle(preferred), ...b.rng.shuffle(empty)].slice(0, count)
    .map(key => ({ x: key % COLS, y: Math.floor(key / COLS) }));
}

function clearCast(b, u, state) {
  if (u.mem.firewatchCast !== state) return;
  u.mem.firewatchCast = null; u.mem.regularFormVisual = null;
}

function bombs(b, u, bb, state) {
  const points = destinations(b, u, bb.max_cnt);
  points.forEach((point, index) => {
    // The native bomb is static with lifeTime .5 and reach-only collision.
    // Keep that delay; do not manufacture a falling speed or tracking target.
    b.addProjectile({ from: point, to: point, source: u, flightTime: .5, maxAge: .5,
      visual: 'bomb', data: { arkpediaTrackedVisual: true }, onHit: ({ x, y }) => {
        for (const e of b.enemiesInRadius(x, y, 1.2)) {
          if (!legal(u, e)) continue;
          b.dealDamage(u, e, { amount: u.s.atk * bb.atk_scale * scale(u, e), type: 'phys',
            isAttack: true, isSkill: true, isProjectile: true, applyWay: 'ranged',
            attackId: `firewatch:${u.id}:${state.activation}:${index}`, tags: ['firewatch:bomb'] });
        }
        b.fx('explode', { x, y, radius: 1.2 });
      } });
  });
  state.points = points; state.released = true;
}

export function customizeFirewatchKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    priority: 'lowDef', maxTargets: 1, hits: 1, hitsFn: null, allInRange: false,
    hitAllBlocked: false, maxTargetsByBlock: false, splashRadius: 0, chain: null, dmgMul: null,
    retargetOnRelease: false, interruptOnSkillChange: true, launchAttack: arrow,
    canAttack: () => !u.mem.firewatchCast,
    windup: () => model(u).hits.Attack[0] / rate(u), attackVisual: 'Attack' };
  const s = def.skill;
  if (s.id !== SECOND) kit.skill = { kind: 'duration', duration: s.duration,
    mods: { atkPct: s.bb.atk }, flags: { stealth: true } };
  else kit.skill = { kind: 'duration', duration: evidence.models[ID].Front.durations.Skill / rate(u) + .5,
    canActivate: () => !u.mem.firewatchCast,
    onStart: () => {
      const playback = rate(u), delay = evidence.models[ID].Front.durations.Skill / playback;
      const state = { seq: u.deploySeq, control: u.attackControlEpoch, activation: u.skill.activations, released: false };
      u.mem.firewatchCast = state;
      u.skill.timeLeft = delay + .5;
      // Front Skill contains no OnAttack and Back has no Skill at all. Use
      // known Front clip completion as the bounded clock; retain real Back Idle.
      u.mem.regularFormVisual = { clip: model(u).durations.Skill ? 'Skill' : 'Idle', loop: false, speed: playback };
      b.after(delay, () => {
        if (u.mem.firewatchCast !== state || !live(u) || !u.canAct || u.s.flags.disarm
          || u.deploySeq !== state.seq || u.attackControlEpoch !== state.control || !u.skill.active) return;
        bombs(b, u, s.bb, state);
      }, { owner: u });
    }, onEnd: () => clearCast(b, u, u.mem.firewatchCast) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installFirewatch({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('tick', () => {
    const state = u.mem.firewatchCast;
    if (state && (!live(u) || !u.canAct || u.s.flags.disarm || u.attackControlEpoch !== state.control))
      u.skill.end('interrupted');
  }, { owner: u });
}
