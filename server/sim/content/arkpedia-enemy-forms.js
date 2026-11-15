// SPDX-License-Identifier: GPL-3.0-or-later
// Shared form transitions; no concrete enemy catalog.
import {num,safe} from './arkpedia-enemy-ability-runtime.js';
import {INFECTION_BUFF} from './terrain-infection.js';
/** 重生 of a Revive[Trigger] knock-out before its husk (PRTS 深池逐火战士 and 假想敌：再生 天赋: "被击倒后重生，持续1s，随后变为
 *  怨恨的余烬 / 再生状态，1s内不移动且持有无敌+无法阻挡+失衡免疫"; both models' knock-out clips last 1 s). */
export const HUSK_REBIRTH = 1;

/** Set a 频次 unit's hits (maxHp := hits, full). */
export function setHits(e, n) {
  const h = Math.max(1, Math.round(n));
  e.base.maxHp = h;
  e.markDirty();
  void e.s;
  e.hp = h;
}

const HIT_COUNT_KEY = 'ab:hitCount';
/** 频次 on/off: every damage instance removes exactly 1 HP (engine flag; `artsOnly` = 茶器, physical instances remove 0). */
export function hitCount(b, e, on, artsOnly = false) {
  if (!on) { b.removeBuff(e, HIT_COUNT_KEY); return; }
  b.addBuff(e, { key: HIT_COUNT_KEY, persist: true, flags: artsOnly ? { hitCountArts: true } : { hitCount: true } });
}
export const isHitCount = (e) => !!e.findBuff(HIT_COUNT_KEY);

/**
 * The enemy's model takes another form (render/units.js FORMS: a clip set of its skeleton): kept on the unit
 * (`e.form`, published by snapshot.js unitInfo — a view built mid-battle from fieldMeta(): a teammate's field watched
 * later, 联防 observers, a reconnect — starts in it) and announced by the fx `fxKind` (+ id, x, y, `params`) carrying it
 * as `form` (a 'phase' fx also as its `kind`). The `form` key marks the fx as state (shared/protocol.js fxForm): the
 * client never drops it, not in a catch-up frame nor while its tab is hidden. Barrier / charge 'phase' kinds are no
 * forms: they go through b.fx directly, without `form`.
 */
export function setForm(b, e, form, fxKind = 'phase', params = null) {
  e.form = form;
  b.fx(fxKind, fxKind === 'phase' ? { ...params, x: e.x, y: e.y, id: e.id, kind: form, form } : { ...params, x: e.x, y: e.y, id: e.id, form });
}

export function rebirthCooldowns(e) {
  for (const s of (e.mem.ab && e.mem.ab.list) || []) if (s.cd != null) s.left = num(s.icd, 0);
}

export function rebirthCleanse(b, e) {
  for (const x of e.buffs.slice()) {
    if (x.persist || (x.source && x.source.side === 'enemy')) continue;
    if (x.source || x.status || x.key === INFECTION_BUFF) b.removeBuff(e, x);
  }
}

/**
 * "首次被击倒后重生 / 进入第二形态": the first knock-out is hidden (kill credit and bounty wait for the real death) and starts
 * a rebirth of `dur` s — statuses cleared (rebirthCleanse), invulnerable, untargetable, released by its blocker, inert
 * (no move / attack / skill).
 * `onKo(b, e, a)` runs at once (self-destruct, freeing prisoners …), `during(b, e, a, elapsed)` every tick of it; then the
 * enemy stands up with `hpRatio` of its max HP, `onReborn(b, e, a)` switches the form and `invincible` s of 无敌 follow.
 * `a.state`: undefined → 'reborn' → 'form2'. The 'telegraph' fx of the knock-out carries `form: 'reborn'` and the 'revive'
 * fx `form: 'form2'`: models with those clip sets (render/units.js FORMS — 锏, 扎罗, “复仇者”, 杰斯顿) play them.
 */
