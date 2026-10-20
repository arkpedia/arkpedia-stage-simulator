// SPDX-License-Identifier: GPL-3.0-or-later
// Stage-agnostic enemy records: one compiler for every enemy at every database
// level, with a stage's overwrittenData applied the same way for any stage.
// Inputs are the pinned Global enemy_database rows and enemy_handbook_table
// entry; the output is the record shape server/sim/simdata.js normalizeEnemy
// reads. Field semantics follow tools/build-data.mjs buildEnemies (the
// Stronghold builder), minus its act-specific extras (battle effectiveness,
// band swaps, random attributes).
//
// Level rule: level 0 merged with the selected level (fields an entry defines
// replace the base). Four entries in the pinned database would differ under a
// cumulative 0..N merge; they are listed by enemyLevelRuleDivergences().

const DMG_MAP = Object.freeze({ PHYSIC: 'phys', MAGIC: 'arts', HEAL: 'heal', NO_DAMAGE: 'none', TRUE: 'true', ELEMENT: 'element' });
const RANKS = new Set(['NORMAL', 'ELITE', 'BOSS']);
const OTHER_IMMUNITIES = Object.freeze(['disarmedCombat', 'feared', 'palsy', 'attract', 'teleport', 'groundBound']);

/** Round away float noise; keep integers and huge values untouched. */
export function cleanNum(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return v;
  if (Number.isInteger(v) || Math.abs(v) >= 1e6) return v;
  return Math.round(v * 1e6) / 1e6;
}
/** A database field's value, or `dflt` when the field was never set (undefined with the C# zero value). */
export function fieldValue(f, dflt = null) {
  if (!f || typeof f !== 'object' || !('m_value' in f)) return dflt;
  const v = f.m_value;
  if (f.m_defined === false && (v == null || v === 0 || v === false || v === '')) return dflt;
  return v;
}
/** Overlay the fields an override defines (m_defined) onto a base enemyData (new object). */
export function mergeEnemyData(base, over) {
  if (!over) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && 'm_defined' in v) { if (v.m_defined) out[k] = v; continue; }
    if (k === 'attributes' && v && typeof v === 'object') { out.attributes = mergeEnemyData(base.attributes || {}, v); continue; }
    if ((k === 'talentBlackboard' || k === 'skills' || k === 'spData') && v != null) out[k] = v;
  }
  return out;
}
/** [{key,value,valueStr}] → { bb, bbStr }; duplicate keys get _1, _2… suffixes. */
export function flattenBlackboard(list) {
  const bb = {}, bbStr = {};
  for (const e of Array.isArray(list) ? list : []) {
    if (!e || typeof e.key !== 'string') continue;
    let k = e.key;
    const taken = x => Object.hasOwn(bb, x) || Object.hasOwn(bbStr, x);
    if (taken(k)) { let i = 1; while (taken(`${e.key}_${i}`)) i++; k = `${e.key}_${i}`; }
    const num = cleanNum(typeof e.value === 'number' ? e.value : Number(e.value) || 0);
    const hasStr = e.valueStr != null && e.valueStr !== '';
    if (!hasStr || num !== 0) bb[k] = num;
    if (hasStr) bbStr[k] = String(e.valueStr);
  }
  return { bb, bbStr };
}
/** A MELEE enemy only hits its blocker, so its normal-attack radius is 0 (the raw value is kept separately). */
export function effectiveRangeRadius(applyWay, raw) {
  if (applyWay === 'MELEE' || typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, raw);
}
function skillsOf(list) {
  return (Array.isArray(list) ? list : []).map(sk => {
    const { bb, bbStr } = flattenBlackboard(sk.blackboard);
    return { prefabKey: sk.prefabKey, priority: sk.priority, cooldown: sk.cooldown, initCooldown: sk.initCooldown, spCost: sk.spCost, bb, bbStr };
  });
}
/** Talent groups an enemy uses: "group.param" keys grouped by their group name. */
export function talentGroups(bb) {
  const groups = {};
  for (const key of Object.keys(bb ?? {})) {
    const dot = key.indexOf('.'), group = dot > 0 ? key.slice(0, dot) : key;
    (groups[group] ??= []).push(dot > 0 ? key.slice(dot + 1) : '');
  }
  for (const g of Object.values(groups)) g.sort();
  return groups;
}

/**
 * Compile one enemy.
 * @param {{key: string, rows: {level:number, enemyData:object}[], handbook?: object|null, level?: number, overwrittenData?: object|null}} input
 */
