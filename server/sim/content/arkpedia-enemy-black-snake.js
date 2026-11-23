// SPDX-License-Identifier: GPL-3.0-or-later
// "Deathless Black Snake" (enemy_1515_bsnake). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-black-snake-features.js). Forms: 'first' -> 'reviving' -> 'inferno' -> 'second' -> 'down'
// -> 'final' -> dead. The two Infernos are the native ScreenAttack and FinalScreenAttack modes.
import { sortAllyTargets, canTargetAlly } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { segmentCircleEntry } from '../projectile-collision.js';
import { applyBurningBreath, BURNING_BREATH } from './arkpedia-burning-breath.js';

const CAST = 'ab:bsnakeCast', HOLD = 'ab:bsnakeHold', UP = 'reborn_up', INV = 'reborn_up[invincible]';
const live = u => u?.alive && u.deployed !== false && !u.hidden;

export function blackSnake(p) {
  validate(p);
  const form2 = a => a.form === 'second';
  const clip = (a, pair) => pair[form2(a) ? 1 : 0];

  // --- Protect: damage from a unit carrying this Black Snake's own Burning Breath x (1 - resistance) ---
  const carriesOwn = (u, e) => !!u?.buffs?.some(x => x.key === BURNING_BREATH && x.source === e);
  const carriers = b => b.allies(null, { includeTargetableDevices: true }).filter(u => live(u) && u.findBuff(BURNING_BREATH));

  // --- Skills ---
  const igniteTargets = (b, e) => sortAllyTargets(e, b.allies().filter(u => live(u) && canTargetAlly(e, u, true) && !u.findBuff(BURNING_BREATH))).slice(0, p.ignite.count);
  const explode = (b, e) => {
    // Every carrier in order: 100% Arts; its Burning Breath ends; 100% Arts to the operators on its tile and the four
    // around it except itself, which are re-ignited. A carrier killed by the first step ends its chain (PRTS).
    for (const target of carriers(b)) {
      if (!live(target)) continue;
      b.dealDamage(e, target, { amount: e.s.atk * p.explode.scale, type: 'arts', isSkill: true, applyWay: 'none', tags: ['bsnakeDetonate'] });
      if (!live(target)) continue;
      b.removeBuff(target, BURNING_BREATH);
      const r0 = Math.round(target.y), c0 = Math.round(target.x);
      const tiles = new Set(p.explode.tiles.map(([dr, dc]) => `${r0 + dr},${c0 + dc}`));
      for (const u of b.allies(null, { includeTargetableDevices: true })) {
        if (u === target || !live(u) || !tiles.has(`${Math.round(u.y)},${Math.round(u.x)}`)) continue;
        b.dealDamage(e, u, { amount: e.s.atk * p.explode.scale, type: 'arts', isSkill: true, isSplash: true, applyWay: 'none', tags: ['bsnakeSplash'] });
        if (live(u)) applyBurningBreath(b, e, u, p.explode.breath, { refresh: true, tag: 'bsnakeBreath' });
      }
    }
  };
  const release = (b, e, a) => {
    const { kind, targets } = a.cast;
    if (kind === 'ignite') { for (const u of targets) if (live(u)) applyBurningBreath(b, e, u, p.ignite.breath, { refresh: true, tag: 'bsnakeBreath' }); return; }
    if (kind === 'explode') { explode(b, e); return; }
    // SummonFlame: MoveNextLevelBranch with _isLoop; a stage without the branch has nothing to summon.
    if (b.stageBranches?.branches?.[p.flame.branch]) b.stageBranches.advance(p.flame.branch, { loop: true });
  };
  const finishCast = (b, e, a) => { a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST); };
  const skillList = a => [...(form2(a) ? [['flame', p.flame]] : []), ['ignite', p.ignite], ['explode', p.explode]];
  const resetSkills = a => { a.left = {}; for (const [k, s] of skillList(a)) a.left[k] = s.initial; };

  // --- Holding states: the revive, the second knock-out's 5 s and both Infernos ---
  const hold = (b, e, a, { invulnerable = true } = {}) => {
    if (a.cast) finishCast(b, e, a);
    e.profile.noAttack = true;
    b.addBuff(e, { key: HOLD, persist: true, flags: { invulnerable, unblockable: true, noMove: true, noDisplace: true } });
    b.releaseBlocked?.(e);
  };
  const unhold = (b, e) => { b.removeBuff(e, HOLD); e.profile.noAttack = false; if (e.route) e.route.pts = null; e.atkCd = 0; };
  const fireball = (b, e, row) => {
    const start = { x: -.5, y: row };
    const launch = () => {
      if (!e.alive) return;
      b.addProjectile({ from: start, source: e, to: { x: start.x + p.inferno.speed * p.inferno.lifetime, y: row }, speed: p.inferno.speed,
        maxAge: p.inferno.lifetime, expireInPlace: true, visual: 'enemy', data: { arkpediaTrackedVisual: true, bsnakeInferno: true },
        onMove: ({ projectile, previous, x, y }) => {
          const hits = b.allies(null, { includeTargetableDevices: true }).flatMap(u => {
            if (!live(u) || !canTargetAlly(e, u, true)) return [];
            const t = segmentCircleEntry(previous, { x, y }, u, p.inferno.radius + ALLY_COLLIDER_RADIUS);
            return t == null ? [] : [{ u, t }];
          }).sort((m, z) => m.t - z.t || m.u.deploySeq - z.u.deploySeq);
          if (hits.length) {
            const { u, t } = hits[0]; projectile.x = previous.x + (x - previous.x) * t; projectile.y = previous.y + (y - previous.y) * t;
            projectile.removed = true;
            b.dealDamage(e, u, { amount: e.s.atk * p.inferno.scale, type: 'arts', isSkill: true, applyWay: 'none', tags: ['bsnakeInferno'] });
          } else if (x > b.regularMapSize.cols - .5) projectile.removed = true;
        } });
    };
    // _randomDelayToBorn: each fireball starts up to 0.1 s late.
    const delay = b.rng.range(0, p.inferno.jitter);
    if (delay > 0) b.after(delay, launch, { owner: e }); else launch();
  };
  const startInferno = (b, e, a, final) => {
    a.form = final ? 'final' : 'inferno'; a.inferno = { t: 0, fired: 0 };
    hold(b, e, a);
  };
  const tickInferno = (b, e, a, dt) => {
    const s = a.inferno; s.t += dt;
    while (s.fired < p.inferno.volleys && s.t + 1e-9 >= (s.fired + 1) * p.inferno.interval) {
      s.fired++;
      for (let row = 0; row < b.regularMapSize.rows; row++) fireball(b, e, row);
    }
    if (s.t + 1e-9 < p.inferno.duration) return;
    a.inferno = null;
    if (a.form === 'final') { a.form = 'dead'; unhold(b, e); e.hp = 0; b.kill(e); return; }
    // The first Inferno ends in the second form with 15 s of invincibility.
    a.form = 'second'; unhold(b, e); resetSkills(a);
    b.addBuff(e, { key: INV, duration: p.inferno.invincible, visible: true, flags: { invulnerable: true } });
  };

  return {
    spawn(b, e, a) {
      a.bsnake = true; a.form = 'first'; a.cast = null; a.inferno = null; a.until = 0; resetSkills(a);
      e.profile.shot = 'none'; e.profile.deferHit = true;
      e.base.rangeRadius = p.radius; e.markDirty?.();
      e.profile.canTarget = u => !u.isFlying;
      e.def = { ...e.def, attackAnim: p.attack.anim[0] };
      (b._dealtMultipliers ??= new Map()).set(`bsnake:${e.id}`, (source, target) => target === e && carriesOwn(source, e) ? 1 - p.protect.resistance : 1);
    },
    attack(c, b, e, a) {
      if (!['first', 'second'].includes(a.form)) return;
      const target = c.targets.find(u => u?.alive);
      if (!target) return;
      b.dealDamage(e, target, { amount: e.s.atk * p.attack.scale, type: 'true', isAttack: true, attackId: b._attackSeq, applyWay: 'ranged', tags: ['bsnakeAttack'] });
      if (live(target)) applyBurningBreath(b, e, target, p.attack.breath, { refresh: true, tag: 'bsnakeBreath' });
    },
    killed(c, b, e, a) {
      if (a.form === 'first') {
        // First knock-out: the wave is released (he is tracked into the next one); a 5 s revive at full HP.
        b.stageWaveScheduler?.releaseCurrentWave(e, { trackSourceAtNextWave: true });
        a.form = 'reviving'; a.until = b.time + p.revive.dur; hold(b, e, a); e.hp = Math.min(1, e.s.maxHp);
        return true;
      }
      if (a.form === 'second') {
        // Second knock-out: the wave is released; he stays down 5 s, then the final Inferno.
        b.stageWaveScheduler?.releaseCurrentWave(e);
        a.form = 'down'; a.until = b.time + p.revive.down; hold(b, e, a); e.hp = Math.min(1, e.s.maxHp);
        return true;
      }
      // Holding states are invincible; the final Inferno's own InstantKill is the real death.
      return a.form !== 'dead';
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.form === 'reviving' || a.form === 'down') {
        if (b.time + 1e-9 < a.until) return;
        if (a.form === 'reviving') {
          b.addBuff(e, { key: UP, persist: true, visible: true, mods: { hpPct: p.revive.hpPct, atkPct: p.revive.atkPct } });
          e.hp = e.s.maxHp;
        }
        startInferno(b, e, a, a.form === 'down');
        return;
      }
      if (a.form === 'inferno' || a.form === 'final') { tickInferno(b, e, a, dt); return; }
      if (a.form === 'dead') return;
      e.def.attackAnim = clip(a, p.attack.anim);
      for (const [k] of skillList(a)) a.left[k] -= dt; // cooldowns run from the cast start
      if (a.cast) {
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= a.cast.anim.hit) { a.cast.released = true; release(b, e, a); }
        if (a.cast.elapsed + 1e-9 >= a.cast.anim.dur) finishCast(b, e, a);
        return;
      }
      // SummonFlame ignores silence; the others need the unit able to act.
      for (const [k, s] of skillList(a)) {
        if (a.left[k] > 1e-9) continue;
        if (k === 'flame' ? !e.alive : !e.canAct) continue;
        const targets = k === 'ignite' ? igniteTargets(b, e) : [];
        if (k === 'ignite' && !targets.length) continue;
        a.left[k] = s.cooldown;
        const anim = k === 'flame' ? s.anim : clip(a, s.anim);
        a.cast = { kind: k, targets, anim, elapsed: 0, released: false };
        e.profile.noAttack = true; e.skillAnimUntil = b.time + anim.dur;
        b.addBuff(e, { key: CAST, duration: anim.dur, persist: true, flags: { noMove: true } });
        return;
      }
    },
    death(c, b, e) { b._dealtMultipliers?.delete(`bsnake:${e.id}`); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  const anim = x => pos(x?.dur) && pos(x.hit) && x.hit <= x.dur, pair = x => Array.isArray(x) && x.length === 2 && x.every(anim);
  const breath = s => pos(s?.duration) && nn(s.base) && nn(s.add) && pos(s.ramp);
  const skill = s => pos(s?.cooldown) && nn(s.initial);
  const ok = pos(p?.radius) && pos(p.attack?.scale) && pair(p.attack.anim) && breath(p.attack.breath)
    && skill(p.ignite) && Number.isInteger(p.ignite.count) && p.ignite.count > 0 && breath(p.ignite.breath) && pair(p.ignite.anim)
    && skill(p.explode) && pos(p.explode.scale) && breath(p.explode.breath) && pair(p.explode.anim) && Array.isArray(p.explode.tiles) && p.explode.tiles.length === 5
    && p.protect?.resistance > 0 && p.protect.resistance < 1
    && pos(p.revive?.dur) && pos(p.revive.down) && nn(p.revive.hpPct) && nn(p.revive.atkPct)
    && pos(p.inferno?.duration) && pos(p.inferno.interval) && Number.isInteger(p.inferno.volleys) && p.inferno.volleys > 0 && nn(p.inferno.invincible)
    && pos(p.inferno.scale) && pos(p.inferno.speed) && pos(p.inferno.radius) && pos(p.inferno.lifetime) && nn(p.inferno.jitter)
    && p.inferno.volleys * p.inferno.interval <= p.inferno.duration
    && skill(p.flame) && typeof p.flame.branch === 'string' && anim(p.flame.anim);
  if (!ok) throw Error('Invalid Black Snake parameters');
}
