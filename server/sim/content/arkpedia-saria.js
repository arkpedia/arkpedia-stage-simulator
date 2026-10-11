// SPDX-License-Identifier: GPL-3.0-or-later
// Exact original selectors, templates, clocks and remaining dispatcher limits
// are retained in data/arkpedia-saria-prefabs.json.
import evidence from '../../../data/arkpedia-saria-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const ID = 'char_202_demkni';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.s.aspd / 100);
const grid = id => evidence.ranges[id].grids.map(p => [p.row, p.col]);
const keys = (u, range) => new Set(absoluteRangeKeys(grid(range), u.tileR, u.tileC, u.dir));
const healable = (b, u, a) => live(a) && a.kind !== 'device' && b.allySelectable(a, u)
  && !a.s.flags.untargetable && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
const allies = (b, u, range, injured = false) => b.allyUnits.filter(a => healable(b, u, a)
  && bodyInKeys(a, keys(u, range)) && (!injured || a.hp < a.s.maxHp - .01))
  .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq);
const firstAidTargets = (b, u) => allies(b, u, 'x-4', true).filter(a => a.hpRatio <= .5 + 1e-9);

function healing(b, u, a, scale) {
  if (!healable(b, u, a)) return;
  const amount = u.s.atk * scale;
  // Observe the actual HEAL modifier after every registered modifier hook has
  // run. HP restored alone cannot distinguish a legal overheal from a canceled
  // output (for example Estelle's active heal restriction).
  let output = null;
  const observer = b.on('heal', ctx => {
    if (ctx.source === u && ctx.target === a) output = ctx;
  });
  try { b.heal(u, a, amount); } finally { b.off(observer); }
  const accepted = output?.amount > 0;
  // Original demkni_t_2 filters IsHeal, not positive HP removed/restored. A
  // legal overheal is output too; noSp and an active timed skill still hold SP.
  const sp = u.def.talents[1]?.bb.sp;
  if (accepted && sp && live(a)) a.skill?.gainSp(sp, 'demkni_t_2');
}

function clearCast(b, u, token) {
  if (u.mem.sariaCast !== token) return;
  u.mem.sariaCast = null; b.removeBuff(u, 'saria:cast'); u.mem.regularFormVisual = null;
}

function healCast(b, u, s, first) {
  const input = first ? firstAidTargets(b, u)[0] : null, inputSeq = input?.deploySeq;
  if (first && !input) return;
  const clip = first ? 'Attack' : 'Attack_2', speed = rate(u, first ? 1 : Infinity);
  const release = model(u).hits[clip][0] / speed, total = model(u).durations[clip] / speed;
  const seq = u.deploySeq, activation = u.skill.activations, token = {};
  u.mem.sariaCast = token;
  u.mem.regularFormVisual = { clip, loop: false, speed };
  b.addBuff(u, { key: 'saria:cast', duration: total, flags: { disarm: true, noSp: true } });
  const control = u.attackControlEpoch; // the source cast's own lock comes first
  let interrupted = false;
  const valid = () => !interrupted && live(u) && u.mem.sariaCast === token && u.canAct
    && u.deploySeq === seq && u.skill.activations === activation && u.attackControlEpoch === control;
  const watch = b.every(b.dt, () => {
    if (!valid()) { interrupted = true; clearCast(b, u, token); watch.cancel(); }
  }, { owner: u });
  b.after(release, () => {
    if (!valid()) { clearCast(b, u, token); return; }
    // S1's selector source2 preserves its trigger INPUT; its explicit refund
    // applies to a dead input before the heal, never a hidden or controlled one.
    if (first) {
      if (!input.alive) { u.skill.addCharge(1); return; }
      if (input.deploySeq === inputSeq && healable(b, u, input)) healing(b, u, input, s.bb.heal_scale);
    } else {
      // Native S2 CAST selector is uncapped. It includes full-HP legal allies
      // once an injured ally starts the automatic cast.
      for (const a of allies(b, u, 'x-2')) healing(b, u, a, s.bb.heal_scale);
    }
  }, { owner: u });
  b.after(total, () => { watch.cancel(); clearCast(b, u, token); }, { owner: u });
}

