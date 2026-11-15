// SPDX-License-Identifier: GPL-3.0-or-later
/** Independent sources hold deployment cards without overwriting cooldowns or
 * squad-removal state. Releasing one source never releases another's lock. */
export function cardLockError(entry) {
  return entry?.deploymentLocks?.values().next().value?.message ?? null;
}
export function holdDeploymentCard(b, unit, owner, { message, readyOnRelease = false }) {
  const entry = b.bench?.[unit.defId];
  if (!entry || entry.unit !== unit || unit.kind !== 'op') return () => {};
  const locks = entry.deploymentLocks ??= new Map();
  const token = { owner, message }; locks.set(token, token);
  let released = false;
  return () => {
    if (released) return; released = true; locks.delete(token);
    entry.readyAfterDeploymentLocks ||= readyOnRelease;
    if (!locks.size) {
      if (entry.readyAfterDeploymentLocks && !entry.noCard && !entry.removedFromDeck)
        entry.readyAt = Math.min(entry.readyAt, b.time);
      delete entry.readyAfterDeploymentLocks;
    }
  };
}
