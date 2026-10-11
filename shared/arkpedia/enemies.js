// SPDX-License-Identifier: GPL-3.0-or-later
// Enemy ability kits also require regular-stage review before they can be used.
export const REGULAR_ENEMIES = Object.freeze({
  enemy_1007_slime: "basic-stats-and-attacks",
  enemy_1002_nsabr: "basic-stats-and-attacks",
});

export function assertRegularEnemies(data) {
  for (const id of Object.keys(data.enemies))
    if (!REGULAR_ENEMIES[id]) throw Error(`Unsupported regular-stage enemy: ${id}`);
  for (const wave of data.stage.geometry.waves)
    for (const spawn of wave.spawns)
      if (!REGULAR_ENEMIES[spawn.enemy_id] || !data.enemies[spawn.enemy_id])
        throw Error(`Missing supported enemy record: ${spawn.enemy_id}`);
}
