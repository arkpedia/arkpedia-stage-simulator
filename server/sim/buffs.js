// server/sim/buffs.js — Buff model, mod keys, status catalogue and immunities (DESIGN §5.3).
//
// Buff = { key, source, duration (s, Infinity), timeLeft, stacks, maxStacks, refresh, mods, flags, onTick,
//          interval, onExpire, onRemove, tags[], shield, shieldHits, persist, status, visible }
// refresh: 'replace' (default: new instance replaces the old one), 'extend' (keep the longer remaining time,
// take the new mods), 'stack' (stacks+1 up to maxStacks, timer reset), 'independent' (separate instances with
// their own timers, at most maxStacks alive — the oldest is dropped), 'keep' (ignore when already present).
// Additive mod keys scale with stacks (value × stacks); *Mul keys multiply (value ^ stacks).

import { COLD_ASPD, COLD_FREEZE_DURATION, FREEZE_RES_DOWN, RESIST_DEFAULT } from './constants.js';

/** Additive mod keys (summed; × stacks). */
export const ADD_KEYS = Object.freeze([
  'atkFlat', 'atkFinalFlat', 'atkPct', 'defFlat', 'defFinalFlat', 'defPct', 'hpFlat', 'hpFinalFlat', 'hpPct', 'resFlat', 'resPct', 'aspd', 'batFlat', 'batPct', 'blockCnt',
  'rangeExtend', 'defIgnoreFlat', 'defIgnorePct', 'resIgnoreFlat', 'resIgnorePct', 'dodgePhys', 'dodgeArts',
  'spRecoveryFlat', 'maxTargets', 'taunt', 'hpRegen', 'hpRegenRatio', 'spCostFlat', 'moveFlat', 'movePct', 'massFlat',
  'flatDamageResistance', 'damageHpFloorRatio',
]);
/** Multiplicative mod keys (product; ^ stacks). */
export const MUL_KEYS = Object.freeze([
  'atkMul', 'defMul', 'hpMul', 'resMul', 'moveMul', 'dmgDealtMul', 'dmgTakenMul', 'physTakenMul', 'artsTakenMul',
  'trueTakenMul', 'elemTakenMul', 'elementalTakenMul', 'healingDealtMul', 'healingTakenMul', 'spRecoveryMul', 'redeployMul',
  'atkScaleMul', 'physDealtMul', 'artsDealtMul', 'blockCntMul', 'batMul', 'hpRegenMul',
]);
/**
 * Boolean flag keys (OR). `taunt` is also accepted as a numeric mod. `liftoff` = 起飞 of an ally (蒂比's skills): blocks
 * no ground enemy (Battle._blockerFor), 对地规避 against ground enemies (targeting.js evadesGround); it stays a ground
 * unit on its tile (`unit.ground` unchanged). `noHeal` = no heal from another unit (and no heal pick of one); `healFree`
 * = 禁疗 that also stops the unit's own heals (damage.js heal: only an HP-regen attribute and a heal that "无视禁疗" pass —
 * 史尔特尔's 余烬, which sets both). `stealthOff` = an enemy 隐匿 source switched off after a block (Battle._stealthSwitch).
 */
export const FLAG_KEYS = Object.freeze([
  'stun', 'freeze', 'sleep', 'silence', 'disarm', 'stealth', 'invulnerable', 'unblockable', 'levitate', 'fear',
  'cold', 'reveal', 'bind', 'noHeal', 'untargetable', 'blockFly', 'noMove', 'noSp', 'burstLock', 'hidden',
  'noBlock', 'tremble', 'hitCount', 'hitCountArts', 'attract', 'float', 'noDisplace', 'isolated', 'camou', 'liftoff',
  // 自缚 (the unit's own immobility: 守墓石像's 转换模式, the 自缚 leaders) beside its `noMove` — 束缚 sets noMove too, and
  // only 自缚 makes a unit "不视为可达目标" for 余 S2's teleport (PRTS 余 S2 备注)
  'selfBound', 'healFree', 'stealthOff', 'undeadable',
]);

/**
 * Status catalogue: key → template. `value` semantics per status are documented inline. Effects follow the official
 * term table (gamedata_const termDescriptionDict, ba.*). `valued: default` marks "同名效果取最高" statuses: a weaker
 * application never overrides a stronger running one (it resumes if it outlasts it) — see Battle.applyStatus.
 * Content applies statuses with `battle.applyStatus(target, key, { duration, source, value })`.
 */
