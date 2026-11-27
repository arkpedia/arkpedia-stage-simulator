// SPDX-License-Identifier: GPL-3.0-or-later
// Miner Guerrilla (`enemy_3010_mcreep`, PRTS 矿工游击队; chapter 16). A NEUTRAL route actor (`_sideTypeIndex` 2,
// `mark_neutral[effect]`): it opposes the enemy side, enemies that select ally units select it too, and it cannot be
// blocked. Reviewed from its pinned prefab and templates; clip clocks from
// data/arkpedia-miner-guerrilla-animations.json. Runtime: server/sim/content/arkpedia-enemy-miner-guerrilla.js.
// - Passive: `enemy_mcreep_self_mark` (taunt level -1), `enemy_mcreep_able_to_be_blocked` (the chapter's devices read
//   it), `mark_neutral[effect]`, and `mcreep_a[reach_exit]` (a log entry only: its exit costs nothing).
// - Attack: one ground unit of the opposing side within its radius (1.0), whether selectable or not; Physical.
// - GetHeal `mcreep_t[get_heal]`, every 1 s, for each deployed Medic: if it is not at full HP and its tile is in that
//   Medic's attack range, it is healed for `heal_scale` x that Medic's ATK.
// - FearLoseBlood `mcreep_t[fear_listener]` (checked every 0.3 s): while it has `fear`, `mcreep_t[fear_blood]`
//   deals `value` true damage every 1 s.
// - TileEscapeShadowManager `mcreep_t[work_espace_shadow]`, every 0.3 s while not feared:
//   Main16ChangeTileShadowViaRange `x-4` (its tile and the eight around it) are cleared of pollution for a while
//   (PRTS: 3 s, refreshed). The chapter's pollution is not built yet; the parameters are carried.
import clocks from '../../data/arkpedia-miner-guerrilla-animations.json' with { type: 'json' };

export const MINER_GUERRILLA = 'enemy_3010_mcreep', NEUTRAL_MARK = 'mark_neutral[effect]';
const TEXT = '友方单位，在医疗干员攻击范围内可恢复生命';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0] ?? a?.$type;
const types = list => (list ?? []).map(type).join();
const anim = clocks.enemies[MINER_GUERRILLA];
export const isMinerGuerrilla = r => r?.prefabKey === MINER_GUERRILLA && r.key === MINER_GUERRILLA;

