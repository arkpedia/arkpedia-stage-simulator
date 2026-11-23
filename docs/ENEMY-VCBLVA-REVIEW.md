# Kazdel fire elemental (`enemy_8017_vcblva`)

A CN-only melee Arts elite: 70,000 HP, 700 ATK, 800 DEF, 60 RES, speed 1.2, weight 1, blocks 1. Its handbook line says no friendly unit can be deployed on its tile or the eight around it. It alone blocked VEC-02 "High-Tension Pursuit"; VEC-10, VEC-11, VEC-C and VEC-SP16 still have other blockers.

It is admitted from its pinned CN prefab. `shared/arkpedia/enemy-vcblva-features.js` holds the contract. It pins:
- the record (no talents, no skills);
- every component reachable from the retained abilities (`Combat`, `block_tile`);
- the CN-only template `enemy_vcblva_t_tile` (absent from the Global templates);
- the nine `_rangeGridPositions`, the buff's 0.2 s trigger interval and its immunity to silence, stun and freeze;
- the Attack clip (1.6 s, hit at 0.6 s) from `refs/arts/enm_art_26.ab`.

The runtime is `server/sim/content/arkpedia-enemy-vcblva.js`, kind `deployDenyZone`.

## The deploy ban

The handbook gives no numbers. They are all in the client:
1. **The tiles.** The `block_tile` ability lists nine `_rangeGridPositions`: offset (0,0) and its eight neighbours. A cross or any other shape would show here.
2. **The buff.** It attaches `enemy_vcblva_t_tile` with `triggerInterval` 0.2 s and `waitFirstTriggerInterval` 0, so it triggers on attach and then every 0.2 s.
3. **The template.** On each trigger, `AssignRootTileToBB` copies the owner's root tile to `cur_col`/`cur_row`. If that differs from the stored `col`/`row`, it stores the new tile and calls `SetBuildableHighLightUpdaterDirty`. Nothing else happens: no damage, no effect on units already deployed.

The simulator does the same. The runtime samples the enemy's rounded position at spawn and every 0.2 s. It registers the nine tiles around it in `b.noDeployZones`, a map keyed by the owner. `StandardBattle._placementError` refuses those tiles while the owner is alive ("Tile is unavailable for deployment."). Death removes the zone. The client draws the deploy highlight from the same check, so the ban shows on the map.

The engine had only `b.noDeployTiles`, a permanent set (FrostNova's ice blocks, the death-sealed tiles). A moving zone needs its own source so that leaving a tile frees it without clobbering those.

## Verification

`test/arkpedia-vcblva.test.js`:
- **Admission.** Admitted; each of these is refused:
  - five grid positions instead of nine;
  - a template without its trigger actions.
- **Compiled VEC-02.** The elemental enters at its record HP. Standing diagonally next to a free melee tile, it bans that tile and leaves a tile three columns away open. After it moves, the old zone holds until the next 0.2 s trigger. Then it frees the old tile and bans its own. Death lifts the ban. No battle errors.

The library rebuild published VEC-02 (1,043 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,043 graphs with no failures. Browser review on the preview server: the elemental draws with its original art. With a card selected, the three road tiles beside it are left out of the deploy highlight and the rest of the row stays green.

## Boundaries

- **Root tile.** The root tile is taken as the enemy's rounded position, the engine's usual tile for an enemy.
- **Visual.** The zone has no map overlay of its own beyond the missing highlight; the original `enemy_vcblva_skill_start` effect is not played.
