// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-spuria-prefabs.json' with { type: 'json' };
import { canTargetEnemy } from '../targeting.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';

const ID = 'char_4015_spuria';
const present = u => u?.alive && u.deployed;
const live = u => present(u) && !u.hidden;
const second = u => u.skill?.active && u.skill.id === 'skchr_spuria_2';
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const vector = u => ({ RIGHT: [1, 0], LEFT: [-1, 0], UP: [0, 1], DOWN: [0, -1] })[u.dir];

function recipient(b, u) {
  const [dx, dy] = vector(u);
  return b.allyUnits.filter(a => live(a) && a !== u && a.kind === 'op'
    && a.def.profession === 'SNIPER' && !a.s.flags.untargetable && b.allySelectable(a, u)
    && u.rangeKeySet.has(a.tileR * 21 + a.tileC)
    && (a.x - u.x) * dx + (a.y - u.y) * dy > 0)
    .sort((a, z) => {
      const direct = a => a.tileC === u.tileC + dx && a.tileR === u.tileR + dy;
      return Number(direct(z)) - Number(direct(a))
        || Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(z.x - u.x, z.y - u.y)
        || a.deploySeq - z.deploySeq;
    })[0];
}

function windup(b, u) {
  const down = u.dir === 'DOWN', prefix = second(u) ? 'Skill' : 'Attack';
  const clip = `${prefix}${down ? '_Down' : ''}_Loop`, m = model(u);
  u.mem.spuriaClip = clip;
  const opening = !second(u) && !u.mem.spuriaOpened;
  u.mem.spuriaOpened = true;
  const delay = opening ? m.durations[down ? 'Attack_Down_Begin' : 'Attack_Begin'] / rate(u) : 0;
  if (opening) {
    const seq = u.deploySeq, epoch = u.attackControlEpoch;
    u.mem.regularFormVisual = { clip: down ? 'Attack_Down_Begin' : 'Attack_Begin', loop: false, speed: rate(u) };
    b.after(delay, () => {
      if (live(u) && u.deploySeq === seq && u.attackControlEpoch === epoch)
        u.mem.regularFormVisual = null;
    }, { owner: u });
  }
  return delay + m.hits[clip][0] / rate(u);
}

function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const isSkill = second(u);
  b.addProjectile({ from: u, target, source: u, speed: 15, maxAge: 5,
    visual: 'orb', data: { arkpediaTrackedVisual: true },
    onHit: ({ target: e }) => {
      if (!e || !canTargetEnemy(u, e, p)) return;
      const bb = u.def.talents[0]?.bb;
      // Native additive active buff runs one Dice followed by equally weighted
      // RandomCreateBuff. The born extra damage must not recursively roll.
      const branch = bb && b.rng.chance(bb.prob) ? b.rng.int(3) : -1;
      const hit = (extra = false) => b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul,
        type: 'phys', isAttack: true, isSkill, attackId: info.attackId,
        applyWay: 'ranged', defIgnorePct: branch === 2 ? bb.def_penetrate : 0,
        tags: [extra ? 'spuria:extra' : 'spuria:main'] });
      if (branch === 0) hit(true);
      else if (branch === 1) b.applyStatus(e, 'stun', { duration: bb.stun, source: u });
      if (e.alive) hit();
    } });
}

function weaponBuff(b, u, a) {
  const key = `spuria:s2:${u.id}`, s = u.skill;
  b.addBuff(a, { key, source: u, duration: s.duration,
    mods: { atkPct: s.bb.atk, aspd: s.bb.attack_speed } });
  // Recipient buff owns its duration. A withdrawn source does not prematurely
  // remove a successfully born buff; target withdrawal naturally clears it.
  const marks = new Map();
  const beginning = b.on('beforeAttack', c => {
    if (c.attacker === a) marks.set(b._attackSeq + 1, { spent: false });
  });
  const output = b.on('damaged', c => {
    const mark = marks.get(c.dmg?.attackId);
    if (c.source !== a || c.target.side === a.side || !c.dmg?.isAttack
      || !live(a) || !a.findBuff(key) || !mark || mark.spent) return;
    if (b.rng.chance(s.bb.prob)) {
      mark.spent = true;
      b.applyStatus(a, 'stun', { duration: s.bb.stun_time, source: u });
    }
  });
  const finish = b.on('tick', () => {
    if (!present(a) || !a.findBuff(key)) {
      b.off(beginning); b.off(output); b.off(finish);
    }
  });
}

export function customizeSpuriaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { attack: 'ranged', projectile: 'none', dmgType: 'phys', canHitFly: true,
    maxTargets: 1, maxTargetsByBlock: false, hits: 1, hitsFn: null,
    allInRange: false, hitAllBlocked: false, splashRadius: 0, chain: null,
    dmgMul: null, install: null, retargetOnRelease: true, interruptOnSkillChange: true,
    windup, attackVisual: () => u.mem.spuriaClip, launchAttack: launch };
  const s = def.skill;
  const keys = s.id === 'skchr_spuria_1' ? ['attack_speed'] : ['atk', 'attack_speed', 'stun_time', 'prob'];
  if (Object.keys(s.bb).length !== keys.length || keys.some(k => !Number.isFinite(s.bb[k])))
    throw Error('Unreviewed Spuria skill blackboard');
  if (s.id === 'skchr_spuria_1') kit.skill = { kind: 'passive', onStart: () => {
    b.addBuff(u, { key: 'spuria:s1', source: u, duration: s.duration, mods: { aspd: s.bb.attack_speed } });
  } };
  else kit.skill = { kind: 'duration', duration: s.duration,
    canActivate: () => !!recipient(b, u), onStart: () => {
      const ally = recipient(b, u);
      if (ally) weaponBuff(b, u, ally);
      weaponBuff(b, u, u);
      const seq = u.deploySeq;
      u.mem.regularFormVisual = { clip: 'Skill_Begin', loop: false };
      b.after(model(u).durations.Skill_Begin, () => {
        if (live(u) && u.deploySeq === seq && second(u))
          u.mem.regularFormVisual = { clip: 'Skill_Idle', loop: true };
      }, { owner: u });
    }, onEnd: () => { u.mem.regularFormVisual = null; b.removeBuff(u, `spuria:s2:${u.id}`); } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installSpuria({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const fraction = def.raw.trait.bb.hp_ratio;
  if (fraction !== .01) throw Error('Unreviewed Spuria HP drain');
  let drain;
  b.on('deploy', c => {
    if (c.unit !== u) return;
    u.mem.spuriaOpened = false;
    drain?.cancel();
    drain = b.every(1, () => {
      if (!present(u)) return;
      applyHpLoss(b, u, u, Math.max(0, Math.min(u.hp - 1, u.s.maxHp * fraction)),
        makeDamageInfo({ type: 'true', noSp: true, isAttack: true,
          tags: ['spuria:drain'], origin: { kind: 'spuria-drain' } }));
    }, { owner: u });
  }, { owner: u });
}