export const STATUS = Object.freeze({
  // 晕眩: 无法移动、阻挡、攻击及使用技能 (a stunned operator releases the enemies it blocks)
  stun: { flags: { stun: true, noBlock: true }, immune: 'stun' },
  // 冻结: 无法移动、攻击及使用技能; 敌方被冻结时，法术抗性-15 (the RES cut applies to enemies only)
  freeze: { flags: { freeze: true, stun: true }, mods: { resFlat: -FREEZE_RES_DOWN }, enemyOnlyMods: true, immune: 'frozen' },
  // 寒冷: ASPD −30. A second cold while this one remains applies 冻结 for max(remaining, incoming)
  // (Battle.applyStatus; PRTS 术语释义 寒冷 「持续时间取双方之中最高」).
  cold: { flags: { cold: true }, mods: { aspd: COLD_ASPD } },
  // 沉睡: 无敌且无法行动 (untargetable, takes no damage — except from `hitSleep` attackers — and blocks nothing)
  sleep: { flags: { sleep: true, noBlock: true }, immune: 'sleep' },
  // value = fraction of speed removed (0.8 ⇒ moveMul 0.2). Default 0.5.
  slow: { mods: (v) => ({ moveMul: 1 - clamp01(v ?? 0.5) }), valued: 0.5 },
  // 停顿 (sluggish): −80 % move speed.
  sluggish: { mods: { moveMul: 0.2 } },
  bind: { flags: { bind: true, noMove: true }, mods: { moveMul: 0 } },
  // value = extra damage taken (0.3 ⇒ ×1.3). Default 0.3.
  fragile: { mods: (v) => ({ dmgTakenMul: 1 + (v ?? 0.3) }), valued: 0.3 },
  artsFragile: { mods: (v) => ({ artsTakenMul: 1 + (v ?? 0.3) }), valued: 0.3 },
  physFragile: { mods: (v) => ({ physTakenMul: 1 + (v ?? 0.3) }), valued: 0.3 },
  // Source damage_resistance: PHYSICAL_AND_MAGICAL, isOneMinus and nonstacking.
  // Owned instances choose the strongest value per damage type. True damage
  // bypasses ordinary Sanctuary; includePure explicitly opts into that channel.
  // Direct HP loss always bypasses it.
  sanctuary: { mods: (v) => ({ physTakenMul: 1 - clamp01(v ?? 0.2),
    artsTakenMul: 1 - clamp01(v ?? 0.2) }), valued: 0.2 },
  // Source peak_performance / ba.strong: owned Vigor ATK percentages take
  // the strongest active value and fall back when that source expires.
  vigor: { mods: (v) => ({ atkPct: v ?? 0 }), valued: 0 },
  // Source ba.weightless: named Weightless instances do not stack; unrelated
  // mass modifiers remain additive for displacement/Levitate calculations.
  weightless: { mods: (v) => ({ massFlat: -Math.max(0, v ?? 1) }), valued: 1 },
  // 元素脆弱 (ba.elementfragile "受到的元素伤害提升相应比例（同名效果取最高）"): 元素伤害 (the 'elemental' HP damage) only —
  // never the element gauge (元素损伤 has its own multiplier, `elemTakenMul`; damage.js)
  elemFragile: { mods: (v) => ({ elementalTakenMul: 1 + (v ?? 0.2) }), valued: 0.2 },
  silence: { flags: { silence: true }, immune: 'silence' },
  // 恐惧: 无法被阻挡并四散逃跑 (no attacks, unblockable; leaves its route and runs to random tiles of the fan away from the
  // source — fear.js, stamped by Battle.applyStatus)
  fear: { flags: { fear: true, unblockable: true }, immune: 'feared' },
  // 战栗: 被阻挡后无法进行普通攻击
  tremble: { flags: { tremble: true }, immune: 'feared' },
  disarm: { flags: { disarm: true } },
  // 隐匿 (ba.invisible): 不阻挡时不成为敌方攻击的目标 (an ally: only the enemy it blocks attacks it — targeting.js)
  stealth: { flags: { stealth: true } },
  // 迷彩 (ba.camou): "不阻挡时不成为敌方普通攻击的目标（无法躲避溅射类攻击）" — an ally's camouflage keeps the enemies off
  // it like 隐匿 (only the enemy it blocks attacks it: targeting.js canTargetAlly; shown the same way, snapshot.js), but
  // it is not 隐匿 (叙拉古 / 家族徽章 read `stealth` only) and has its own buff keys
  camou: { flags: { camou: true } },
  reveal: { flags: { reveal: true } },
  invulnerable: { flags: { invulnerable: true } },
  // 浮空: 变为空中单位 (Unit.isFlying)，无法移动、攻击及使用技能; 对重量大于3的单位持续时间减半; the state holds 不可阻挡 +
  // 失衡免疫 (noDisplace: "不会被位移影响", PRTS 异常效果)
  levitate: { flags: { levitate: true, stun: true, unblockable: true, noDisplace: true }, immune: 'levitate' },
  // 麻痹: value = stacks (default 1, max 3); each stack cancels one enemy normal attack; lasts until consumed; honours
  // 麻痹免疫 (enemy_database palsyImmune, e.g. 假想敌：铳 — PRTS 元素: a 神经 burst gives 麻痹 only "若单位不具有麻痹免疫")
  palsy: { palsy: true, immune: 'palsy' },
  // value = taunt level delta (default +1)
  taunt: { mods: (v) => ({ taunt: v ?? 1 }) },
  // value = ATK fraction removed (default 0.3)
  weaken: { mods: (v) => ({ atkMul: 1 - clamp01(v ?? 0.3) }), valued: 0.3 },
  // value = aspd delta (negative slows attacks), default −30
  aspdDown: { mods: (v) => ({ aspd: v ?? -30 }), valued: -30 },
  // value = DEF fraction removed (default 0.3)
  defDown: { mods: (v) => ({ defMul: 1 - clamp01(v ?? 0.3) }), valued: 0.3 },
  // value = RES flat removed (default 20)
  resDown: { mods: (v) => ({ resFlat: -(v ?? 20) }), valued: 20 },
  unblockable: { flags: { unblockable: true } },
  // 诱导 (ba.attract): 无法被阻挡并向目标位置移动 — the engine walks the enemy (own speed, grid path; flyers straight)
  // to `opts.point` (default: the source's tile) and keeps it there until the status ends, then it resumes its route
  attract: { flags: { attract: true, unblockable: true }, attract: true },
  // 抵抗 (ba.buffres): the RESIST_STATUSES applied to the unit last (1 − value) as long, value default 0.5 (减半);
  // 同名效果不叠加 — several sources never compound (strongest value wins, a weaker one resumes if it outlasts it);
  // a resisting unit also loses one 麻痹 stack every RESIST_PALSY_DECAY s (Battle.applyStatus)
  resist: { resist: true, mods: () => null, valued: RESIST_DEFAULT },
  // element burst states (engine-managed; listed for immunity/visibility)
  burnBurst: { flags: { burstLock: true } },
  neuralBurst: { flags: { burstLock: true } },
  necrosisBurst: { flags: { burstLock: true } },
  apoptosisBurst: { flags: { burstLock: true } },
  erosionBurst: { flags: { burstLock: true } },
});

