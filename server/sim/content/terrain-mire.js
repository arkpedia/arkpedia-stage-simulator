// SPDX-License-Identifier: GPL-3.0-or-later
/** One controller-independent accumulator for the original Mire effect. */
export function updateMire(b, u, active, params) {
  const key = 'terrain:mire', m = u.mem;
  m.mireContact = active;
  if (!active) { delete m.mireState; b.removeBuff(u, key); return; }
  const s = m.mireState ??= { life: u.deploySeq, since: b.time, triggers: 0, stacks: 0 };
  if (s.life !== u.deploySeq) { delete m.mireState; return updateMire(b, u, active, params); }
  if (u.s.flags.mireImmune) { b.removeBuff(u, key); return; }
  const due = 1 + Math.floor((b.time - s.since + 1e-9) / params.interval);
  if (due <= s.triggers && u.findBuff(key)) return;
  const enemy = u.side === 'enemy', per = enemy && u.s.massLevel >= params.heavyWeight ? 2 : 1;
  s.stacks = Math.min(params.max, s.stacks + per * (due - s.triggers)); s.triggers = due;
  b.addBuff(u, { key, refresh: 'replace', mods: enemy
    ? { aspd: params.aspdPer * s.stacks, moveMul: Math.max(0, 1 + params.movePer * s.stacks) }
    : { aspd: params.aspdPer * s.stacks } });
}
