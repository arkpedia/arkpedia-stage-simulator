// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter-12 identification (鉴定) for the reviewed Pathfinder Spy and Norport Civilian. Every number arrives in `p`
// from shared/arkpedia/enemy-norport-identity-features.js; sight comes from the level's chapter-12 sight
// (arkpedia-stage-sight.js). Without that environment only blocking identifies.
const DISGUISE = 'enemy_mainline12[civilianMode]', CIVILIAN = 'unit_mainline12[civilianMode]',
  SWITCH = 'enemy_mainline12[switchModeAbnormals]', MOVE = 'enemy_wdnjd[moveSpeed]', CONFIRMED = 'civilian_mainline12[detectComplete]';

export function norportIdentity(p) {
  validate(p);
  const spy = p.kind === 'spy';
  const visual = (e, a) => {
    if (!spy) return null;
    if (a.state === 'switching') return { clip: 'Die_A', die: 'Die_A', loop: false, playId: `switch:${e.id}` };
    const set = a.state === 'revealed' ? p.clips.revealed : p.clips.disguised;
    return { clip: e.moving ? `Move_${set}` : `Idle_${set}`, move: `Move_${set}`, attack: 'Attack', die: `Die_${set}`, loop: true, replace: true };
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
    // switchMode: mode 1. The disguise ends; melee attacks, moveSpeed +0.05 (ADDITION), the next attack x atk_scale.
    a.state = 'revealed'; a.bonus = true;
    b.removeBuff(e, DISGUISE);
    e.profile.noAttack = false; e.atkCd = 0;
    b.addBuff(e, { key: MOVE, persist: true, mods: { moveFlat: p.move } });
  };
  return {
    spawn(b, e, a) {
      a.norportIdentity = true; a.state = 'detecting'; a.phase = 1; a.progress = 0; a.acc = 0; a.bonus = false;
      if (spy) {
        e.profile.spy = true; e.profile.noAttack = true; e.def = { ...e.def, attackAnim: p.attackAnim };
        b.addBuff(e, { key: DISGUISE, persist: true, flags: { invulnerable: true } });
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

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0;
  const d = p?.detect;
  const ok = ['spy', 'civilian'].includes(p?.kind) && pos(d?.interval) && pos(d.threshold) && d.cap >= d.threshold
    && Array.isArray(d.gain) && d.gain.length === 2 && d.gain.every(pos) && pos(d.loss)
    && (p.kind === 'spy' ? pos(p.switchDur) && Number.isFinite(p.move) && pos(p.atkScale) && pos(p.attackAnim?.dur)
      && Number.isFinite(p.attackAnim.hit) && typeof p.clips?.disguised === 'string' && typeof p.clips.revealed === 'string'
      : pos(p.dp));
  if (!ok) throw Error('Invalid Norport identity parameters');
}
