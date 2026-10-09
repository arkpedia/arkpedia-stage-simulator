// SPDX-License-Identifier: GPL-3.0-or-later
// Source names mapped to the pinned Arkpedia image-asset naming convention.
export const classNames = { PIONEER: 'Vanguard', WARRIOR: 'Guard', TANK: 'Defender',
  SNIPER: 'Sniper', CASTER: 'Caster', MEDIC: 'Medic', SUPPORT: 'Supporter', SPECIAL: 'Specialist' };
export function operatorAssetName(name) {
  return name.startsWith("'") && name.endsWith("'") ? name.slice(1, -1) : name;
}
export function skillIconFile(operator, skill) {
  if (!skill) return null;
  const safe = operatorAssetName(skill).replace(/[\\/*?:"<>|]/g, '').trim();
  const aliases = { 'Little by Little': 'Little By Little', 'Image over Form': 'Image Over Form',
    "Binding 'Clip'": 'Binding Clip', "Launching 'Clip'": 'Launching Clip',
    'Night-Scouring Gleam': 'Night-scouring Gleam' };
  return `${operatorAssetName(operator)} - ${aliases[safe] ?? safe}.webp`;
}

export function skillDescriptionText(level) {
  const values = Object.fromEntries((level.blackboard ?? []).map((entry) => [entry.key.toLowerCase(), entry.value]));
  // The game writes this unit type in literal angle brackets, not as a rich-text tag.
  return (level.description ?? '').replace(/<Substitute>/g, 'Substitute').replace(/<[^>]*>/g, '').replace(
    /\{([^}:]+)(?::([^}]+))?\}/g,
    (placeholder, key, format) => {
      const negative = key.startsWith('-');
      const source = values[(negative ? key.slice(1) : key).toLowerCase()];
      if (typeof source !== 'number') return placeholder;
      const value = source * (negative ? -1 : 1);
      return format?.includes('%') ? Math.round(value * 100) + '%' : String(value);
    },
  );
}

// Clip diagonal stripes to the top face BEFORE projecting onto raised/ground tiles.
export function rangeStripes() {
  const clip = (points, boundary, greater) => {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const da = a[0] + a[1] - boundary, db = b[0] + b[1] - boundary;
      const insideA = greater ? da >= 0 : da <= 0;
      const insideB = greater ? db >= 0 : db <= 0;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = da / (da - db);
        result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return result;
  };
  const stripes = [];
  for (let start = -1.2; start < 1; start += 0.4) {
    const square = [[-.485, -.485], [.485, -.485], [.485, .485], [-.485, .485]];
    const polygon = clip(clip(square, start, true), start + .18, false);
    if (polygon.length >= 3) stripes.push(polygon);
  }
  return stripes;
}