export function minerGuerrillaNative(r, n) {
  const bb = r?.talents?.bb ?? {};
  if (!isMinerGuerrilla(r) || r.stats.motion !== 'WALK' || r.stats.rawRangeRadius !== 1 || r.stats.lpr !== 0 || r.skills.length
    || !same(Object.keys(bb).sort(), ['FearLoseBlood.value', 'GetHeal.heal_scale', 'TileEscapeShadowManager.times'])
    || !(bb['GetHeal.heal_scale'] > 0) || !(bb['FearLoseBlood.value'] > 0) || !(bb['TileEscapeShadowManager.times'] > 0)) return false;
  const T = k => n?.$template?.(k)?.eventToActions, root = n?.[MINER_GUERRILLA]?.[0];
  const buffs = name => (n?.[name] ?? []).flatMap(c => c._buffs ?? []), passive = buffs('Passive');
  const heal = buffs('GetHeal')[0], healer = n?.$ref?.((n?.GetHeal ?? [])[0]?._targetValidator)?._targetOptions;
  const fear = buffs('FearLoseBlood')[0], clear = buffs('TileEscapeShadowManager')[0];
  const attack = (n?.Attack ?? [])[0], trigger = n?.$ref?.((n?.Default ?? [])[0]?._attackTrigger);
  const selector = (trigger ? n.$siblings(trigger) : []).find(c => '_targetSide' in c);
  const healSteps = T('mcreep_t[get_heal]')?.ON_BUFF_TRIGGER, listen = T('mcreep_t[fear_listener]')?.ON_BUFF_TRIGGER?.[0];
  const blood = T('mcreep_t[fear_blood]')?.ON_BUFF_TRIGGER, work = T('mcreep_t[work_espace_shadow]')?.ON_BUFF_TRIGGER?.[0];
  return !!root && root._sideTypeIndex === 2 && root._modes?.length === 1
    && same(passive.map(b => b.buffKey), ['enemy_mcreep_self_mark', 'enemy_mcreep_able_to_be_blocked', NEUTRAL_MARK, 'mcreep_a[reach_exit]'])
    && same(passive[0].attributes?.attributeModifiers?.map(m => [m.attributeType, m.formulaItem, m.value]), [[20, 0, -1]])
    && type(T('mcreep_a[reach_exit]')?.ON_OWNER_REACH_EXIT?.[0]) === 'LogExtraBattleInfo'
    && attack?._animKey === 'Attack' && attack._damageType === 1 && !attack._projectileKey
    && selector?._targetSide === 2 && selector._targetMotion === 1 && selector._targetCategory === 1 && selector._ignoreTargetFree === 1 && selector._maxNum === 1
    && heal?.templateKey === 'mcreep_t[get_heal]' && heal.triggerInterval === 1 && healer?.professionMask === 8
    && types(healSteps) === 'FilterByTargetHpRatio,CheckUnitRootTileInTargetAttackRange,AssignAttributeToBB,FixedValueHeal,CreateBuff'
    && healSteps[0]._condType === 'LT' && healSteps[0]._value === 1 && healSteps[2]._attributeType === 'ATK'
    && fear?.templateKey === 'mcreep_t[fear_listener]' && Math.abs(fear.triggerInterval - .3) < 1e-6
    && type(listen) === 'IfElse' && same(listen._conditionNode?._buffKeys, ['fear'])
    && listen._succeedNodes?.at(-1)?._buff?.templateKey === 'mcreep_t[fear_blood]' && listen._succeedNodes.at(-1)._buff.triggerInterval === 1
    && type(blood?.at(-1)) === 'FixedValueDamage' && blood.at(-1)._damageType === 'PURE' && blood.at(-1)._damageKey === 'value'
    && clear?.templateKey === 'mcreep_t[work_espace_shadow]' && Math.abs(clear.triggerInterval - .3) < 1e-6
    && type(work) === 'IfElse' && type(work._failNodes?.at(-1)) === 'Main16ChangeTileShadowViaRange' && work._failNodes.at(-1)._rangeId === 'x-4'
    && same(work._failNodes[0]._buffKeys, ['fear'])
    && Math.abs(anim.durations.Attack - 1.5333) < .01 && Math.abs(anim.events.Attack[0].time - .5667) < .01;
}

export function minerGuerrillaParams(r) {
  const bb = r.talents.bb;
  return { mark: NEUTRAL_MARK, radius: r.stats.rawRangeRadius, attack: { dur: anim.durations.Attack, hit: anim.events.Attack.find(e => e.name === 'OnAttack').time },
    heal: { interval: 1, scale: bb['GetHeal.heal_scale'] }, fear: { interval: 1, damage: bb['FearLoseBlood.value'] },
    clear: { interval: .3, duration: bb['TileEscapeShadowManager.times'], range: 'x-4' } };
}

const miner = (note, extra = {}) => ({ matchesRecord: isMinerGuerrilla, covers: minerGuerrillaNative, ability: null, note, ...extra });
export const MINER_GUERRILLA_FEATURES = Object.freeze({
  'talent:GetHeal': miner('Miner Guerrilla: a neutral route actor that strikes enemies in reach and is healed by Medics in range', {
    unitProperties: { side: 'neutral' }, nativeClaim: () => ({ active: 1 }), explains: text => text === TEXT,
    ability: r => ({ kind: 'minerGuerrilla', params: () => minerGuerrillaParams(r) }) }),
  'talent:FearLoseBlood': miner('true damage each second while feared (kind minerGuerrilla)'),
  'talent:TileEscapeShadowManager': miner('clears pollution around itself (kind minerGuerrilla; the pollution is not built yet)'),
});