export function reborn({ dur = 0, hpRatio = 1, invincible = 0, onKo = null, during = null, onReborn = null, key = 'ab:reborn' } = {}) {
  const finish = (b, e, a) => {
    if (!e.alive || a.state !== 'reborn') return;
    a.state = 'form2';
    b.removeBuff(e, key);
    e.profile.noAttack = a.noAtk;
    if (onReborn) safe(b, e, () => onReborn(b, e, a));
    e.hp = Math.max(1, e.s.maxHp * Math.max(0, Math.min(1, hpRatio)));
    if (invincible > 0) b.addBuff(e, { key: `${key}:inv`, duration: invincible, visible: true, flags: { invulnerable: true } });
    if (e.route) e.route.pts = null;
    e.atkCd = 0;
    rebirthCooldowns(e);
    setForm(b, e, 'form2', 'revive', { kind: 'reborn' });
  };
  return {
    killed(c, b, e, a) {
      if (a.state) return false;
      a.state = 'reborn';
      a.t0 = b.time;
      a.noAtk = e.profile.noAttack;
      rebirthCleanse(b, e);
      e.hp = Math.min(1, e.s.maxHp);
      if (onKo) safe(b, e, () => onKo(b, e, a));
      if (!(dur > 0)) { finish(b, e, a); return true; }
      e.profile.noAttack = true;
      b.addBuff(e, {
        key, duration: dur, visible: true, persist: true,
        flags: { invulnerable: true, untargetable: true, unblockable: true, noMove: true, stun: true },
        onTick: during ? ({ battle }) => during(battle, e, a, battle.time - a.t0) : null,
        onExpire: ({ battle }) => finish(battle, e, a),
      });
      setForm(b, e, 'reborn', 'telegraph', { r: 1, dur, kind: 'reborn' });
      return true;
    },
  };
}

export function husk({ hits, delay, stealthy = true, unblock = false, onHusk = null, onRevive = null, key = 'ab:ember' }) {
  const revive = (b, e, a) => {
    if (!e.alive || a.state !== 'husk') return;
    a.state = null;
    hitCount(b, e, false);
    e.base.maxHp = a.max;
    e.markDirty();
    void e.s;
    e.hp = e.s.maxHp;
    e.profile.noAttack = a.noAtk;
    b.removeBuff(e, key);
    b.removeBuff(e, `${key}:reborn`);
    if (e.route) e.route.pts = null;
    e.atkCd = 0;
    setForm(b, e, 'revived', 'revive');
    if (onRevive) onRevive(b, e, a);
  };
  const enter = (b, e, a, rebirth) => {
      if (a.state === 'husk' || !(hits > 0) || !(delay > 0)) return false;
      const transition = rebirth ? HUSK_REBIRTH : 0;
      a.state = 'husk';
      a.rebornUntil = b.time + transition;
      a.noAtk = e.profile.noAttack;
      a.max = a.max ?? e.base.maxHp;
      if (rebirth) rebirthCleanse(b, e);
      e.profile.noAttack = true;
      e.lastAttackAt = -Infinity;                         // the snapshot shows no attack of the fallen warrior
      setHits(e, hits);
      hitCount(b, e, true);
      b.addBuff(e, { key, visible: true, persist: true, flags: { disarm: true, ...(stealthy ? { stealth: true } : {}), ...(unblock ? { unblockable: true } : {}) } });
      if (rebirth) b.addBuff(e, { key: `${key}:reborn`, duration: transition, flags: { invulnerable: true, untargetable: true, unblockable: true, noMove: true, noDisplace: true } });
      // the 重生's 无法阻挡 ends a block at once (as applyStatus does for a status): a warrior knocked out while blocked
      // leaves an ember whose 隐匿 is switched off until STEALTH_RESTORE (3) s after that block ended
      // (Battle._stealthSwitch) — ~2 s after the 1 s 重生, which stays 无敌 + untargetable — so ranged operators and
      // operator splash can finish it although its blocker took the next warrior meanwhile (players after 0.1.1: "the
      // stealth monster revives forever"). [ASSUMED] the order: the 重生's cleanse first, then the ember's 隐匿 with the
      // block-end switch (PRTS documents neither the order of 重生 vs that switch nor whether it survives the 重生)
      b._unblock(e);
      if (e.route) e.route.pts = null;
      setForm(b, e, 'husk', 'ember', { hits, dur: transition + delay });
      const started = () => { if (e.alive && a.state === 'husk') { rebirthCooldowns(e); if (onHusk) onHusk(b, e); } };
      if (rebirth) b.after(transition, started, { owner: e }); else started();
      b.after(transition + delay, () => revive(b, e, a), { owner: e });
      return true;
  };
  return {
    enterHusk(b, e, a) { return enter(b, e, a, false); },
    killed(c, b, e, a) {
      // an HP loss (流失 bypasses 无敌) during the 1 s 重生 cannot cut it short
      if (a.state === 'husk' && b.time < a.rebornUntil) { e.hp = e.s.maxHp; return true; }
      return enter(b, e, a, true); // a husk's knockout remains the real death
    },
  };
}


/** The shared 重生 ability for data-driven features (see reborn()). */
export function rebornAbility(params) { return reborn(params); }
export function huskAbility(params) { return husk(params); }
