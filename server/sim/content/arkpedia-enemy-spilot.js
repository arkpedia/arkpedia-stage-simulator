// SPDX-License-Identifier: GPL-3.0-or-later
// Commander Ulšulah (enemy_1368_spilot). Numbers arrive in `p` from the reviewed contract
// (shared/arkpedia/enemy-pilot-features.js); the Altar side is b.stageBloodAltars (arkpedia-stage-blood-altars.js).
// - Charge (【凝髓隙环】): first p.initial s in, then every p.cooldown s from the cast's start, while a Bloodcalling Altar
//   is not yet upgraded: a p.duration s cast (rooted, no attack; silence or stun ends it) at the nearest such Altar.
//   Meanwhile operators within p.radius of it get ASPD p.aspd. A cast that runs its full time upgrades the Altar.
// - Reborn: killed (a fall included: ON_OWNER_KILLED), it marks a random Altar, which summons it again after
//   p.returnDelay s. With no Altar left, the death is final. Reaching the exit is not a kill.
import { timedEnemyCasts } from './arkpedia-enemy-timed-casts.js';
import { OwnedStageAura } from './arkpedia-stage-auras.js';
import { auraSelectable } from '../targeting.js';

const AURA = 'spilot:atk_speed_down';

export function spilot(p) {
  const pos = v => Number.isFinite(v) && v > 0;
  if (!(Number.isFinite(p?.initial) && p.initial >= 0 && pos(p.cooldown) && pos(p.duration) && pos(p.radius) && pos(p.returnDelay)
    && Number.isFinite(p.aspd) && p.aspd < 0)) throw Error('Invalid Commander Ulšulah parameters');
  const auraTargets = (b, e) => b.alliesInRadius(e.x, e.y, p.radius).filter(u => auraSelectable(e, u));
  const charge = {
    initial: p.initial, cooldown: p.cooldown, duration: p.duration, release: p.duration, clip: 'Skill_Loop', slowDown: false,
    select: (b, e) => { const a = b.stageBloodAltars?.nearestUpgradable(e); return a ? [a] : []; },
    start(b, e, cast, st) {
      st.aura = new OwnedStageAura(b, e, { key: AURA, strength: -p.aspd, mods: { aspd: p.aspd } });
      st.aura.update(auraTargets(b, e));
    },
    // The cast's end: trap_bonore_upgraded[trigger] on its Altar (nothing if the Altar was destroyed meanwhile).
    fire(b, _e, targets) { b.stageBloodAltars?.upgrade(targets[0]); },
    finish(_b, _e, _cast, st) { st.aura?.clear(); st.aura = null; },
  };
  const casts = timedEnemyCasts([charge]);
  return {
    spawn(b, e, a) { a.aura = null; casts.spawn(b, e, a); },
    tick(b, e, a, dt) {
      casts.tick(b, e, a, dt);
      if (a.aura) a.aura.update(e.alive && e.deployed ? auraTargets(b, e) : []);
    },
    status(c, b, e, a) { casts.status(c, b, e, a); },
    death(c, b, e, a) {
      casts.death(c, b, e, a); a.aura?.clear(); a.aura = null;
      if (c.reason === 'killed') e.mem.spilotReturnAltar = b.stageBloodAltars?.markPilotReturn(p.returnDelay) ?? null;
    },
  };
}
