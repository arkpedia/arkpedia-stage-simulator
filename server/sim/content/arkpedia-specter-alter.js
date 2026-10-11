// SPDX-License-Identifier: GPL-3.0-or-later
// Literal mode graphs, per-recipient aura timing and local dispatch limits:
// data/arkpedia-specter-alter-prefabs.json. No module effects are enabled.
import evidence from '../../../data/arkpedia-specter-alter-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { resolveHit } from '../ai.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';
const ID = 'char_1023_ghost2';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const skill = (u, n) => u.skill.active && u.skill.id === `skchr_ghost2_${n}`;
const key = (u, role) => `ghost2:${role}:${u.id}`;
const auraRange = evidence.tables.ranges['x-4'].grids.map(p => [p.row, p.col]);
const attackClip = u => skill(u, 3)
  ? u.dir === 'DOWN' ? 'Skill_3_Attack_Down' : 'Skill_3_Attack'
  : u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
function idle(u) {
  u.mem.regularFormVisual = { clip: u.trait.doll ? 'Idle_B' : skill(u, 3) ? 'Skill_3_Idle' : 'Idle',
    loop: true, die: u.trait.doll ? 'Die_B' : 'Die' };
}
/** Source deck selector includes its owner, bench and support Abyssal Hunters.
 * Keep its contribution in the additive HP bucket, outside removable form buffs. */
