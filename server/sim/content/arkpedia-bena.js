// SPDX-License-Identifier: GPL-3.0-or-later
// Original mode graph and native dispatch limits: data/arkpedia-bena-prefabs.json.
import evidence from '../../../data/arkpedia-bena-prefabs.json' with { type: 'json' };
import { applyHpLoss, makeDamageInfo, isHpLoss } from '../damage.js';
import { canTargetEnemy } from '../targeting.js';
import { resolveHit } from '../ai.js';
const ID = 'char_369_bena';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const clock = u => Math.min(2, u.s.aspd / 100);
const second = u => u.skill.active && u.skill.id === 'skchr_bena_2';
function idle(u) {
  const doll = !!u.trait.doll;
  u.mem.regularFormVisual = { clip: doll ? 'Idle_B' : 'Idle_A', loop: true,
    attack: doll ? 'Attack_B' : 'Attack_A', die: doll ? 'Die_B' : 'Die_A' };
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  const clean = { ...p, launchAttack: null };
  if (!u.trait.doll) resolveHit(b, u, clean, e, info, e.x, e.y);
  else b.addProjectile({ from: u, target: e, source: u, speed: 15, maxAge: 10,
    visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: ({ target }) => {
      if (target && canTargetEnemy(u, target, clean))
        resolveHit(b, u, clean, target, info, target.x, target.y);
    } });
}
export function customizeBenaKit({ id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys',
    applyWay: 'melee', groundOnly: true, canHitFly: false, hits: 1,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    splashRadius: 0, chain: null, dmgMul: null, interruptOnSkillChange: true,
    windup: () => model(u).hits[u.trait.doll ? 'Attack_B' : 'Attack_A'][0] / clock(u),
    attackVisual: () => u.trait.doll ? 'Attack_B' : 'Attack_A', launchAttack: launch,
    canAttack: () => !u.trait.dollSwitching };
  const s = def.skill, bb = s.bb;
  kit.skill = { id: s.id, name: s.name, kind: 'duration',
    canActivate: () => !u.trait.doll && !u.trait.dollSwitching,
    mods: s.id === 'skchr_bena_1'
      ? { hpMul: 1 + bb.max_hp, atkPct: bb.atk, defIgnorePct: bb.def_penetrate }
      : { atkPct: bb.atk, aspd: bb.attack_speed },
    onStart: () => { u.atkCd = 0; idle(u); },
    onEnd: () => { u.atkCd = 0; if (!u.trait.dollSwitching) idle(u); } };
}

export function installBena({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const originalRange = u.rangeGrid, talent = def.talents[0];
  const substituteRange = talent?.rangeGrid;
  if (!substituteRange?.length) throw Error('Missing original Bena substitute range');
  const clear = () => {
    if (u.skill.active) u.skill.end('substitute');
    // Source ClearAllBuffs retains durable buffs and bena_tr only. Potential
    // and build attributes live in the base stats, outside this timed list.
    for (const buff of u.buffs.slice()) if (!buff.persist) b.removeBuff(u, buff);
    u.skill.sp = 0; u.skill.charges = 0;
  };
  const switchForm = doll => {
    const state = { seq: u.deploySeq };
    u.mem.benaSwitch = state; u.trait.dollSwitching = true;
    clear();
    const valid = () => live(u) && u.deploySeq === state.seq && u.mem.benaSwitch === state;
    b.addBuff(u, { key: 'bena:transition', flags: { invulnerable: true,
      undeadable: true, noSp: true, noHeal: true, healFree: true, isolated: true, disarm: true } });
    // Zero block starts on the first switch; the outgoing return resets it.
    if (doll) b.addBuff(u, { key: 'bena:zero-block', mods: { blockCntMul: 0 } });
    b.releaseBlocked(u);
    u.hp = u.s.maxHp;
    const out = doll ? 'Die_2_A' : 'Die_B', born = doll ? 'Start_B' : 'Start_A';
    // Back has no outgoing death clips. Use the actual original Front clip
    // during this bounded local transition; never fabricate a Back animation.
    u.mem.regularFormVisual = { clip: out, loop: false, speed: 1, forceFront: true };
    if (!doll) {
      u.trait.doll = false; u.form = null; u.rangeGrid = originalRange;
      u.profile.attack = 'melee'; u.profile.dmgType = 'phys'; u.profile.applyWay = 'melee';
      u.profile.canHitFly = false; u.profile.groundOnly = true;
      b.removeBuff(u, 'bena:zero-block'); b.refreshRange(u);
    }
    b.after(evidence.models[ID].Front.durations[out], () => {
      if (!valid()) return;
      if (doll) {
        u.trait.doll = true; u.form = 'doll'; u.rangeGrid = substituteRange;
        u.profile.attack = 'ranged'; u.profile.dmgType = 'arts'; u.profile.applyWay = 'ranged';
        u.profile.canHitFly = true; u.profile.groundOnly = false;
        b.addBuff(u, { key: 'bena:zero-block', mods: { blockCntMul: 0 } });
        b.applyStatus(u, 'sanctuary', { key: 'bena:resistance', source: u,
          value: talent.bb.damage_resistance, duration: Infinity });
        b.addBuff(u, { key: 'bena:substitute-sp', flags: { noSp: true } });
        b.refreshRange(u);
        // Original mode1 buff owns the selected20s countdown and returns on
        // its finish, including fatal substitute damage. Native phase origin
        // is unavailable; local mode entry starts it before Start_B completes.
        b.after(def.traitBb.duration, () => {
          if (valid() && u.trait.doll) switchForm(false);
        }, { owner: u });
      }
      u.mem.regularFormVisual = { clip: born, loop: false, speed: 1 };
      b.after(model(u).durations[born], () => {
        if (!valid()) return;
        b.removeBuff(u, 'bena:transition'); u.trait.dollSwitching = false;
        idle(u); u.atkCd = 0;
      }, { owner: u });
    }, { owner: u });
  };
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.benaSwitch = null; u.trait.doll = false; u.trait.dollSwitching = false; idle(u);
  }, { owner: u });
  b.on('fatal', ctx => {
    if (ctx.unit !== u || ctx.prevented) return;
    if (!u.trait.dollSwitching) switchForm(!u.trait.doll);
    ctx.prevented = true;
  }, { owner: u, priority: -100 });
  b.on('beforeStatus', ctx => {
    if (ctx.target === u && u.trait.dollSwitching && ['stun','freeze','sleep'].includes(ctx.status))
      ctx.cancel = true;
  }, { owner: u });
  b.on('damaged', ({ source, target, dmg, type }) => {
    // Original ON_OUTPUT_DAMAGE is unfiltered. This accepted output bridge
    // counts shield-absorbed zero but excludes cancellation, gauge accumulation
    // and the modifier-bypassing self cost, preventing recursive drains.
    if (source === u && target !== u && live(u) && second(u) && type !== 'element'
      && !isHpLoss(dmg)) applyHpLoss(b, u, u, u.s.maxHp * def.skill.bb.hp_ratio,
        makeDamageInfo({ type: 'true', isAttack: true, noSp: true, canDodge: false,
          applyWay: 'none', tags: ['bena:s2-cost'] }));
  }, { owner: u });
  for (const event of ['retreat','death']) b.on(event, ({ unit }) => {
    if (unit !== u) return;
    u.mem.benaSwitch = null; u.mem.regularFormVisual = null;
    u.trait.doll = false; u.trait.dollSwitching = false; u.form = null;
  }, { owner: u });
}
