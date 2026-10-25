// SPDX-License-Identifier: GPL-3.0-or-later
// Native enemy_duckmi_t switches permanently to Run on incoming damage.
import review from '../../../data/candidates/arkpedia-reviewed-duck-run.json' with { type: 'json' };
export function nativeDuckRun(r) {
  const proof = review.enemies[r.key];
  if (!proof || r.prefabKey !== proof.prefabKey || JSON.stringify(r.talents.bb) !== JSON.stringify(proof.bb)
    || JSON.stringify(r.talents.groups) !== JSON.stringify(proof.groups)
    || JSON.stringify(r.abilities) !== JSON.stringify(proof.abilities)
    || JSON.stringify(r.skills) !== JSON.stringify(proof.skills)) throw Error('Unreviewed native Duck Lord run contract');
  return {
    spawn(b, e, a) {
      const life = e.deploySeq;
      a.active = true; a.running = false; a.speed = null;
      e.profile.noAttack = true;
      a.damageHook = b.on('damageFinal', c => {
        if (c.target !== e || !a.active || a.running || !e.alive || !e.deployed || e.deploySeq !== life) return;
        // No source/type/HP-loss predicate exists on the retained action.
        // The shield pipeline runs after this event; a shielded hit still
        // enters Run, while a rejected/invulnerable hit never dispatches it.
        a.running = true;
        a.speed = b.addBuff(e, { key: 'duckmi_speed_up', source: e, persist: true,
          mods: { moveMul: 1 + r.talents.bb['run.attack@move_speed'] } });
      }, { owner: e });
      a.detach = () => {
        a.active = false; b.off(a.damageHook);
        if (a.speed) b.removeBuff(e, a.speed); a.speed = null;
      };
      b.on('battleEnd', a.detach, { owner: e });
    },
    death(c, b, e, a) { a.detach(); },
  };
}
