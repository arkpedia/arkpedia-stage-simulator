// SPDX-License-Identifier: GPL-3.0-or-later
// Enemy feature registry: behaviour attaches by feature, not by enemy id. A
// feature is a handbook ability line (`ability:<text>`), a talent group
// (`talent:<group>`) or a skill prefab key (`skill:<prefabKey>`). Each entry is
// reviewed against the data it covers:
//   covers(record) — true when the compiled record already models the feature
//                    (checked for every database level of every enemy using it);
//   trait          — a spawn-time behaviour the battle applies (applyEnemyFeatures).
// An enemy is supported only when every feature it uses is registered and
// covered (shared/arkpedia/enemy-support.js).

const REBORN_PARAMS = new Set(['duration', 'hp_ratio', 'invincible']);
function rebornFamily(group) {
  return { [`talent:${group}`]: {
    covers: r => r.talents.groups[group].includes('duration') && r.talents.groups[group].every(p => REBORN_PARAMS.has(p)),
    ability: { kind: 'reborn', params: r => ({ dur: r.talents.bb[`${group}.duration`], hpRatio: r.talents.bb[`${group}.hp_ratio`] ?? 1,
      invincible: r.talents.bb[`${group}.invincible`] ?? 0 }) },
    note: 'reborn(): first KO → rebirth of duration s, then hp_ratio of max HP and invincible s' } };
}

export const ENEMY_FEATURES = Object.freeze({
  // Handbook lines restating what the record's stats already model.
  'ability:Flying unit.': { covers: r => r.stats.motion === 'FLY', note: 'motion FLY' },
  'ability:Regenerates HP over time.': { covers: r => r.stats.hpRecoveryPerSec > 0, note: 'hpRecoveryPerSec' },
  // Spawn traits.
  'ability:Cannot be blocked.': { covers: () => true, trait: { flags: { unblockable: true } }, note: 'unblockable for life' },
  'ability:<$ba.invisible>Invisible</>': { covers: () => true, trait: { flags: { stealth: true } },
    note: 'Invisible (ba.invisible): untargetable until revealed or blocked; blocking lifts it for the engine STEALTH_RESTORE window' },
  'ability:Attacks two targets simultaneously.': { covers: r => r.applyWay === 'RANGED' && r.stats.rangeRadius > 0, trait: { maxTargets: 2 }, note: 'two ranged targets per attack' },
  // Talent families. 重生 (Reborn/reborn talent): the first knock-out starts a rebirth of `duration` s, then the
  // enemy stands up with `hp_ratio` of its max HP (full when absent) and `invincible` s of invulnerability.
  ...rebornFamily('Reborn'), ...rebornFamily('reborn'),
  'ability:Attacks 2 targets simultaneously': { covers: r => r.applyWay === 'RANGED' && r.stats.rangeRadius > 0, trait: { maxTargets: 2 }, note: 'two ranged targets per attack' },
});

/** The features one compiled record uses. */
export function recordFeatureIds(record) {
  return [...new Set([
    ...record.abilities.map(a => `ability:${a.text}`),
    ...Object.keys(record.talents.groups).map(g => `talent:${g}`),
    ...record.skills.map(s => `skill:${s.prefabKey}`),
  ])];
}
