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

/** The group's parameter keys are exactly `params`. */
const sig = (r, g, params) => JSON.stringify(r.talents.groups[g] ?? null) === JSON.stringify([...params].sort());
const ELEMENT_TERMS = Object.freeze({ 'ba.dt.neural': 'neural', 'ba.dt.burning': 'burn', 'ba.dt.apoptosis': 'apoptosis', 'ba.dt.erosion': 'erosion' });
/** The one element an enemy's handbook lines name (null when none or several). */
export function elementOf(r) {
  const found = new Set(r.abilities.flatMap(a => [...a.text.matchAll(/<\$(ba\.dt\.[a-z]+)>/g)].map(m => ELEMENT_TERMS[m[1]]).filter(Boolean)));
  return found.size === 1 ? [...found][0] : null;
}
/** One feature per spelling of a talent group with an exact parameter signature. */
function family(groups, params, ability, extra, note, dependsOn = null, explains = null) {
  return Object.fromEntries(groups.map(g => [`talent:${g}`, { covers: r => sig(r, g, params) && extra(r), ability: ability(g), note,
    ...(dependsOn ? { dependsOn } : {}), ...(explains ? { explains } : {}) }]));
}
const REBORN_PARAMS = new Set(['duration', 'hp_ratio', 'invincible']);
function rebornFamily(group) {
  return { [`talent:${group}`]: {
    covers: r => r.talents.groups[group].includes('duration') && r.talents.groups[group].every(p => REBORN_PARAMS.has(p)),
    ability: { kind: 'reborn', params: r => ({ dur: r.talents.bb[`${group}.duration`], hpRatio: r.talents.bb[`${group}.hp_ratio`] ?? 1,
      invincible: r.talents.bb[`${group}.invincible`] ?? 0 }) },
    note: 'reborn(): first KO → rebirth of duration s, then hp_ratio of max HP and invincible s', explains: /^Rebirth$/ } };
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
  // 持续损失生命: `damage` HP lost every second (PRTS "自身每秒损失生命值").
  'talent:periodic_damage': { covers: r => sig(r, 'periodic_damage', ['damage']), ability: { kind: 'periodicLoss', params: r => ({ amount: r.talents.bb['periodic_damage.damage'] }) },
    note: 'loses damage HP every second', explains: /^(Will gradually lose HP over time)$/ },
  // 折射 (ba.refraction): RES +magic_resistance while not silenced.
  ...family(['refracting'], ['magic_resistance'], g => ({ kind: 'refraction', params: r => ({ res: r.talents.bb[`${g}.magic_resistance`] }) }),
    r => r.abilities.some(a => a.text.includes('<$ba.refraction>')), 'RES +magic_resistance while not silenced', null, /^<\$ba\.refraction>Refraction<\/>$/),
  // "Gains significantly increased ATK when HP is under 50%": ATK +atk once HP first drops below half.
  ...family(['atkup'], ['atk'], g => ({ kind: 'lowHpBuff', params: r => ({ ratio: 0.5, mods: { atkPct: r.talents.bb[`${g}.atk`] } }) }),
    r => r.abilities.some(a => /under 50%/.test(a.text) && /ATK/.test(a.text)), 'ATK +atk below 50% HP (ratio from the handbook line)', null,
    /^Gains significantly increased ATK when HP is under 50%$/),
  // Element damage on every attack hit: ATK x attack@ep_damage_ratio of the element its handbook line names.
  ...family(['epdamage', 'EpDamage'], ['attack@ep_damage_ratio'], g => ({ kind: 'elementOnHit', params: r => ({ element: elementOf(r), ratio: r.talents.bb[`${g}.attack@ep_damage_ratio`] }) }),
    r => !!elementOf(r), 'element damage on every attack hit', null,
    /^(Every attack deals|Attacks inflict additional|Attacks deal) <\$ba\.dt\.(erosion|neural|apoptosis|burning)>[^<]*<\/>\.?$/),
  // "Spawns N <X> when defeated": cnt enemy_key on death; supported only when the spawned enemy is.
  ...family(['DeadSpawn'], ['cnt', 'enemy_key'], g => ({ kind: 'deathSpawn', params: r => ({ key: r.talents.bbStr[`${g}.enemy_key`], cnt: r.talents.bb[`${g}.cnt`] }) }),
    r => true, 'spawns cnt enemy_key when killed', r => Object.entries(r.talents.bbStr).filter(([k]) => /^deadspawn\.enemy_key$/i.test(k)).map(([, v]) => v),
    /^Spawns \d+ <[^>]+> when defeated$/),
  'ability:Attacks 2 targets simultaneously': { covers: r => r.applyWay === 'RANGED' && r.stats.rangeRadius > 0, trait: { maxTargets: 2 }, note: 'two ranged targets per attack' },
});

/** Ability lines that carry a number: matched by pattern, then checked against the record. */
export const ENEMY_FEATURE_PATTERNS = Object.freeze([
  // 频次 ("Must be damaged N times to defeat"): N hits; the record's max HP is N.
  { re: /^Must be damaged (\d+) times to defeat$/, make: m => ({ covers: r => r.stats.maxHp === Number(m[1]), ability: { kind: 'times', params: () => ({ artsOnly: false }) },
    note: 'hit count equal to max HP' }) },
  { re: /^Must be damaged (\d+) times by Arts or True damage to defeat$/, make: m => ({ covers: r => r.stats.maxHp === Number(m[1]),
    ability: { kind: 'times', params: () => ({ artsOnly: true }) }, note: 'Arts/True hit count equal to max HP' }) },
  // "Can only be blocked by units with at least N Block": block weight N.
  { re: /^Can only be blocked by units with at least (\d+) Block$/, make: m => ({ covers: () => true, ability: { kind: 'blockWeight', params: () => ({ n: Number(m[1]) }) },
    note: 'block weight N' }) },
]);
/** The registered feature for an id, exact or by pattern. */
export function enemyFeature(id) {
  if (Object.hasOwn(ENEMY_FEATURES, id)) return ENEMY_FEATURES[id];
  if (!id.startsWith('ability:')) return null;
  const text = id.slice('ability:'.length);
  for (const p of ENEMY_FEATURE_PATTERNS) { const m = text.match(p.re); if (m) return p.make(m); }
  return null;
}

/** The features one compiled record uses. */
export function recordFeatureIds(record) {
  return [...new Set([
    ...record.abilities.map(a => `ability:${a.text}`),
    ...Object.keys(record.talents.groups).map(g => `talent:${g}`),
    ...record.skills.map(s => `skill:${s.prefabKey}`),
  ])];
}
