// SPDX-License-Identifier: GPL-3.0-or-later
// Shared Active Originium contact state, independent of legacy device setup.
export const INFECTION_BUFF='terrain:infection';

/** 活性源石's tick: true damage no unit deals (无来源), tagged 'terrain' = 环境伤害 ("受到来自自然环境的伤害" content reads it). */
const infectionDamage = (battle, amount) => (ctx) => {
  if (amount > 0 && ctx.unit.alive) battle.dealDamage(null, ctx.unit, { amount, type: 'true', canDodge: false, tags: ['terrain'] });
};

/**
 * 活性源石 contact (every tick on the tile). The tile gives a timed effect — damage true dmg/s, ATK + atk, ASPD +
 * attack_speed for `duration` s (PRTS 特殊地形 tile template: "部署于其上的我军和经过的敌军在{duration}s内每秒受到{damage}
 * 真实伤害，攻击力提升…，攻击速度增加…") — that stays on an enemy after it walks off: PRTS 危机合约 tag
 * global_tile_infection_1 「目标：可控感染」 "踏过活性源石地块的敌人不再持续损失生命值" switches the lasting HP loss off,
 * so without it the loss continues. One effect per unit (PRTS 作战机制: "同名buff的默认叠加策略buff只能表现出一个"): a
 * unit that already carries it gets its full `duration` back and keeps its per-second rhythm — no second effect, no
 * extra tick [ASSUMED: the time counts from the last contact — so an operator deployed on it, always in contact, drains
 * past `duration`]. An operator moved off the tile (Battle.relocate: 夕's 小自在 …; Battle.moveRedeploy: 乌尔比安 S3)
 * keeps it for its time; leaving the field drops it with every buff; a 重生 clears it (enemies.js rebirthCleanse: PRTS
 * 特殊机制 §重生 "清空自身身上除白名单外所有Buff") and contact gives it again while the unit is on the tile [ASSUMED]. The
 * tick (infectionDamage) is true damage no unit deals (无来源), tagged 'terrain' = 环境伤害 (PRTS 自然环境 lists 活性源石),
 * not 'dot' [ASSUMED: PRTS 伤害分类's list of BUFF damage does not name it].
 */
export function touchInfection(battle, st, u) {
  const I = st.infection;
  const key = INFECTION_BUFF;
  const b = u.findBuff(key);
  if (b) { if (b.timeLeft < I.duration) b.timeLeft = I.duration; return; }
  battle.addBuff(u, { key, duration: I.duration, mods: { atkPct: I.atk, aspd: I.aspd }, interval: 1, onTick: infectionDamage(battle, I.damage) });
}

