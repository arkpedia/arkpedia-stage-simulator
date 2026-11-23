// SPDX-License-Identifier: GPL-3.0-or-later
// Manfred (enemy_1528_manfri). Every number arrives in `p` from the reviewed
// contract (shared/arkpedia/enemy-manfred-features.js). Three native modes:
// Default (the floating cannon), Pose (the revive and its closing Revive clip)
// and Reborn (the sword with the cannon's bouncing shot).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { elem } from './arkpedia-enemy-effects.js';
import { areaSelectable } from '../targeting.js';

const EVADE = 'enemy_manfri_evade', FOCUS = 'enemy_manfri_[atk_speed]', POSE = 'ab:manfriPose';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const ground = (e, u) => live(u) && !u.isFlying && areaSelectable(e, u);

export function manfred(p) {
  validate(p);

  // --- Artillery: every charging hit adds SP to the Londinium artillery (inert on a stage without one) ---
  const charge = (b, amount) => { if (amount > 0) b.chargeStageArtillery?.(amount); };
  const necrosis = (b, e, u, ratio) => { if (ratio > 0 && u?.alive) elem(b, e, u, p.element, e.s.atk * ratio, { tags: ['manfriNecrosis'] }); };

  // --- Military Training: 80% Physical/Arts dodge; an artillery hit strips it for `disable` s and stuns ---
  const grantEvade = (b, e) => b.addBuff(e, { key: EVADE, persist: true, visible: true, mods: { dodgePhys: p.evade.prob, dodgeArts: p.evade.prob } });
  const stopTimer = a => { a.disableTimer?.cancel(); a.disableTimer = null; };
  const disable = (b, e, a) => {
    b.removeBuff(e, EVADE);
    b.applyStatus(e, 'stun', { duration: p.evade.stun });
    // enemy_manfri_evade[disable_timer]: a re-hit restarts it; the dodge returns when it runs out.
    stopTimer(a);
    a.disableTimer = b.after(p.evade.disable, () => {
      a.disableTimer = null;
      if (e.alive && a.state !== 'reborn' && !a.posing) grantEvade(b, e);
    }, { owner: e });
  };

  // --- Focus: +aspd per consecutive attack on the same target, at most `max`; reset on a switch or `hold` s idle ---
  const setFocus = (b, e, a, stacks) => {
    a.focus = stacks;
    b.removeBuff(e, FOCUS);
    if (stacks > 0) b.addBuff(e, { key: FOCUS, persist: true, visible: true, mods: { aspd: p.focus.aspd * stacks } });
  };
  const focus = (b, e, a, target) => {
    const same = target === a.focusTarget && b.time < a.focusUntil;
    a.focusTarget = target;
    a.focusUntil = b.time + p.focus.hold;
    setFocus(b, e, a, same ? Math.min(p.focus.max, a.focus + 1) : 0);
  };

  // --- Form two's funnel: a speed-20 shot at the attack's target, `times` hits 0.53 s apart ---
  const funnelHit = (b, e, u) => {
    if (!u?.alive) return;
    b.dealDamage(e, u, { amount: e.s.atk * p.funnel.scale, type: 'arts', applyWay: 'ranged', tags: ['manfriFunnel'] });
    necrosis(b, e, u, p.funnel.ep);
    charge(b, p.charge.funnel);
  };
  const funnel = (b, e, target) => b.addProjectile({ from: e, target, speed: p.funnel.speed, visual: 'enemy', source: e, onHit: c => {
    const first = c.target;
    if (!first?.alive) return;
    funnelHit(b, e, first);
    let last = first;
    for (let i = 1; i < p.funnel.times; i++) b.after(p.funnel.bounceInterval * i, () => {
      if (!e.alive) return;
      // One other operator within 1.5 of the last hit, nearest first; else the traced target again.
      const next = b.allies().filter(u => u !== last && ground(e, u) && Math.hypot(u.x - last.x, u.y - last.y) <= p.funnel.bounceRadius + 1e-9)
        .sort((x, y) => Math.hypot(x.x - last.x, x.y - last.y) - Math.hypot(y.x - last.x, y.y - last.y))[0] ?? (first.alive ? first : null);
      if (!next) return;
      funnelHit(b, e, next); last = next;
    }, { owner: e });
  } });

  // --- First knock-out: wave released, 20 s revive at full HP with the cannon barrage, then the Pose clip ---
  const rebirth = rebornAbility({
    dur: p.rebirth.dur, hpRatio: 1, invincible: p.rebirth.invincible,
    onKo(b, e, a) {
      stopTimer(a); b.removeBuff(e, EVADE); setFocus(b, e, a, 0); a.focusTarget = null;
      b.stageWaveScheduler?.releaseCurrentWave(e, { trackSourceAtNextWave: true });
      a.rage = b.every(p.rebirth.interval, () => {
        if (!e.alive || a.state !== 'reborn') return;
        const target = b.rng.pick(b.allies().filter(u => ground(e, u)));
        if (!target) return;
        b.dealDamage(e, target, { amount: e.s.atk * p.rebirth.rageScale, type: 'arts', applyWay: 'ranged', isSkill: true, tags: ['manfriRage'] });
        charge(b, p.charge.rage);
      }, { owner: e });
    },
    onReborn(b, e, a) {
      a.rage?.cancel(); a.rage = null;
      // Pose mode: the Revive clip plays before the sword form; nothing else acts meanwhile.
      a.posing = true; e.profile.noAttack = true; e.skillAnimUntil = b.time + p.rebirth.pose;
      b.addBuff(e, { key: POSE, duration: p.rebirth.pose, persist: true, flags: { noMove: true } });
      b.after(p.rebirth.pose, () => {
        if (!e.alive) return;
        a.posing = false; a.form = 2; e.profile.noAttack = false; e.atkCd = 0;
        e.def.attackAnim = p.form2.anim;
        stopTimer(a); grantEvade(b, e);
      }, { owner: e });
    },
  });

  // --- H10-3 aura (aura_on only): each rebirthable Heirbearer and each Reborn Creation burns its surroundings ---
  // Every carrier keeps its own clock from the moment it is seen (the derived buff waits one interval first).
  const rebirthable = new Set(p.aura.rebirthable);
  const carries = u => u.side === 'enemy' && live(u) && (rebirthable.has(u.def?.key) || !!u.findBuff?.(p.aura.creationMark));
  const auraTick = (b, e, a) => {
    const seen = new Set();
    for (const u of b.units) {
      if (!carries(u)) continue;
      seen.add(u);
      let next = a.aura.get(u);
      if (next == null) { a.aura.set(u, b.time + p.aura.interval); continue; }
      if (b.time + 1e-9 < next) continue;
      a.aura.set(u, next + p.aura.interval);
      const amount = e.s.atk * p.aura.scale;
      for (const t of b.allies()) {
        if (!live(t) || !areaSelectable(u, t) || Math.hypot(t.x - u.x, t.y - u.y) > p.aura.radius + 1e-9) continue;
        b.dealDamage(null, t, { amount, type: 'arts', sourceless: true, tags: ['manfriAura'] });
      }
    }
    for (const u of a.aura.keys()) if (!seen.has(u)) a.aura.delete(u);
  };

  return {
    ...rebirth,
    spawn(b, e, a) {
      a.form = 1; a.focus = 0; a.focusTarget = null; a.focusUntil = -Infinity; a.posing = false; a.aura = new Map();
      e.profile.shot = 'none'; e.profile.deferHit = true;
      e.base.rangeRadius = p.radius; e.markDirty?.();
      e.profile.canTarget = u => !u.isFlying;
      e.def = { ...e.def, attackAnim: p.form1.anim };
      grantEvade(b, e);
    },
    attack(c, b, e, a) {
      if (a.state === 'reborn' || a.posing) return;
      const target = c.targets.find(u => u?.alive);
      if (!target) return;
      const attackId = b._attackSeq, f = a.form === 2 ? p.form2 : p.form1;
      focus(b, e, a, target);
      b.dealDamage(e, target, { amount: e.s.atk * f.scale, type: f.type, isAttack: true, attackId, applyWay: 'ranged', tags: [a.form === 2 ? 'manfriSword' : 'manfriCannon'] });
      necrosis(b, e, target, f.ep);
      if (a.form === 2) funnel(b, e, target); else charge(b, p.charge.attack);
    },
    taken(c, b, e, a) {
      // enemy_manfri_mark sits on the artillery: its damage to him casts Shield[disable] while he has the dodge or its timer.
      if (!c.dmg?.tags?.includes('artillery') || a.state === 'reborn' || !e.alive) return;
      if (e.buffs.some(x => x.key === EVADE) || a.disableTimer) disable(b, e, a);
    },
    tick(b, e, a) {
      if (a.focus > 0 && b.time >= a.focusUntil) setFocus(b, e, a, 0);
      // "While present": the ability stays attached through the revive (_detachAbilityWhenReborn 0).
      if (p.aura.on && e.alive) auraTick(b, e, a);
    },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  const ok = pos(p?.radius) && [p.form1, p.form2].every(f => pos(f?.scale) && (f.type === 'arts' || f.type === 'phys') && nn(f.ep) && pos(f.anim?.dur))
    && p.element === 'apoptosis' && pos(p.focus?.aspd) && Number.isInteger(p.focus.max) && p.focus.max > 0 && pos(p.focus.hold)
    && nn(p.charge?.attack) && nn(p.charge.funnel) && nn(p.charge.rage)
    && pos(p.funnel?.scale) && nn(p.funnel.ep) && Number.isInteger(p.funnel.times) && p.funnel.times > 0 && pos(p.funnel.speed) && pos(p.funnel.bounceRadius) && pos(p.funnel.bounceInterval)
    && p.evade?.prob > 0 && p.evade.prob <= 1 && pos(p.evade.disable) && pos(p.evade.stun)
    && pos(p.rebirth?.dur) && pos(p.rebirth.interval) && nn(p.rebirth.invincible) && pos(p.rebirth.rageScale) && pos(p.rebirth.pose)
    && typeof p.aura?.on === 'boolean' && pos(p.aura.interval) && nn(p.aura.scale) && pos(p.aura.radius)
    && Array.isArray(p.aura.rebirthable) && p.aura.rebirthable.every(k => /^enemy_[a-z0-9_]+$/.test(k)) && p.aura.creationMark === 'ab:bloodsuckerMark';
  if (!ok) throw Error('Invalid Manfred parameters');
}
