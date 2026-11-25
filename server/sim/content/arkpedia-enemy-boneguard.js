// SPDX-License-Identifier: GPL-3.0-or-later
// Sarkaz Boneguard Fluxcaster / Captain (enemy_1365_spnwiz, _2): its Bloodcalling Altar rebirth. Numbers arrive in `p`
// from the reviewed contract (shared/arkpedia/enemy-boneguard-features.js).
// - Caster: an ordinary ranged Arts attacker. Knocked out (not by a fall) while an Altar covers its tile
//   (b.stageBloodAltars.covers), it is reborn instead: Reborning for p.reborn s, then the drifting Ghost, at full HP.
// - Ghost: untouchable, rooted, no attack, unblockable. Every p.check s (first p.check s in) it withdraws for good
//   (InstantKill, a kill) when no Altar covers it any more. While covered it carries the Altar's `enemy_bonore_mark`
//   (e.mem.boneguardGhost; the Captain's Ghost carries one of its own, e.mem.boneguardOwnMark), so a pulse takes it; the pulse revives it (e.mem.boneguardRevive) into its caster mode.
import { rebirthCleanse, rebirthCooldowns, setForm } from './arkpedia-enemy-forms.js';

const REBORNING = 'spnwiz:reborning', GHOST = 'spnwiz:ghost', ENTRY = 'spnwiz:tick_invincible';

export function boneguard(p) {
  const pos = v => Number.isFinite(v) && v > 0;
  if (!(pos(p?.reborn) && pos(p.check) && pos(p.spawnInvincible) && p.hp > 0 && p.hp <= 1 && typeof p.ownMark === 'boolean')) throw Error('Invalid Boneguard Fluxcaster parameters');
  // enemy_spnwiz_default[tick_invincible]: 0.15 s INVINCIBLE whenever caster mode starts.
  const caster = (b, e, a) => {
    a.state = 'caster';
    e.mem.boneguardOwnMark = p.ownMark;
    e.mem.boneguardGhost = false; e.mem.boneguardRevive = false;
    b.addBuff(e, { key: ENTRY, duration: p.spawnInvincible, flags: { invulnerable: true } });
  };
  const drift = (b, e, a) => {
    if (!e.alive || a.state !== 'reborning') return;
    a.state = 'ghost'; a.next = p.check;
    e.mem.boneguardGhost = true;
    b.addBuff(e, { key: GHOST, persist: true, visible: true,
      flags: { invulnerable: true, untargetable: true, unblockable: true, noMove: true, disarm: true } });
    setForm(b, e, 'ghost', 'phase');
  };
  const revive = (b, e, a) => {
    b.removeBuff(e, GHOST);
    e.profile.noAttack = a.noAtk;
    if (e.route) e.route.pts = null;
    e.atkCd = 0;
    rebirthCooldowns(e);
    caster(b, e, a);
    setForm(b, e, 'caster', 'revive', { kind: 'reborn' });
  };
  return {
    spawn(b, e, a) { caster(b, e, a); },
    // enemy_spnwiz_reborn_ctrl, ON_BEFORE_TRY_SET_HP_ZERO: reborn only inside an Altar's range.
    killed(c, b, e, a) {
      if (a.state !== 'caster' || e.mem.deathByFall || !b.stageBloodAltars?.covers(e)) return false;
      a.state = 'reborning';
      a.noAtk = e.profile.noAttack;
      rebirthCleanse(b, e);
      e.hp = Math.max(1, e.s.maxHp * p.hp);
      e.profile.noAttack = true;
      b.addBuff(e, { key: REBORNING, duration: p.reborn, persist: true, visible: true,
        flags: { invulnerable: true, untargetable: true, unblockable: true, noMove: true, stun: true },
        onExpire: ({ battle }) => drift(battle, e, a) });
      setForm(b, e, 'reborn', 'telegraph', { r: 1, dur: p.reborn, kind: 'reborn' });
      return true;
    },
    tick(b, e, a, dt) {
      if (!e.alive || a.state !== 'ghost') return;
      if (e.mem.boneguardRevive) { revive(b, e, a); return; }
      a.next -= dt;
      if (a.next > 1e-9) return;
      a.next += p.check;
      // enemy_spnwiz_ghost_suicide: no `trap_bonore_in_range[ghost]` -> InstantKill.
      if (!b.stageBloodAltars?.covers(e)) { b.removeBuff(e, GHOST); e.mem.boneguardGhost = false; b.kill(e, null); }
    },
    death(c, b, e, a) { a.state = null; e.mem.boneguardGhost = false; e.mem.boneguardRevive = false; },
  };
}
