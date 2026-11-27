// SPDX-License-Identifier: GPL-3.0-or-later
// 14-18: the Kindling Revenant's beam system `env_v050_mainline14_lrdeadP2Ctrl` (its rule, damage and reach) and the
// identities the battle needs. The mechanism is described in stage-kindling-revenant.js, which reviews the devices; this
// file reads no device evidence, so the battle may import it.
import environments from '../../data/arkpedia-environment-native-source.json' with { type: 'json' };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const REVENANT_SYSTEM = 'env_v050_mainline14_lrdeadP2Ctrl';
/** The first form (the controller in the cores; it is the wave's enemy) and the second form (summoned by the first). */
export const REVENANT_FIRST = 'enemy_1553_lrdead_2', REVENANT_SECOND = 'enemy_1553_lrdead';
export const SOUL_MAELSTROM = 'enemy_1428_lrsoul';

export function revenantSystemNativeReviewed(e = environments) {
  const rows = (e.envSystems?.[REVENANT_SYSTEM] ?? []).map(r => r.data), c = rows.find(r => '_markBuffKey' in r);
  return rows.length === 2 && rows[0]._sideType === 2 && same(rows[0]._blackboard, [])
    && c?._markBuffKey === 'enemy_lrdead[p2_mark]' && c._excludeBuffKey === 'enemy_lrking[mark][p1]' && c._row === 5
    && c._enemyEffectKeys?.length === 3 && c._allyEffectKeys?.length === 3;
}

const BEAM_KEYS = ['key', 'difs', 'offsets', 'enemy_eff_start_col', 'ally_eff_start_col', 'base_enemy_atk', 'base_ally_atk',
  'bound_ally_atk', 'bound_enemy_atk', 'atk_scale_to_boss', 'dmg_interval', 'ally_atk_step', 'enemy_atk_step'];
/** The level's `env_system_new` rune for the beam system. Only 14-18's reviewed values are accepted (H14-3's differ). */
export function compileRevenantBeamRule(rune) {
  const bb = rune?.blackboard ?? [], get = k => bb.find(x => x.key === k);
  const list = k => String(get(k)?.valueStr ?? '').split('|').map(Number), n = k => get(k)?.valueStr == null ? get(k)?.value : NaN;
  const rule = { enemyStartCol: n('enemy_eff_start_col'), allyStartCol: n('ally_eff_start_col'), difs: list('difs'), offsets: list('offsets'),
    enemy: { base: n('base_enemy_atk'), step: n('enemy_atk_step'), bound: n('bound_enemy_atk') },
    ally: { base: n('base_ally_atk'), step: n('ally_atk_step'), bound: n('bound_ally_atk') },
    bossScale: n('atk_scale_to_boss'), interval: n('dmg_interval'), rows: 5 };
  if (!revenantSystemNativeReviewed() || !same(bb.map(x => x.key), BEAM_KEYS) || get('key').valueStr !== REVENANT_SYSTEM
    || !same(rule, { enemyStartCol: 4, allyStartCol: 11, difs: [0, 1, 2, 3, 4, 5, 6], offsets: [1, 2, 3, 4, 5, 6, 7],
      enemy: { base: 150, step: 25, bound: 400 }, ally: { base: 150, step: 25, bound: 400 }, bossScale: 100, interval: 1, rows: 5 }))
    throw Error('Unsupported Kindling Revenant beam rule');
  return rule;
}

/** Damage of one side's beams per tick at `energy` (>= 1). */
export const revenantBeamDamage = (side, energy) => Math.min(side.bound, side.base + side.step * (energy - 1));

/** Where the beams reach [inference, see the header]. Columns are inclusive; `null` means that side covers nothing.
 * `bossHit`: the gold beams reach the Revenant. */
export function revenantBeamReach(rule, enemyEnergy, allyEnergy, gold) {
  const first = rule.enemyStartCol, last = rule.allyStartCol - 1;
  if (!gold) return { red: enemyEnergy > 0 ? [first, last] : null, gold: null, bossHit: false };
  const d = Math.max(rule.difs[0], Math.min(rule.difs.at(-1), allyEnergy - enemyEnergy));
  const cross = Math.max(first, rule.allyStartCol - rule.offsets[rule.difs.indexOf(d)]);
  return { red: cross > first ? [first, cross - 1] : null, gold: [cross, last], bossHit: d === rule.difs.at(-1) };
}
