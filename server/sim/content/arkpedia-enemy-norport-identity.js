// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter-12 identification (鉴定) for the reviewed Pathfinder, Sentry and Armed Spies, 12-16's 'Damazti Cluster' and the
// Norport Civilians, plus Eblana (12-16), who forces disguised units to switch. Every number arrives in `p`
// from shared/arkpedia/enemy-norport-identity-features.js; sight comes from the level's chapter-12 sight
// (arkpedia-stage-sight.js). Without that environment only blocking identifies.
import { ASPD_MIN, ASPD_MAX } from '../constants.js';

const DISGUISE = 'enemy_mainline12[civilianMode]', CIVILIAN = 'unit_mainline12[civilianMode]',
  SWITCH = 'enemy_mainline12[switchModeAbnormals]', MOVE = 'enemy_wdnjd[moveSpeed]', SENTRY_MOVE = 'enemy_wdyjd[moveSpeed]', CONFIRMED = 'civilian_mainline12[detectComplete]';

export function norportIdentity(p) {
  validate(p);
  const spy = p.kind === 'spy';
  // Clip names: a suffix pair (`A`/`B`: Move_A, Idle_A, Die_A) or explicit names per form.
  const names = set => typeof set === 'string' ? { move: `Move_${set}`, idle: `Idle_${set}`, die: `Die_${set}` } : set;
  const switchClip = typeof p.clips?.disguised === 'string' ? `Die_${p.clips.disguised}` : p.clips?.switch;
  const visual = (e, a) => {
    if (!spy) return null;
    if (a.state === 'switching') return { clip: switchClip, die: switchClip, loop: false, playId: `switch:${e.id}` };
    const set = names(a.state === 'revealed' ? p.clips.revealed : p.clips.disguised);
    return { clip: e.moving ? set.move : set.idle, move: set.move, attack: p.attackAnim ? 'Attack' : null, die: set.die, loop: true, replace: true };
  };
  const complete = (b, e, a) => {
    e.profile.revealed = true;
    b.emit('identityRevealed', { enemy: e });
    if (!spy) {
      // detectComplete: BLOCK_FREE; reaching the exit now raises max DP (BattleCore.leak reads civilianDp).
      a.state = 'confirmed'; e.profile.civilianDp = p.dp;
      b.addBuff(e, { key: CONFIRMED, persist: true, visible: true, flags: { unblockable: true } });
      b._unblock(e);
      return;
    }
    // switchModeTrigger: SwitchMode (Die_A) under FORCE_DISARMED, INVINCIBLE and UNMOVABLE_PRIVATE.
    a.state = 'switching'; a.until = b.time + p.switchDur;
    b.addBuff(e, { key: SWITCH, duration: p.switchDur, flags: { invulnerable: true, disarm: true, noMove: true } });
  };
  const reveal = (b, e, a) => {
    // switchMode: mode 1. The disguise ends; melee attacks and moveSpeed +move (ADDITION; the Armed Spy has none). The
    // Pathfinder Spy's next attack is x atk_scale; the Sentry Spy turns INVISIBLE, lifted while blocked and back
    // `restore` s after release (BattleCore._stealthSwitch).
    a.state = 'revealed'; a.bonus = p.atkScale != null;
    b.removeBuff(e, DISGUISE);
    if (p.guarded) {
      // 'Damazti Cluster': INVINCIBLE and BLOCK_FREE for good, and an empty attack.
      b.addBuff(e, { key: p.guarded.key, persist: true, visible: true, flags: { invulnerable: true, unblockable: true } });
      b._unblock(e);
      return;
    }
    e.profile.noAttack = false; e.atkCd = 0;
    if (p.move != null) b.addBuff(e, { key: p.invisible ? SENTRY_MOVE : MOVE, persist: true, mods: { moveFlat: p.move } });
    if (p.invisible) b.addBuff(e, { key: p.invisible.key, persist: true, visible: true, flags: { stealth: true }, data: { stealthRestore: p.invisible.restore } });
  };
  return {
    spawn(b, e, a) {
      a.norportIdentity = true; a.state = 'detecting'; a.phase = 1; a.progress = 0; a.acc = 0; a.bonus = false;
      if (spy) {
        e.profile.spy = true; e.profile.noAttack = true;
        if (p.attackAnim) e.def = { ...e.def, attackAnim: p.attackAnim };
        b.addBuff(e, { key: DISGUISE, persist: true, flags: { invulnerable: true } });
        // enemy_wdncr[triggerSwitchMode] (Eblana): identification ends and the normal switch starts, once.
        e.mem.norportIdentity = { detecting: () => e.alive && a.state === 'detecting',
          forceReveal: () => { if (!e.alive || a.state !== 'detecting') return false; complete(b, e, a); return true; } };
      } else {
        e.profile.friendly = true;
        b.addBuff(e, { key: CIVILIAN, persist: true, flags: { invulnerable: true } });
      }
      e.mem.regularFormVisual = visual(e, a);
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.state === 'switching') { if (b.time + 1e-9 >= a.until) reveal(b, e, a); e.mem.regularFormVisual = visual(e, a); return; }
      if (a.state === 'detecting') {
        a.acc += dt;
        while (a.state === 'detecting' && a.acc + 1e-9 >= p.detect.interval) {
          a.acc -= p.detect.interval;
          const seen = !e.hidden && (!!e.blockedBy || !!b.stageSight?.inSight(Math.round(e.y), Math.round(e.x)));
          a.progress = seen ? Math.min(p.detect.cap, a.progress + p.detect.gain[a.phase - 1]) : Math.max(0, a.progress - p.detect.loss);
          if (a.progress >= p.detect.threshold) {
            if (a.phase === 1) { a.phase = 2; a.progress = 0; }
            else complete(b, e, a);
          }
        }
      }
      e.mem.regularFormVisual = visual(e, a);
    },
    hitOut(c, b, e, a) {
      // enemy_wdnjd[bonus_attack]: one attack at atk_scale, then the flag ends.
      if (spy && a.bonus && c.dmg?.isAttack) { a.bonus = false; c.dmg.amount *= p.atkScale; }
    },
  };
}

