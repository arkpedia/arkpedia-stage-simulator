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

export const ENEMY_FEATURES = Object.freeze({
  // Handbook lines restating what the record's stats already model.
  'ability:Flying unit.': { covers: r => r.stats.motion === 'FLY', note: 'motion FLY' },
  'ability:Regenerates HP over time.': { covers: r => r.stats.hpRecoveryPerSec > 0, note: 'hpRecoveryPerSec' },
  // Spawn traits.
  'ability:Cannot be blocked.': { covers: () => true, trait: { flags: { unblockable: true } }, note: 'unblockable for life' },
  'ability:<$ba.invisible>Invisible</>': { covers: () => true, trait: { flags: { stealth: true } },
    note: 'Invisible (ba.invisible): untargetable until revealed or blocked; blocking lifts it for the engine STEALTH_RESTORE window' },
  'ability:Attacks two targets simultaneously.': { covers: r => r.applyWay === 'RANGED' && r.stats.rangeRadius > 0, trait: { maxTargets: 2 }, note: 'two ranged targets per attack' },
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

/** Apply the spawn traits of a spawned enemy's features (its record is `e.def.raw`). */
export function applyEnemyFeatures(battle, e) {
  const record = e.def?.raw;
  if (!record?.abilities) return;
  for (const id of recordFeatureIds(record)) {
    const trait = ENEMY_FEATURES[id]?.trait;
    if (!trait) continue;
    if (trait.flags) battle.addBuff(e, { key: `feature:${id}`, persist: true, flags: { ...trait.flags } });
    if (trait.maxTargets) (e.profile ??= {}).maxTargets = Math.max(e.profile.maxTargets ?? 1, trait.maxTargets);
  }
}

/** Apply feature traits to every enemy this battle spawns. */
export function installEnemyFeatures(battle) {
  if (battle.regularEnemyFeatures) return;
  battle.regularEnemyFeatures = true;
  battle.on('enemySpawn', ({ enemy }) => applyEnemyFeatures(battle, enemy));
}
