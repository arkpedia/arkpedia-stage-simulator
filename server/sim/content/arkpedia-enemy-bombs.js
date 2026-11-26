// SPDX-License-Identifier: GPL-3.0-or-later
// Anti-Witchcraft Repositionable Bomb (enemy_1369_bmbcar1) and its carrier (enemy_1370_bmbcar2). Numbers arrive in
// `p` from the reviewed contract (shared/arkpedia/enemy-bomb-features.js). The bomb is a neutral unit (runtime plan
// side 'neutral'): enemies' ordinary selectors take it (taunt 1), operators hit its carrier instead.
const SPEED = 'ab:bombSpeed', STOP = 'ab:bombStop', BOOM = 'ab:bombExplosion';
const live = u => u?.alive && u.deployed !== false && !u.hidden;

export function antiWitchcraftBomb(p) {
  validate(p);
  const setSpeed = (b, e, a) => {
    // FINAL_SCALER: base speed x SP x multiplier; at 0 SP it is UNMOVABLE (MoveBackwards).
    b.addBuff(e, { key: SPEED, persist: true, refresh: 'replace', mods: { moveMul: a.sp * p.speedPerSp } });
    if (a.sp <= 0 && !e.findBuff(STOP)) b.addBuff(e, { key: STOP, persist: true, flags: { noMove: true } });
    else if (a.sp > 0 && e.findBuff(STOP)) b.removeBuff(e, STOP);
  };
  const modify = (b, e, a, delta) => { a.sp = Math.max(0, Math.min(p.maxSp, a.sp + delta)); };
  const altarNear = (b, e) => (b.stageBloodAltars?.entries ?? []).find(x => x.unit.alive
    && (x.col - e.x) ** 2 + (x.row - e.y) ** 2 <= p.explosion.trigger ** 2 + 1e-9) ?? null;
  // The other KillBmbcar circles: the Throne of Blood (radius 1, trap_bldore_kill[bmbcar]) and Duq'arael's second form
  // (radius 0.5, enemy_blord2_kill[bmbcar]); contact is the circles touching the bomb's own collider.
  const contact = (b, e) => {
    const altar = altarNear(b, e);
    if (altar) return { altar };
    if (b.stageBloodThrone?.touches(e, p.explosion.collider)) return { throne: true };
    const lord = b.enemies.find(u => u.alive && u.deployed && !u.hidden && u.mem.bloodLordTwo
      && (u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= (u.mem.bloodLordTwo.contact + p.explosion.collider) ** 2 + 1e-9);
    return lord ? { lord } : null;
  };
  const dropCarrier = (b, a) => { const c = a.carrier; a.carrier = null; if (c?.alive) b._remove(c, 'withdraw', null, true); };
  return {
    spawn(b, e, a) {
      a.sp = p.initSp; a.lastCarrierHit = -Infinity; a.nextDecay = b.time + p.decay.interval; a.nextSpeed = b.time; a.boom = null;
      e.profile.noAttack = true; e.profile.enemyTargetable = true; e.profile.neutralExit = true; e.profile.holdsBattle = false;
      e.counted = false; e.lpr = 0;
      b.addBuff(e, { key: 'ab:bombBody', persist: true, flags: { unblockable: true } });
      // The bomb's own damage: -1 SP per instance (sp[self] ON_TAKE_DAMAGE).
      b.on('damaged', c => { if (c.target === e && e.alive && !a.boom && c.amount > 0) modify(b, e, a, p.hitLoss); }, { owner: e });
      const carrier = b.spawnEnemy(p.carrier, { pos: [e.y, e.x], countInTotal: false });
      if (!carrier) throw Error('Bomb carrier could not be placed');
      carrier.mem.bombMain = e; carrier.mem.bombState = a; a.carrier = carrier;
      carrier.route = { legs: [{ t: 'wait', time: 1e9 }], legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
      setSpeed(b, e, a);
    },
    /** Called by the carrier when an operator's hit lands on it: the hit is cancelled and the bomb gains SP. */
    carrierHit(b, e, a) { if (a.boom) return; modify(b, e, a, 1); a.lastCarrierHit = b.time; },
    tick(b, e, a) {
      if (!e.alive) return;
      const c = a.carrier;
      if (c?.alive) { c.x = e.x; c.y = e.y; c.tileR = Math.round(e.y); c.tileC = Math.round(e.x); }
      if (a.boom) {
        a.boom.t = b.time - a.boom.start;
        if (!a.boom.released && a.boom.t + 1e-9 >= p.explosion.anim.hit) {
          a.boom.released = true;
          for (const u of b.enemiesInRadius(e.x, e.y, p.explosion.radius)) {
            if (u === c || !live(u) || u.mem?.stageUnitDevice || u.mem?.bombMain) continue;
            b.dealDamage(e, u, { amount: e.s.atk * p.explosion.scale, type: 'true', isSkill: true, isSplash: true, applyWay: 'none', tags: ['bombExplosion'] });
          }
        }
        if (a.boom.t + 1e-9 >= p.explosion.anim.dur) {
          // trap_bonore_kill[bmbcar] finishes -> the Altar's ActiveOutset (activation + InstantKill); then the bomb leaves.
          // trap_bldore_kill[bmbcar]: the Throne's bombed(). enemy_blord2_kill[bmbcar]: his Loading Point is marked and
          // Sunken Death forced, unless he is casting it.
          if (a.boom.altar) b.stageBloodAltars?.destroy(a.boom.altar);
          else if (a.boom.throne) b.stageBloodThrone?.bombed();
          else if (a.boom.lord?.alive) a.boom.lord.mem.bloodLordTwo?.bombed(b.stageBombLoaders?.senderOf(e) ?? null);
          dropCarrier(b, a);
          b.kill(e, null);
        }
        return;
      }
      const touched = contact(b, e);
      if (touched) {
        a.boom = { ...touched, start: b.time, t: 0, released: false };
        b.addBuff(e, { key: BOOM, persist: true, flags: { invulnerable: true, noMove: true } });
        e.skillAnimUntil = b.time + p.explosion.anim.dur;
        return;
      }
      while (b.time + 1e-9 >= a.nextDecay) {
        a.nextDecay += p.decay.interval;
        const quiet = b.time - a.lastCarrierHit;
        if (quiet + 1e-9 >= p.decay.after2) modify(b, e, a, p.decay.step2);
        else if (quiet + 1e-9 >= p.decay.after1) modify(b, e, a, p.decay.step1);
      }
      if (b.time + 1e-9 >= a.nextSpeed) { a.nextSpeed += p.speedInterval; setSpeed(b, e, a); }
    },
    death(c, b, e, a) { dropCarrier(b, a); },
  };
}

/** The carrier: an enemy-side body that follows its bomb; any damage on it is cancelled and feeds the bomb's SP. */
export function bombCarrier() {
  return {
    spawn(b, e) {
      e.profile.noAttack = true; e.profile.holdsBattle = false; e.counted = false; e.lpr = 0;
      // ALLY_TARGET_FREE, UNDEADABLE, ELEMENT_FREE_ALL, UNBALANCE_IMMUNE; immune to stun, freeze, levitate and sleep.
      b.addBuff(e, { key: 'ab:bombCarrier', persist: true, flags: { unblockable: true, noMove: true, noDisplace: true, isolated: true } });
      e.def = { ...e.def, immune: new Set([...(e.def.immune ?? []), 'stun', 'frozen', 'levitate', 'sleep']) };
    },
    hitIn(c, b, e) {
      c.dmg.cancel = true;
      const main = e.mem.bombMain, ab = main?.mem?.ab?.list?.find(x => typeof x.carrierHit === 'function');
      if (main?.alive && ab) ab.carrierHit(b, main, ab);
    },
  };
}

/** Sarkaz Boneguard: bombs whose collider overlaps its circle (`contact`) are UNMOVABLE while inside; leaving the circle
 * or the Boneguard's death releases them (enemy_spnshd_bmbcar_buff, removed when the target leaves). */
export function bombStopAura(p) {
  if (!(p?.radius > 0 && p.contact >= p.radius && typeof p.bomb === 'string')) throw Error('Invalid bomb stop parameters');
  const release = (b, e, a) => { for (const u of a.held) if (u.alive) b.removeBuff(u, a.key); a.held.clear(); };
  return {
    spawn(b, e, a) { a.held = new Set(); a.key = `ab:bombStop:${e.id}`; },
    tick(b, e, a) {
      if (!e.alive) return;
      const inside = new Set(b.neutralUnits.filter(u => u.alive && !u.hidden && u.defId === p.bomb
        && (u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= p.contact ** 2 + 1e-9));
      for (const u of a.held) if (!inside.has(u)) { if (u.alive) b.removeBuff(u, a.key); a.held.delete(u); }
      for (const u of inside) if (!a.held.has(u)) { b.addBuff(u, { key: a.key, source: e, persist: true, flags: { noMove: true } }); a.held.add(u); }
    },
    death(c, b, e, a) { release(b, e, a); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0;
  const ok = pos(p?.maxSp) && p.initSp >= 0 && p.initSp <= p.maxSp && pos(p.speedPerSp) && pos(p.speedInterval) && typeof p.carrier === 'string'
    && Number.isFinite(p.hitLoss) && p.hitLoss < 0 && pos(p.decay?.interval) && pos(p.decay.after1) && p.decay.after2 > p.decay.after1
    && p.decay.step1 < 0 && p.decay.step2 < 0 && pos(p.explosion?.scale) && pos(p.explosion.radius) && pos(p.explosion.trigger) && pos(p.explosion.collider)
    && pos(p.explosion.anim?.dur) && pos(p.explosion.anim.hit) && p.explosion.anim.hit <= p.explosion.anim.dur;
  if (!ok) throw Error('Invalid Anti-Witchcraft bomb parameters');
}