export function compileEnemy({ key, rows, handbook = null, level = 0, overwrittenData = null }) {
  if (!Array.isArray(rows) || !rows.length) throw Error(`Missing enemy_database rows: ${key}`);
  const base = rows.find(r => r.level === 0)?.enemyData ?? rows[0].enemyData;
  const lv = level > 0 ? rows.find(r => r.level === level) : null;
  if (level > 0 && !lv) throw Error(`Missing enemy_database level ${level}: ${key}`);
  let data = lv ? mergeEnemyData(base, lv.enemyData) : base;
  if (overwrittenData) data = mergeEnemyData(data, overwrittenData);
  const at = data.attributes || {};
  const applyWay = fieldValue(data.applyWay, 'NONE');
  const dmgTypes = (handbook?.damageType || []).map(d => DMG_MAP[d] || String(d).toLowerCase());
  const dmgType = dmgTypes[0] || (applyWay === 'NONE' ? 'none' : 'phys');
  const rank = fieldValue(data.levelType, 'NORMAL');
  if (!RANKS.has(rank)) throw Error(`Unsupported enemy rank: ${key}:${rank}`);
  const rawRangeRadius = cleanNum(fieldValue(data.rangeRadius, 0));
  const stats = {
    maxHp: fieldValue(at.maxHp, 0), atk: fieldValue(at.atk, 0), def: fieldValue(at.def, 0), res: cleanNum(fieldValue(at.magicResistance, 0)),
    moveSpeed: cleanNum(fieldValue(at.moveSpeed, 1)), bat: cleanNum(fieldValue(at.baseAttackTime, 1)), aspd: cleanNum(fieldValue(at.attackSpeed, 100)),
    rangeRadius: effectiveRangeRadius(applyWay, rawRangeRadius), rawRangeRadius,
    blockCnt: at.blockCnt?.m_defined ? at.blockCnt.m_value : 1,
    massLevel: fieldValue(at.massLevel, 0), lpr: fieldValue(data.lifePointReduce, 1),
    hpRecoveryPerSec: cleanNum(fieldValue(at.hpRecoveryPerSec, 0)),
    elementRes: cleanNum(fieldValue(at.epResistance, 0)), elementDmgRes: cleanNum(fieldValue(at.epDamageResistance, 0)),
    hitRatePhys: cleanNum(fieldValue(at.damageHitratePhysical, 0)), hitRateArts: cleanNum(fieldValue(at.damageHitrateMagical, 0)),
    dmgType, dmgTypes, motion: fieldValue(data.motion, 'WALK'),
    immunities: {
      stun: !!fieldValue(at.stunImmune, false), silence: !!fieldValue(at.silenceImmune, false), sleep: !!fieldValue(at.sleepImmune, false),
      frozen: !!fieldValue(at.frozenImmune, false), levitate: !!fieldValue(at.levitateImmune, false),
    },
    otherImmunities: OTHER_IMMUNITIES.filter(k => !!fieldValue(at[`${k}Immune`], false)),
    tauntLevel: fieldValue(at.tauntLevel, 0),
  };
  const talents = flattenBlackboard(data.talentBlackboard);
  const prefabKey = fieldValue(data.prefabKey) || key;
  return {
    key, prefabKey, name: fieldValue(data.name) || handbook?.name || key, level, rank, applyWay, stats,
    abilities: (handbook?.abilityList || []).map(a => ({ text: a.text, format: a.textFormat || 'NORMAL' })),
    talents: { bb: talents.bb, bbStr: talents.bbStr, groups: talentGroups(talents.bb) },
    skills: skillsOf(data.skills),
    ...(data.spData ? { sp: { type: data.spData.spType ?? null, maxSp: data.spData.maxSp ?? 0, initSp: data.spData.initSp ?? 0, increment: data.spData.increment ?? 0 } } : {}),
    notCountInTotal: !!fieldValue(data.notCountInTotal, false),
    tags: fieldValue(data.enemyTags) || [],
  };
}

/** Features an enemy record uses: talent groups and skill prefab keys, each with its exact parameter-key signature. */
export function enemyFeatures(record) {
  const out = [];
  for (const [group, params] of Object.entries(record.talents.groups)) out.push({ kind: 'talent', name: group, signature: params.join(',') });
  for (const s of record.skills) out.push({ kind: 'skill', name: s.prefabKey, signature: Object.keys({ ...s.bb, ...s.bbStr }).sort().join(',') });
  return out;
}

/** Index the Global enemy_database list by key. */
export function indexEnemyDatabase(database) {
  const list = database?.enemies;
  if (!Array.isArray(list)) throw Error('Unsupported enemy_database shape');
  return new Map(list.map(e => [e.Key, e.Value]));
}

/** Entries whose fields differ between the base+level rule and a cumulative 0..N merge. */
export function enemyLevelRuleDivergences(index) {
  const defined = ed => {
    const out = {};
    for (const [k, v] of Object.entries(ed)) {
      if (v && typeof v === 'object' && 'm_defined' in v) { if (v.m_defined) out[k] = JSON.stringify(v.m_value); }
      else if (k === 'attributes') for (const [a, av] of Object.entries(v)) { if (av.m_defined) out[`attributes.${a}`] = JSON.stringify(av.m_value); }
      else if ((k === 'talentBlackboard' || k === 'skills' || k === 'spData') && v != null) out[k] = JSON.stringify(v);
    }
    return out;
  };
  const out = [];
  for (const [key, rows] of index) {
    const sorted = [...rows].sort((a, b) => a.level - b.level);
    for (let n = 2; n < sorted.length; n++) {
      const cumulative = Object.assign({}, ...sorted.slice(0, n + 1).map(r => defined(r.enemyData)));
      const pair = { ...defined(sorted[0].enemyData), ...defined(sorted[n].enemyData) };
      const fields = Object.keys(cumulative).filter(k => cumulative[k] !== pair[k]);
      if (fields.length) out.push({ key, level: sorted[n].level, fields });
    }
  }
  return out;
}