/**
 * Control statuses (异常状态) shortened by 抵抗: 晕眩 冻结 寒冷 沉睡 恐惧 战栗 诱导 浮空 束缚 沉默 缴械 停顿 减速. The
 * official term lists 晕眩/寒冷/冻结/恐惧/诱导…; the rest follow the operator kits that grant 抵抗 [ASSUMED]. 麻痹 is
 * stack-based: it decays instead (RESIST_PALSY_DECAY).
 */
export const RESIST_STATUSES = Object.freeze(new Set(['stun', 'freeze', 'cold', 'sleep', 'fear', 'tremble', 'attract', 'levitate',
  'bind', 'silence', 'disarm', 'sluggish', 'slow']));

/** Statuses that should be reported to clients as `['status', id, key, on]`. */
export const VISIBLE_STATUS = new Set(Object.keys(STATUS));

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

let buffSeq = 0;

/** Normalise a buff descriptor (does not attach it). */
export function makeBuff(b) {
  const duration = b.duration == null ? Infinity : Number(b.duration);
  return {
    key: String(b.key ?? 'buff'),
    source: b.source ?? null,
    duration: Number.isFinite(duration) || duration === Infinity ? duration : Infinity,
    timeLeft: Number.isFinite(duration) || duration === Infinity ? duration : Infinity,
    stacks: Math.max(1, b.stacks ?? 1),
    maxStacks: Math.max(1, b.maxStacks ?? 1),
    refresh: b.refresh ?? 'replace',
    mods: b.mods ?? null,
    flags: b.flags ?? null,
    onTick: b.onTick ?? null,
    interval: b.interval ?? 0,
    _acc: 0,
    onExpire: b.onExpire ?? null,
    onRemove: b.onRemove ?? null,
    tags: b.tags ?? [],
    shield: b.shield ?? (b.mods && b.mods.shield) ?? 0,
    shieldHits: b.shieldHits ?? 0,
    // Explicit source barriers can accept only certain HP-damage kinds. Empty
    // or unknown type sets absorb nothing; absence preserves ordinary shields.
    shieldTypes: b.shieldTypes == null ? null : [...new Set(b.shieldTypes.filter(type =>
      ['phys', 'arts', 'true', 'elemental'].includes(type)))],
    // Source barriers may distinguish melee/ranged applications and attacker
    // side. These are independent filters; an omitted filter accepts all.
    shieldApplyWays: b.shieldApplyWays == null ? null : [...new Set(b.shieldApplyWays.filter(way =>
      ['melee', 'ranged', 'none'].includes(way)))],
    shieldSourceSides: b.shieldSourceSides == null ? null : [...new Set(b.shieldSourceSides.filter(side =>
      ['ally', 'enemy'].includes(side)))],
    persist: !!b.persist,
    status: b.status ?? null,
    // Native buff-table YES/NO overrides are distinct from the broader legacy
    // Resist catalogue. Absence means AUTOMATIC, interpreted by a reviewed kit.
    sourceStatusResistable: b.sourceStatusResistable ?? null,
    visible: b.visible ?? false,
    data: b.data ?? {},
    seq: ++buffSeq,
  };
}