// Eblana (enemy_1540_wdncr): every number arrives in `p` from eblanaParams (enemy-norport-identity-features.js).
// She never fights: her Attack_b and her one detectAll only make disguised units (enemy_mainline12[civilianMode])
// switch. Each cast holds her in place; at its OnAttack the switch starts. The projectile's flight is not modelled.
export function eblanaReveal(p) {
  validateEblana(p);
  const CAST = 'ab:wdncrCast';
  const live = u => u?.alive && !u.hidden;
  const disguised = (b, e) => b.enemies.filter(u => u !== e && live(u) && u.side === e.side && u.findBuff?.(p.disguise)
    && u.mem?.norportIdentity?.detecting());
  const visual = (e, a) => a.cast ? { clip: a.cast.clip, loop: false, playId: `${a.cast.clip}:${e.id}:${a.cast.n}`, die: p.clips.die }
    : { clip: e.moving ? p.clips.move : p.clips.idle, move: p.clips.move, attack: null, die: p.clips.die, loop: true, replace: true };
  const finish = (b, e, a) => { a.cast = null; e.skillAnimUntil = b.time; b.removeBuff(e, CAST); };
  const start = (b, e, a, cast) => {
    a.casts = (a.casts ?? 0) + 1;
    a.cast = { elapsed: 0, released: false, n: a.casts, ...cast };
    e.skillAnimUntil = b.time + cast.dur;
    b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
  };
  return {
    spawn(b, e, a) {
      a.eblana = true; a.cast = null; a.atkLeft = 0; a.skillLeft = p.detectAll.initCooldown; a.skillUsed = false; a.reveals = 0;
      e.profile.noAttack = true;
      b.addBuff(e, { key: p.key, persist: true, flags: { invulnerable: true, unblockable: true } });
      e.mem.regularFormVisual = visual(e, a);
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      a.atkLeft -= dt; if (!a.skillUsed) a.skillLeft -= dt;
      if (a.cast) {
        const c = a.cast;
        c.elapsed += dt * e.s.slowDownRate;
        if (!c.released && c.elapsed + 1e-9 >= c.hit) { c.released = true; c.release(b, e, a); }
        e.skillAnimUntil = b.time + Math.max(0, c.dur - c.elapsed);
        if (c.elapsed + 1e-9 >= c.dur) finish(b, e, a);
      } else if (e.canAct) {
        if (!a.skillUsed && a.skillLeft <= 1e-9 && !e.s.flags.silence) {
          // detectAll: every disguised unit on the map, at Skill_b_3's OnAttack.
          a.skillUsed = true;
          start(b, e, a, { ...p.detectAll, release: (b2, e2, a2) => {
            for (const u of disguised(b2, e2)) if (u.mem.norportIdentity.forceReveal()) a2.reveals++;
          } });
        } else if (a.atkLeft <= 1e-9) {
          const near = disguised(b, e).map(u => [u, Math.hypot(u.x - e.x, u.y - e.y)]).filter(([, d]) => d <= p.range + 1e-9)
            .sort((x, y) => x[1] - y[1])[0]?.[0];
          if (near) {
            // Her database attackSpeed is a defined 0; the generic loader reads it as 100. Use the literal value
            // (plus any ASPD changes on her) under the engine's ASPD floor.
            const aspd = Math.min(ASPD_MAX, Math.max(ASPD_MIN, p.aspd + e.s.aspd - e.base.aspd));
            a.atkLeft = e.s.bat * 100 / aspd;
            start(b, e, a, { ...p.attack, release: (_b, _e, a2) => { if (near.mem.norportIdentity.forceReveal()) a2.reveals++; } });
          }
        }
      }
      e.mem.regularFormVisual = visual(e, a);
    },
    death(_c, b, e, a) { if (a.cast) finish(b, e, a); },
  };
}

