// SPDX-License-Identifier: GPL-3.0-or-later
/** Card attributes survive removal of the deployed body and expire on the
 * card's next successful deployment. Ratios use the existing additive bucket. */
export function cardRedeployRatio(entry) {
  return Math.max(0, 1 + [...(entry?.redeployRatios?.values() ?? [])].reduce((sum, n) => sum + n, 0));
}
export function grantCardRedeployRatio(b, unit, key, ratio) {
  const entry = b.bench?.[unit.defId];
  if (!entry || entry.unit !== unit || unit.kind !== 'op') return;
  if (!Number.isFinite(ratio)) throw Error('Invalid card redeploy ratio');
  const before = cardRedeployRatio(entry);
  (entry.redeployRatios ??= new Map()).set(key, ratio);
  if (!unit.alive && Number.isFinite(entry.readyAt) && entry.readyAt > b.time && before > 0)
    entry.readyAt = Math.max(b.time, unit.deathAt + (entry.readyAt - unit.deathAt) * cardRedeployRatio(entry) / before);
}