export function prepareSpecterAlterSquad(records) {
  const pct = Math.max(0, ...Object.values(records).filter(r => r.charId === ID)
    .flatMap(r => r.talents.filter(t => t.bb.max_hp != null).map(t => t.bb.max_hp)));
  for (const r of Object.values(records)) {
    const old = r.arkpedia.specterAlterSquadHpPct ?? 0;
    const next = r.tags.includes('abyssal') ? pct : 0;
    if (old === next) continue;
    r.arkpedia.modifiers.hpPct = (r.arkpedia.modifiers.hpPct ?? 0) + next - old;
    r.arkpedia.specterAlterSquadHpPct = next;
  }
}
function syncAura(b, u) {
  u.mem.ghost2Recipients ??= new Map();
  const active = live(u) && u.trait.doll && !u.trait.dollSwitching;
  const keys = absoluteRangeKeys(auraRange, u.tileR, u.tileC, 'RIGHT');
  const talent = u.def.talents.find(t => t.bb.move_speed != null).bb;
  for (const e of u.mem.ghost2Recipients.keys()) if (!b.enemies.includes(e)) {
    b.removeBuff(e, key(u, 'aura')); u.mem.ghost2Recipients.delete(e);
  }
  for (const e of b.enemies) {
    const inside = active && canTargetEnemy(u, e, { groundOnly: true }) && bodyInKeys(e, keys);
    const old = u.mem.ghost2Recipients.get(e);
    if (!inside) {
      b.removeBuff(e, key(u, 'aura')); u.mem.ghost2Recipients.delete(e); continue;
    }
    if (!old || !e.findBuff(key(u, 'aura'))) {
      b.addBuff(e, { key: key(u, 'aura'), source: u, mods: { moveMul: 1 + talent.move_speed } });
      u.mem.ghost2Recipients.set(e, { next: b.time + .8999999761581421 });
      continue;
    }
    if (b.time + 1e-9 < old.next) continue;
    old.next += 1;
    // BUFF damage, NONE application, ignoreForSp. Snapshot only at the pulse;
    // normal stats, RES, Arts dodge and damage modifiers still apply.
    b.dealDamage(u, e, { amount: u.s.atk * talent.atk_scale, type: 'arts',
      isAttack: false, isSkill: false, noSp: true, applyWay: 'none',
      tags: ['ghost2:substitute-aura'] });
  }
}
function switchForm(b, u, doll) {
  const state = { seq: u.deploySeq }; u.mem.ghost2Switch = state;
  u.trait.dollSwitching = true; u.mem.ghost2ReturnAt = null;
  u.mem.ghost2ModeEpoch = (u.mem.ghost2ModeEpoch ?? 0) + 1;
  if (u.skill.active) u.skill.end('substitute');
  for (const buff of u.buffs.slice()) if (!buff.persist) b.removeBuff(u, buff);
  u.skill.setSpTotal(0); syncAura(b, u);
  b.addBuff(u, { key: key(u, 'transition'), flags: { invulnerable: true,
    undeadable: true, noSp: true, noHeal: true, healFree: true, isolated: true, disarm: true } });
  if (doll) b.addBuff(u, { key: key(u, 'zero-block'), mods: { blockCntMul: 0 } });
  else {
    u.trait.doll = false; u.form = null; u.rangeGrid = u.def.rangeGrid;
    b.removeBuff(u, key(u, 'zero-block')); b.refreshRange(u);
  }
  b.releaseBlocked(u); u.hp = u.s.maxHp;
  const valid = () => live(u) && u.deploySeq === state.seq && u.mem.ghost2Switch === state;
  const out = doll ? 'Die' : 'Die_B', born = doll ? 'Start_B' : 'Start_2';
  // Both outgoing and born abilities explicitly force Front. Back has no
  // Start_B or death clip. Never fabricate a Back substitute transition.
  u.mem.regularFormVisual = { clip: out, loop: false, speed: 1, forceFront: true };
  b.after(evidence.models[ID].Front.durations[out], () => {
    if (!valid()) return;
    // Second source clear at the bounded local born boundary. Retain the
    // transition and zero-block guards; durable deck/build effects survive.
    for (const buff of u.buffs.slice()) if (!buff.persist
      && ![key(u, 'transition'), key(u, 'zero-block')].includes(buff.key)) b.removeBuff(u, buff);
    if (doll) {
      u.trait.doll = true; u.form = 'doll'; u.rangeGrid = auraRange;
      b.addBuff(u, { key: key(u, 'zero-block'), mods: { blockCntMul: 0 } });
      b.addBuff(u, { key: key(u, 'substitute-sp'), flags: { noSp: true } });
      b.refreshRange(u); u.mem.ghost2ReturnAt = b.time + u.def.traitBb.duration;
      // Bounded local mode entry before Start_B finishes; compiled native
      // SequenceAbility dispatch phase is not present in the recovered assets.
      b.after(u.def.traitBb.duration, () => {
        if (valid() && u.trait.doll) switchForm(b, u, false);
      }, { owner: u });
    }
    u.mem.regularFormVisual = { clip: born, loop: false, speed: 1, forceFront: true };
    b.after(evidence.models[ID].Front.durations[born], () => {
      if (!valid()) return;
      b.removeBuff(u, key(u, 'transition')); u.trait.dollSwitching = false;
      idle(u); u.atkCd = 0; syncAura(b, u);
    }, { owner: u });
  }, { owner: u });
}
function exchangeHp(b, u) {
  const keys = absoluteRangeKeys(auraRange, u.tileR, u.tileC, 'RIGHT');
  const ally = b.allyUnits.filter(a => a !== u && a.kind === 'op' && live(a)
    && !a.s.flags.healFree && b.allySelectable(a, u) && bodyInKeys(a, keys))
    .sort((a, z) => a.hpRatio - z.hpRatio)[0];
  if (!ally) return;
  const ownRatio = u.hpRatio, allyRatio = ally.hpRatio;
  // ExchangeHpRatio skipEvent/undeadable: direct writes, minimum1, no healing,
  // damage, shield consumption, defensive SP or fatal callbacks.
  u.hp = Math.max(1, u.s.maxHp * allyRatio);
  ally.hp = Math.max(1, ally.s.maxHp * ownRatio);
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p) || u.trait.dollSwitching || u.trait.doll) return;
  const clean = { ...p, launchAttack: null };
  if (skill(u, 3)) {
    // Native per-target active buff is attached before ordinary damage. Keep
    // that bounded local ordering explicit in the evidence; never use an
    // after-damage HP comparison or one self cost for the whole attack.
    if (e.hpRatio >= u.hpRatio) resolveHit(b, u,
      { ...clean, atkScale: u.skill.bb['attack@atk_scale_ex'], tags: ['ghost2:s3-extra'] }, e,
      info, e.x, e.y);
    else applyHpLoss(b, u, u, u.s.maxHp * u.skill.bb['attack@hp_ratio'],
      makeDamageInfo({ type: 'true', isAttack: true, noSp: true, canDodge: false,
        applyWay: 'none', tags: ['ghost2:s3-cost'] }));
  }
  if (live(u) && !u.trait.dollSwitching && canTargetEnemy(u, e, clean))
    resolveHit(b, u, clean, e, info, e.x, e.y);
}
export function customizeSpecterAlterKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys',
    applyWay: 'melee', groundOnly: true, canHitFly: false, hits: 1,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    splashRadius: 0, chain: null, dmgMul: null, interruptOnSkillChange: true,
    windup: () => model(u).hits[attackClip(u)][0] / (u.s.aspd / 100),
    attackVisual: () => attackClip(u), launchAttack: launch,
    attackEpoch: () => u.mem.ghost2ModeEpoch ?? 0,
    canAttack: () => !u.trait.doll && !u.trait.dollSwitching };
  const s = def.skill, bb = s.bb, n = Number(s.id.at(-1));
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    canActivate: () => !u.trait.doll && !u.trait.dollSwitching,
    mods: n === 1 ? { atkPct: bb.atk } : n === 2
      ? { atkPct: bb.atk, aspd: bb.attack_speed }
      : { atkPct: bb.atk, hpPct: bb.max_hp, batFlat: bb.base_attack_time },
    flags: n === 2 ? { undeadable: true } : {},
    attack: n === 3 ? { maxTargetsByBlock: true } : {},
    onStart: () => {
      u.mem.ghost2ModeEpoch = (u.mem.ghost2ModeEpoch ?? 0) + 1; u.atkCd = 0;
      if (n === 2) { idle(u); return; }
      const seq = u.deploySeq, activation = u.skill.activations;
      const clip = n === 1 ? 'Skill_1' : 'Skill_3_Begin', duration = model(u).durations[clip];
      if (n === 1) exchangeHp(b, u);
      u.mem.regularFormVisual = { clip, loop: false, speed: 1 };
      b.addBuff(u, { key: key(u, 'skill-begin'), duration, flags: { disarm: true } });
      b.after(duration, () => {
        if (live(u) && !u.trait.dollSwitching && u.deploySeq === seq && u.skill.activations === activation && u.skill.active)
          idle(u);
      }, { owner: u });
    },
    onEnd: ({ reason }) => {
      u.mem.ghost2ModeEpoch = (u.mem.ghost2ModeEpoch ?? 0) + 1; u.atkCd = 0;
      b.removeBuff(u, key(u, 'skill-begin'));
      if (u.trait.dollSwitching || !live(u) || reason === 'death') return;
      if (n === 2) { switchForm(b, u, true); return; }
      if (n !== 3) { idle(u); return; }
      // The literal chararts mix map supplies the end clip when S3 returns to Idle.
      const seq = u.deploySeq, activation = u.skill.activations;
      u.mem.regularFormVisual = { clip: 'Skill_3_End', loop: false, speed: 1 };
      b.addBuff(u, { key: key(u, 'skill-end'), duration: model(u).durations.Skill_3_End,
        flags: { disarm: true } });
      b.after(model(u).durations.Skill_3_End, () => {
        if (live(u) && !u.trait.dollSwitching && u.deploySeq === seq && u.skill.activations === activation && !u.skill.active)
          idle(u);
      }, { owner: u });
    },
    formCountdown: () => live(u) && u.mem.ghost2ReturnAt != null
      ? { remaining: Math.max(0, u.mem.ghost2ReturnAt - b.time), duration: def.traitBb.duration,
        label: 'Substitute remaining' } : null };
}
export function installSpecterAlter({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.ghost2Switch = null; u.mem.ghost2ReturnAt = null; u.mem.ghost2ModeEpoch = 0;
    u.trait.doll = false; u.trait.dollSwitching = false; idle(u);
  }, { owner: u });
  b.on('fatal', ctx => {
    if (ctx.unit !== u || ctx.prevented) return;
    if (!u.trait.dollSwitching) switchForm(b, u, !u.trait.doll);
    ctx.prevented = true;
  }, { owner: u, priority: -100 });
  b.on('beforeStatus', ctx => {
    if (ctx.target === u && u.trait.dollSwitching && ['stun', 'freeze', 'sleep'].includes(ctx.status)) ctx.cancel = true;
  }, { owner: u });
  b.on('tick', () => syncAura(b, u), { owner: u });
  for (const event of ['retreat', 'death']) b.on(event, ({ unit }) => {
    if (unit !== u) return;
    u.mem.ghost2Switch = null; u.mem.ghost2ReturnAt = null; u.mem.regularFormVisual = null;
    u.trait.doll = false; u.trait.dollSwitching = false; u.form = null; syncAura(b, u);
  }, { owner: u });
}