/**
 * Compute aggregated modifiers of a buff list. Returns `{ add: {k: sum}, mul: {k: product}, flags: {k: bool}, shield,
 * permRangeExtend }` — permRangeExtend = the rangeExtend of persistent never-expiring buffs (talents, modules: part of
 * the initial range, Battle._refreshRange).
 */
export function aggregateMods(buffs) {
  const add = Object.create(null);
  const mul = Object.create(null);
  const flags = Object.create(null);
  let shield = 0;
  let permRangeExtend = 0;
  let sluggishMoveMul = 1;
  // dodge sources are independent rolls: total = 1 − Π(1 − p)^stacks (one single source keeps its exact value)
  const dodge = { dodgePhys: null, dodgeArts: null };
  // Source-owned valued statuses can be removed independently. Only the
  // strongest instance of a named status contributes its modifiers.
  const strongest = new Map();
  const sanctuary = Object.create(null);
  // Source Inspire channels choose the highest final addition independently
  // for ATK, DEF and MAX_HP. Keep owned weaker instances for expiry fallback;
  // unrelated final additions still sum normally.
  const inspire = Object.create(null);
  for (const b of buffs) {
    const tpl = STATUS[b.status];
    if (tpl?.valued == null) continue;
    if (b.status === 'sanctuary') continue;
    const value = Math.abs(b.data?.value ?? tpl.valued);
    const old = strongest.get(b.status);
    if (!old || value > Math.abs(old.data?.value ?? tpl.valued)) strongest.set(b.status, b);
  }
  for (let i = 0; i < buffs.length; i++) {
    const b = buffs[i];
    const st = b.stacks;
    const m = b.mods;
    if (m && (!strongest.has(b.status) || strongest.get(b.status) === b)) {
      for (const k in m) {
        const v = m[k];
        if (typeof v !== 'number' || !Number.isFinite(v)) continue;
        if (k === 'shield') continue;
        // Sluggish is one named status: overlapping zone/attack sources do
        // not compound -80% movement into -96% or erase each other's timers.
        if (b.status === 'sanctuary' && ['physTakenMul', 'artsTakenMul', 'trueTakenMul', 'elementalTakenMul'].includes(k))
          sanctuary[k] = Math.min(sanctuary[k] ?? 1, v);
        else if (b.tags?.includes('inspire') && ['atkFinalFlat', 'defFinalFlat', 'hpFinalFlat'].includes(k))
          inspire[k] = Math.max(inspire[k] ?? 0, v * st);
        else if (k === 'damageHpFloorRatio') add[k] = Math.max(add[k] ?? 0, v);
        else if (k === 'moveMul' && b.status === 'sluggish') sluggishMoveMul = Math.min(sluggishMoveMul, v);
        else if (k.endsWith('Mul')) mul[k] = (mul[k] ?? 1) * (st === 1 ? v : Math.pow(v, st));
        else if ((k === 'dodgePhys' || k === 'dodgeArts') && v > 0) {
          const p = Math.min(1, v);
          const d = dodge[k];
          if (!d) dodge[k] = { n: st, p, miss: Math.pow(1 - p, st) };
          else { d.n += st; d.miss *= Math.pow(1 - p, st); }
        } else {
          add[k] = (add[k] ?? 0) + v * st;
          if (k === 'rangeExtend' && b.persist && b.duration === Infinity) permRangeExtend += v * st;
        }
      }
    }
    if (b.flags) for (const k in b.flags) if (b.flags[k]) flags[k] = true;
    if (b.shield > 0) shield += b.shield;
  }
  // Apply after unrelated multipliers so Fragile composes independently of
  // source insertion order. Weaker owned channels resume after removal/expiry.
  for (const k of Object.keys(sanctuary)) mul[k] = (mul[k] ?? 1) * sanctuary[k];
  for (const k of Object.keys(inspire)) add[k] = (add[k] ?? 0) + inspire[k];
  for (const k of ['dodgePhys', 'dodgeArts']) {
    const d = dodge[k];
    if (d) add[k] = (add[k] ?? 0) + (d.n === 1 ? d.p : 1 - d.miss);
  }
  if (sluggishMoveMul !== 1) mul.moveMul = (mul.moveMul ?? 1) * sluggishMoveMul;
  return { add, mul, flags, shield, permRangeExtend };
}