function syncCalcification(b) {
  for (const e of b.enemies) {
    // This native aura has purpose0 rather than ATTACK; stealth/Sleep are not
    // damage-selection filters. Disappearance and target-free still detach it.
    const sources = [...(b._arkpediaSaria ?? new Map()).values()].filter(u => live(u)
      && u.skill.active && u.skill.id === 'skchr_demkni_3' && live(e)
      && !e.s.flags.untargetable && bodyInKeys(e, keys(u, 'x-3')));
    const strongest = sources.sort((a, z) => z.skill.bb['demkni_s_3.damage_scale']
      - a.skill.bb['demkni_s_3.damage_scale'])[0];
    const slow = sources.length ? Math.min(...sources.map(u => 1 + u.skill.bb['demkni_s_3.move_speed'])) : 1;
    const old = e.findBuff('demkni_s_3');
    if (!strongest) b.removeBuff(e, 'demkni_s_3');
    else {
      const arts = strongest.skill.bb['demkni_s_3.damage_scale'];
      if (old?.source !== strongest || old.mods.artsTakenMul !== arts || old.mods.moveMul !== slow)
        b.addBuff(e, { key: 'demkni_s_3', source: strongest,
          mods: { artsTakenMul: arts, moveMul: slow } });
    }
  }
}

function calcificationPulse(b, u) {
  if (!live(u) || !u.skill.active || u.skill.id !== 'skchr_demkni_3'
    || !u.canAct || u.s.flags.disarm || !allies(b, u, 'x-3').length) return;
  const seq = u.deploySeq, activation = u.skill.activations, control = u.attackControlEpoch;
  // Native mode Heal is eventless but explicitly retains .533 predelay and a
  // fixed1s cooldown/timeMode2. This bounded clock does not scale with ASPD/BAT.
  b.after(evidence.runtimeTiming.calcificationPredelay, () => {
    if (!live(u) || !u.skill.active || u.deploySeq !== seq || u.skill.activations !== activation
      || !u.canAct || u.s.flags.disarm || u.attackControlEpoch !== control) return;
    for (const a of allies(b, u, 'x-3')) healing(b, u, a, u.skill.bb['attack@heal_scale']);
  }, { owner: u });
}

export function customizeSariaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, hitAllBlocked: false, hits: 1, splashRadius: 0, chain: null,
    install: null, heal: null, attackVisual: 'Attack', retargetOnRelease: true,
    windup: (_b, unit) => model(unit).hits.Attack[0] / rate(unit), interruptOnSkillChange: true };
  const s = def.skill, first = s.id.endsWith('_1'), second = s.id.endsWith('_2');
  if (first || second) kit.skill = { kind: 'charges', charges: s.bb.ct ?? 1, trigger: 'SP_FULL',
    canActivate: () => !u.mem.sariaCast && u.canAct && !u.s.flags.disarm
      && (first ? firstAidTargets(b, u).length > 0 : allies(b, u, 'x-2', true).length > 0),
    onStart: () => healCast(b, u, s, first) };
  else kit.skill = { kind: 'duration', duration: s.duration,
    onStart: () => {
      u.profile.noAttack = true; u.mem.sariaHealNext = b.time + 1;
      u.mem.regularFormVisual = { clip: 'Skill_Begin', loop: false, forceFront: true };
      const seq = u.deploySeq, activation = u.skill.activations;
      b.after(evidence.models[ID].Front.durations.Skill_Begin, () => {
        if (live(u) && u.skill.active && u.deploySeq === seq && u.skill.activations === activation)
          u.mem.regularFormVisual = { clip: 'Skill_Loop', loop: true, forceFront: true };
      }, { owner: u });
      syncCalcification(b); calcificationPulse(b, u);
    }, onTick: () => {
      syncCalcification(b);
      if (b.time >= u.mem.sariaHealNext - 1e-9) {
        u.mem.sariaHealNext = b.time + 1; calcificationPulse(b, u);
      }
    }, onEnd: ({ reason }) => {
      u.profile.noAttack = false; syncCalcification(b);
      if (!live(u) || reason === 'death') { u.mem.regularFormVisual = null; return; }
      u.mem.regularFormVisual = { clip: 'Skill_End', loop: false, forceFront: true };
      const seq = u.deploySeq, activation = u.skill.activations;
      b.after(evidence.models[ID].Front.durations.Skill_End, () => {
        if (u.deploySeq === seq && u.skill.activations === activation) u.mem.regularFormVisual = null;
      }, { owner: u });
    } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installSaria({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  (b._arkpediaSaria ??= new Map()).set(u.id, u);
  const t = def.talents[0]?.bb;
  if (t) b.addBuff(u, { key: 'demkni_t_1', persist: true, allowDead: true, interval: t.interval, onTick: () => {
    if (!live(u)) return;
    b.addBuff(u, { key: 'demkni_t_1[stack]', refresh: 'stack', maxStacks: t.max_stack_cnt,
      mods: { atkPct: t.atk, defPct: t.def } });
  } });
  b.on('tick', () => { if (u.skill?.active && u.skill.id === 'skchr_demkni_3') syncCalcification(b); }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) { u.mem.sariaCast = null; b.removeBuff(u, 'saria:cast'); u.mem.regularFormVisual = null; }
    syncCalcification(b);
  }, { owner: u });
}
