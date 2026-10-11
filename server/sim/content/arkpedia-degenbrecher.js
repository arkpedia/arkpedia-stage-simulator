// SPDX-License-Identifier: GPL-3.0-or-later
// Exact graph and animation bindings: data/arkpedia-degenbrecher-prefabs.json.
import evidence from '../../../data/arkpedia-degenbrecher-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
const ID = 'char_4116_blkkgt';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
  hits: 1, hitsFn: null, maxTargets: 1, splashRadius: 0, chain: null, dmgMul: null, applyWay: 'melee' };
function candidates(b, u, grid, fly = false, cap = Infinity) {
  const keys = absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir);
  const out = b.enemiesInKeys(keys, u, { ...plain, canHitFly: fly });
  sortEnemyTargets(b, u, out, null); return out.slice(0, cap);
}
function clear(b, u, state) {
  if (!state || u.mem.degenCast !== state) return;
  state.watch?.cancel(); u.mem.degenCast = null; u.mem.regularFormVisual = null;
  b.removeBuff(u, 'degen:cast'); b.removeBuff(u, 'degen:invincible');
}
function valid(u, state) {
  return live(u) && u.mem.degenCast === state && u.deploySeq === state.seq
    && u.attackControlEpoch === state.epoch && u.canAct;
}
function begin(b, u, n, clip, duration, speed = 1) {
  const state = { n, seq: u.deploySeq, epoch: u.attackControlEpoch, activation: u.skill.activations };
  u.mem.degenCast = state; u.mem.regularFormVisual = { clip, loop: false, speed };
  state.watch = b.every(b.dt, () => {
    if (!valid(u, state)) {
      if (u.skill.active && u.skill.activations === state.activation) u.skill.end('interrupt');
      clear(b, u, state);
    }
  }, { owner: u });
  b.after(duration, () => {
    if (u.mem.degenCast !== state) return;
    if (u.skill.active && u.skill.activations === state.activation) u.skill.end('cast');
    clear(b, u, state);
  }, { owner: u });
  return state;
}
function strike(b, u, e, scale, info, fly = false) {
  const p = { ...plain, atkScale: scale, canHitFly: fly };
  if (!canTargetEnemy(u, e, p)) return;
  resolveHit(b, u, p, e, info, e.x, e.y);
}
function windup(b, u) {
  const skill = u.skill.id === 'skchr_blkkgt_1' && u.skill.pending;
  const clip = skill ? 'Skill_1' : 'Attack', rate = u.s.aspd / 100;
  u.mem.degenAttack = { clip, rate };
  if (skill) {
    begin(b, u, 1, clip, model(u).durations[clip] / rate, rate);
    b.addBuff(u, { key: 'degen:cast', flags: { noSp: true } });
  }
  return model(u).hits[clip][0] / rate;
}
function launch(b, u, p, e, info) {
  const { clip, rate } = u.mem.degenAttack, state = u.mem.degenCast;
  const scale = info.isSkill ? u.def.skill.bb.atk_scale_s1 : 1;
  strike(b, u, e, scale, info);
  const seq = u.deploySeq, targetSeq = e.deploySeq, epoch = u.attackControlEpoch,
    activation = u.skill.activations, times = model(u).hits[clip];
  b.after((times[1] - times[0]) / rate, () => {
    if (!live(u) || u.deploySeq !== seq || u.attackControlEpoch !== epoch
      || !u.canAct || u.s.flags.disarm || u.skill.activations !== activation || e.deploySeq !== targetSeq) return;
    if (info.isSkill && !valid(u, state)) return;
    strike(b, u, e, scale, info);
  }, { owner: u });
}
function manual(b, u, n) {
  const bb = u.def.skill.bb, m = model(u), rate = u.s.aspd / 100;
  const opener = m.durations.Skill_3_Begin, loop = 10 * bb.d_hit_interval;
  const duration = n === 2 ? m.durations.Skill_2 / rate : opener + loop + m.durations.Skill_3_End;
  const clip = n === 2 ? u.dir === 'DOWN' ? 'Skill_Down_2' : 'Skill_2' : 'Skill_3_Begin';
  const state = begin(b, u, n, clip, duration, n === 2 ? rate : 1);
  b.addBuff(u, { key: 'degen:cast', flags: { disarm: true, noSp: true } });
  state.epoch = u.attackControlEpoch; u.skill.timeLeft = duration;
  const info = { isSkill: true, attackId: ++b._attackSeq };
  const targets = () => candidates(b, u, u.def.skill.rangeGrid, n === 3, bb.max_target);
  if (n === 2) {
    // One animation event attaches a 0.01 s derived damage buff. Its two/three
    // triggers are NOT the eight/eleven Spine events used for presentation.
    b.after(m.hits.Skill_2[0] / rate, () => {
      if (!valid(u, state)) return;
      for (const e of targets()) {
        const count = bb[e.blockedBy ? 'blkkgt_s_2[blocked].trig_cnt' : 'blkkgt_s_2[not_blocked].trig_cnt'];
        const targetSeq = e.deploySeq;
        for (let i = 0; i < count; i++) {
          const hit = () => {
            // The derived buff has no parent-finish dependency. After attachment
            // it survives a caster interruption; target death/recycle cancels it.
            if (e.alive && e.deployed && e.deploySeq === targetSeq)
              b.dealDamage(u, e, { amount: u.s.atk * bb.dot_scale, type: 'phys',
                isAttack: true, isSkill: true, attackId: info.attackId, applyWay: 'melee', ignoreSelect: true });
          };
          if (!i) hit(); else b.after(i * .01, hit, { owner: e });
        }
      }
    }, { owner: u });
    return;
  }
  b.after(opener, () => {
    if (!valid(u, state)) return;
    u.mem.regularFormVisual = { clip: 'Skill_3_Loop', loop: false };
    b.addBuff(u, { key: 'degen:invincible', flags: { invulnerable: true } });
  }, { owner: u });
  // Native Damage/Pull abilities disable Spine-event waits. Fixed-time dispatch
  // follows the rank blackboards; the unrecovered Unity C# handoff is documented.
  for (let i = 0; i < 10; i++) b.after(opener + i * bb.d_hit_interval, () => {
    if (!valid(u, state)) return;
    for (const e of targets()) strike(b, u, e, bb.d_atk_scale, info, true);
  }, { owner: u });
  const pull = force => {
    for (const e of targets()) b.pull(e, force, { to: u, center: u, stop: Math.sqrt(.45) });
  };
  for (let i = 0; i < 3; i++) b.after(opener + i * bb.p_hit_interval, () => {
    if (valid(u, state)) pull(bb.p_force);
  }, { owner: u });
  b.after(opener + loop, () => {
    if (!valid(u, state)) return;
    b.removeBuff(u, 'degen:invincible');
    u.mem.regularFormVisual = { clip: 'Skill_3_End', loop: false };
  }, { owner: u });
  b.after(opener + loop + m.hits.Skill_3_End[0], () => {
    if (!valid(u, state)) return;
    for (const e of targets()) strike(b, u, e, bb.e_atk_scale_end, info, true);
    pull(bb.e_force);
  }, { owner: u });
}
export function customizeDegenbrecherKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, install: null, allInRange: false, hitAllBlocked: false,
    maxTargetsByBlock: false, retargetOnRelease: false, interruptOnSkillChange: true,
    canAttack: () => !u.mem.degenCast, windup: () => windup(b, u),
    attackVisual: () => u.mem.degenAttack.clip, launchAttack: launch,
    acquireTargets: () => {
      if (u.skill.id === 'skchr_blkkgt_1' && u.skill.charges > 0)
        return candidates(b, u, def.skill.rangeGrid, false, u.skill.pending ? def.skill.bb.max_target : 1);
      return null;
    } };
  const s = def.skill, n = Number(s.id.at(-1));
  kit.skill = n === 1 ? { kind: 'instant', trigger: 'DEFAULT', canActivate: () => !u.mem.degenCast,
    targeting: { rangeGrid: s.rangeGrid, maxTargets: s.bb.max_target },
    attack: { retargetOnRelease: true } }
    : { kind: 'toggle', charges: n === 2 ? 2 : 1, attack: { noAttack: true },
      canActivate: () => !u.mem.degenCast && candidates(b, u, s.rangeGrid, n === 3).length > 0,
      onStart: () => manual(b, u, n),
      onTick: ({ dt, skill }) => { skill.timeLeft = Math.max(0, skill.timeLeft - dt); },
      onEnd: () => clear(b, u, u.mem.degenCast) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installDegenbrecher({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  if (def.skill.id === 'skchr_blkkgt_1') {
    const baseRange = u.rangeGrid;
    b.on('tick', () => {
      const range = live(u) && (u.skill.charges > 0 || u.mem.degenCast?.n === 1)
        ? def.skill.rangeGrid : baseRange;
      if (u.rangeGrid === range) return;
      u.rangeGrid = range; b.refreshRange(u);
    }, { owner: u });
  }
  const t1 = def.talents.find(t => t.bb.prob != null)?.bb,
    t2 = def.talents.find(t => t.bb.def_penetrate != null)?.bb;
  b.on('hit', ({ source, target, dmg }) => {
    if (source !== u || !t1) return;
    const guaranteed = u.mem.degenCast?.n >= 2 ? def.skill.bb.prob : t1.prob;
    if (b.rng() < guaranteed) {
      dmg.amount *= t1.atk_scale;
      b.applyStatus(target, 'tremble', { source: u, duration: t1.not_combat });
    }
    // LOW_PRIORITY native T2 runs after T1, so the first critical hit gets DEF
    // penetration. Like the original derived buff, it persists through a dodge.
    if (t2 && target.s.flags.tremble) u.mem.degenPenetration = true;
    if (u.mem.degenPenetration) dmg.defIgnorePct += t2.def_penetrate;
  }, { owner: u });
  b.on('damaged', ({ source }) => { if (source === u) u.mem.degenPenetration = false; }, { owner: u });
  b.on('beforeStatus', c => {
    if (c.target === u && u.findBuff('degen:invincible') && ['stun', 'freeze'].includes(c.status)) c.cancel = true;
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) { clear(b, u, u.mem.degenCast); u.mem.degenPenetration = false; }
  }, { owner: u });
}