function validateEblana(p) {
  const pos = v => Number.isFinite(v) && v > 0;
  const clip = c => !!c && typeof c.clip === 'string' && pos(c.dur) && Number.isFinite(c.hit) && c.hit >= 0 && c.hit <= c.dur;
  if (!p || typeof p.key !== 'string' || typeof p.disguise !== 'string' || !pos(p.range) || !(p.aspd >= 0) || !clip(p.attack) || !clip(p.detectAll)
    || !(p.detectAll.initCooldown >= 0) || !p.clips || !['move', 'idle', 'die'].every(k => typeof p.clips[k] === 'string'))
    throw Error('Invalid Eblana parameters');
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0;
  const d = p?.detect;
  const ok = ['spy', 'civilian'].includes(p?.kind) && pos(d?.interval) && pos(d.threshold) && d.cap >= d.threshold
    && Array.isArray(d.gain) && d.gain.length === 2 && d.gain.every(pos) && pos(d.loss)
    && (p.kind === 'spy' ? pos(p.switchDur) && (p.move === null || Number.isFinite(p.move))
      && (p.guarded
        ? typeof p.guarded.key === 'string' && p.attackAnim == null && p.move == null && p.atkScale == null && p.invisible == null
          && clipSet(p.clips?.disguised) && clipSet(p.clips.revealed) && typeof p.clips.switch === 'string'
        : pos(p.attackAnim?.dur) && Number.isFinite(p.attackAnim.hit)
          && ((pos(p.atkScale) && p.invisible == null) || (p.atkScale == null && p.invisible == null)
            || (p.atkScale == null && typeof p.invisible?.key === 'string' && pos(p.invisible.restore)))
          && typeof p.clips?.disguised === 'string' && typeof p.clips.revealed === 'string')
      : pos(p.dp));
  if (!ok) throw Error('Invalid Norport identity parameters');
}
const clipSet = c => !!c && ['move', 'idle', 'die'].every(k => typeof c[k] === 'string');
