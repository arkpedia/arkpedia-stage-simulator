// SPDX-License-Identifier: GPL-3.0-or-later
// The combat clock controls source height tweens, so pause and speed changes
// keep the model, health bars, and attack timing in the same state.
export function regularVisualHeight(visual, time) {
  const tween = visual?.height;
  if (!tween) return Number.isFinite(visual?.heightOffset) ? visual.heightOffset : 0;
  if (![tween.start, tween.from, tween.to, tween.duration, time].every(Number.isFinite) || tween.duration <= 0)
    return 0;
  const ratio = Math.max(0, Math.min(1, (time - tween.start) / tween.duration));
  return tween.from + (tween.to - tween.from) * ratio;
}
