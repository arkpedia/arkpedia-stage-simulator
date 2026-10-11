// SPDX-License-Identifier: GPL-3.0-or-later
// Exact native graphs and explicitly bounded modifier/casting clocks are retained
// in data/arkpedia-philae-prefabs.json. No executable native dispatcher is claimed.
import evidence from '../../../data/arkpedia-philae-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { elementIntake } from '../damage.js';
const ID = 'char_4148_philae', SHIELD = 'philae_s_1', ATK = 'philae_s_2[atk]', CD = 'philae_s_2[cd]';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const first = u => u.skill.id === 'skchr_philae_1';
function clearAnimation(b, u, state) {
  if (u.mem.philaeAnimation !== state) return;
  u.mem.philaeAnimation = null; u.mem.regularFormVisual = null;
  b.removeBuff(u, 'philae:animation');
}
function shieldStart(b, u, s) {
  // ApplyBuff/ON_BUFF_START attachment is deliberately separated from the
  // source SkillAnimation .433 event: no invented damage/heal is fired there.
  b.reduceElement(u, Infinity);
  u.mem.philaeBarrier = { value: s.bb.shield_value };
  const seq = u.deploySeq, activation = u.skill.activations, state = {};
  u.mem.philaeAnimation = state; u.mem.regularFormVisual = { clip: 'Skill_1', loop: false };
  b.addBuff(u, { key: 'philae:animation', duration: model(u).durations.Skill_1,
    flags: { disarm: true, noSp: true } });
  const epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.mem.philaeAnimation === state && u.deploySeq === seq
    && u.skill.active && u.skill.activations === activation && u.canAct && u.attackControlEpoch === epoch;
  const watch = b.every(b.dt, () => {
    if (!valid()) { clearAnimation(b, u, state); watch.cancel(); }
  }, { owner: u });
  b.after(model(u).durations.Skill_1, () => {
    watch.cancel(); clearAnimation(b, u, state);
  }, { owner: u });
}
function counter(b, u, s) {
  if (u.findBuff(CD)) return;
  const keys = absoluteRangeKeys(evidence.ranges['x-4'].grids.map(p => [p.row, p.col]), u.tileR, u.tileC, 'RIGHT');
  for (const e of b.enemies) {
    // Source purposeNONE is kept distinct from attack acquisition. Recipient
    // buff selection is a one-time range sample; emitted nonderived child may
    // survive the parent's finish or removal and still uses its original Unit.
    if (!live(e) || e.isFlying || e.s.flags.untargetable || !bodyInKeys(e, keys)) continue;
    b.addBuff(e, { key: 'philae_s_2[ep]', source: u, refresh: 'independent', duration: .06669999659061432,
      interval: .033399999141693115, data: { fired: false }, onTick: ({ buff }) => {
        if (buff.data.fired || !e.alive || !e.deployed) return;
        buff.data.fired = true;
        const atk = u.s.atk, attackId = ++b._attackSeq;
        b.dealDamage(u, e, { amount: atk * s.bb.atk_scale, type: 'arts', isAttack: true,
          isSkill: true, applyWay: 'none', attackId, canDodge: false, tags: ['philae:counter'] });
        if (e.alive) b.dealDamage(u, e, { amount: atk * s.bb.ep_damage_ratio, type: 'element', element: 'necrosis',
          isAttack: false, isSkill: true, applyWay: 'none', attackId, canDodge: false,
          tags: ['philae:counter-injury'] });
      } });
  }
  b.addBuff(u, { key: CD, source: u, duration: s.bb.aoe_cd });
}
export function customizePhilaeKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, hits: 1, hitAllBlocked: false, install: null, retargetOnRelease: true,
    attackVisual: 'Attack', windup: (_b, a) => model(a).hits.Attack[0] / rate(a) };
  const s = def.skill;
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    mods: { hpPct: s.bb.max_hp }, ...(s.id === 'skchr_philae_1' ? {
      onStart: () => shieldStart(b, u, s),
      onEnd: () => { u.mem.philaeBarrier = null; clearAnimation(b, u, u.mem.philaeAnimation); },
    } : {
      attack: { noAttack: true }, flags: { disarm: true },
      onStart: () => {
        const seq = u.deploySeq, activation = u.skill.activations;
        u.mem.regularFormVisual = { clip: ['UP', 'LEFT'].includes(u.dir) ? 'Skill_2_Start' : 'Skill_2_Begin', loop: false };
        b.after(.333, () => {
          if (live(u) && u.deploySeq === seq && u.skill.active && u.skill.activations === activation)
            u.mem.regularFormVisual = { clip: 'Skill_2_Loop', loop: true };
        }, { owner: u });
      },
      onEnd: () => {
        b.removeBuff(u, CD); b.removeBuff(u, ATK);
        if (!live(u)) { u.mem.regularFormVisual = null; return; }
        const seq = u.deploySeq, activation = u.skill.activations;
        u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
        // ON_FINISH restores native mode0 immediately; End is presentation,
        // never an invented extra ordinary-attack/SP lock.
        b.after(model(u).durations.Skill_2_End, () => {
          if (u.deploySeq === seq && u.skill.activations === activation && !u.skill.active)
            u.mem.regularFormVisual = null;
        }, { owner: u });
      },
    }) };
}
export function installPhilae({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const t = def.talents[0]?.bb;
  b.on('deploy', ({ unit }) => {
    if (unit === u && t) b.addBuff(u, { key: 'philae_t_1', source: u,
      mods: { elemTakenMul: 1 - t.damage_resistance } });
  }, { owner: u });
  b.on('elementHit', ({ target, dmg }) => {
    if (target !== u || !live(u) || dmg.cancel || dmg.type !== 'element') return;
    // Source IsElementDamage has no amount-positive/attack filter. A typed
    // event that actually reaches this modifier hook may be fully absorbed or
    // zero; core locked/invulnerable/cancelled contexts still produce no action.
    if (t && dmg.element === 'necrosis') u.skill.gainSp(t.sp, 'philae:talent');
    if (u.skill.active && !first(u) && !u.findBuff(ATK))
      b.addBuff(u, { key: ATK, source: u, mods: { atkPct: def.skill.bb.atk } });
  }, { owner: u });
  b.on('elementHit', ({ target, dmg }) => {
    const pool = u.mem.philaeBarrier;
    if (target !== u || !live(u) || !u.skill.active || !first(u) || !pool || dmg.cancel || dmg.type !== 'element') return;
    const factor = dmg.mul * elementIntake(u), incoming = dmg.amount * factor;
    if (!(incoming > 0) || !(factor > 0)) return;
    const blocked = Math.min(incoming, pool.value);
    pool.value = Math.max(0, pool.value - blocked); dmg.amount = (incoming - blocked) / factor;
  }, { owner: u, priority: -2000 });
  b.on('damaged', ({ target, dmg, type }) => {
    if (target !== u || !live(u) || !u.skill.active || first(u) || !dmg
      || dmg.cancel || !['phys', 'arts', 'true', 'elemental'].includes(type) || dmg.tags.includes('hpLoss')) return;
    // Accepted HP modifier receipt, including shields/floor0, is the bounded
    // bridge. No inference that rejected dodge/cancel dispatch ON_TAKE_DAMAGE.
    counter(b, u, def.skill);
  }, { owner: u });
}
