// SPDX-License-Identifier: GPL-3.0-or-later
import { LUCILLA_OPERATORS } from '../../../shared/arkpedia/lucilla-operators.js';
import evidence from '../../../data/arkpedia-lucilla-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { bodyInKeys } from '../body.js';
import { canTargetEnemy } from '../targeting.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const clip = u => !u.skill.active ? 'Attack' : u.skill.id === 'skchr_haini_1' ? 'Skill_1' : 'Skill_2_Loop';
function syncLucilla(b, u) {
  const t = u.def.talents.find(t => t.bb.damage_scale != null)?.bb;
  const active = live(u) && u.skill.active && u.skill.id === 'skchr_haini_2', bb = u.def.skill.bb;
  const multiplier = active ? Math.min(bb['attack@max_talent_up'], 1 + u.mem.lucillaKills * bb['attack@talent_up']) : 1;
  const fragile = t ? (t.damage_scale - 1) * multiplier : 0;
  const fk = `lucilla:fragile:${u.id}`, sk = `lucilla:move:${u.id}`, dk = `lucilla:death:${u.id}`;
  for (const e of b.enemies) {
    // Original enemyLevelMask1 / motion3 / purposeNONE permits sleeping and
    // concealed NORMAL enemies. It does not ignore the target-free state.
    const inside = live(u) && live(e) && e.def.rank === 'NORMAL'
      && !e.s.flags.untargetable && bodyInKeys(e, u.rangeKeys);
    if (inside && fragile > 0) {
      if (e.findBuff(fk)?.data.value !== fragile) {
        // Native BB update finishes its derived weak buff before rebuilding.
        // Replace this owned instance so a previous stronger ramp can decrease.
        b.removeBuff(e, fk);
        b.applyStatus(e, 'fragile', { key: fk, source: u, value: fragile });
      }
    } else b.removeBuff(e, fk);
    if (inside && active) {
      const old = e.findBuff(sk);
      if (!old || old.mods.movePct !== bb['attack@move_speed'])
        b.addBuff(e, { key: sk, source: u, mods: { movePct: bb['attack@move_speed'] } });
      if (!e.findBuff(dk)) b.addBuff(e, { key: dk, source: u });
    } else { b.removeBuff(e, sk); b.removeBuff(e, dk); }
  }
}
function startForm(b, u) {
  const seq = u.deploySeq, activation = u.skill.activations, duration = model(u).durations.Skill_2_Begin;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.addBuff(u, { key: 'lucilla:begin', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
}
function endForm(b, u, reason) {
  b.removeBuff(u, 'lucilla:begin');
  if (!live(u) || ['death', 'retreat'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, duration = model(u).durations.Skill_2_End;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.addBuff(u, { key: 'lucilla:end', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => { if (u.deploySeq === seq && !u.skill.active) u.mem.regularFormVisual = null; }, { owner: u });
}
function lucillaLaunch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  if (info.isSkill && u.skill.id === 'skchr_haini_1') u.mem.lucillaEmitted = info.attackId;
  // All three original projectiles have speed10, lifetime10, no source-invalid
  // stop and non-cached attack. A born flight survives source withdrawal.
  b.addProjectile({ from: u, target, source: u, speed: 10, maxAge: 10, visual: 'orb',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
      if (e && canTargetEnemy(u, e, p)) resolveHit(b, u, p, e, info, e.x, e.y);
    } });
}
export function customizeLucillaKit({ battle: b, id, def, unit: u, kit }) {
  if (!LUCILLA_OPERATORS[id]) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', canHitFly: true,
    hits: 1, hitsFn: null, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, splashRadius: 0, chain: null, dmgMul: null, install: null,
    retargetOnRelease: true, interruptOnSkillChange: true, launchAttack: lucillaLaunch,
    attackVisual: (_battle, unit) => clip(unit),
    windup: (_battle, unit) => model(unit).hits[clip(unit)][0] / Math.min(1, unit.s.aspd / 100) };
  const s = def.skill, bb = s.bb;
  if (s.id === 'skchr_haini_1') kit.skill = { kind: 'instant',
    targeting: { maxTargets: bb.max_target }, attack: { atkScale: bb.atk_scale,
      afterAttack: (_battle, unit, targets, meta) => {
        if (unit.mem.lucillaEmitted !== meta.attackId && !targets.some(e => e.alive)
          && meta.inputTargets.length && meta.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
      } } };
  else kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk },
    targeting: { maxTargets: bb['attack@max_target'] }, attack: {},
    onStart: () => { u.mem.lucillaKills = 0; startForm(b, u); syncLucilla(b, u); },
    onEnd: ({ reason }) => { u.mem.lucillaKills = 0; syncLucilla(b, u); endForm(b, u, reason); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installLucilla({ battle: b, unit: u, def }) {
  if (!LUCILLA_OPERATORS[def.charId]) return;
  u.mem.lucillaKills = 0;
  b.on('kill', ({ victim }) => {
    if (!live(u) || !u.skill.active || u.skill.id !== 'skchr_haini_2'
      || !victim.findBuff(`lucilla:death:${u.id}`)) return;
    u.mem.lucillaKills++;
    syncLucilla(b, u);
  }, { owner: u });
  for (const event of ['tick', 'deploy', 'death']) b.on(event, () => syncLucilla(b, u), { owner: u });
  syncLucilla(b, u);
}
