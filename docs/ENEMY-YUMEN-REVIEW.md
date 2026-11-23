# 'Wallbreaker' and 'Sandwalker' (TG-8)

Two Yumen machines that, between them, blocked TG-8 "Prime Alley" and its Challenge:
- **'Wallbreaker'** (`enemy_1301_ymcnon`): 15,000 HP, 1,000 ATK, range 1.2, attack interval 4.5. A ranged Physical attacker.
- **'Fortbreaker'** (`enemy_1301_ymcnon_2`): 18,000 HP, 1,200 ATK; otherwise the same.
- **'Sandwalker'** (`enemy_1302_ymtro`): 22,500 HP, 800 ATK, melee, block volume 4.
- **'Sand Voyager'** (`enemy_1302_ymtro_2`): 30,000 HP, 1,000 ATK; TG-8 fields this one.

All four are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-yumen-features.js` holds the contract. It pins each record verbatim (stats, ability texts, talents), every component reachable from the retained abilities, the templates, the Wallbreaker's projectile, and the Attack clips from `refs/arts/enm_art_12.ab`.

The runtime is `server/sim/content/arkpedia-enemy-yumen.js`, with the kinds `wallbreaker` and `sandwalker`.

**Feature keys.** `talent:Bus` is the beach bus's key. In `enemy-features.js` it now dispatches `covers`, `ability` and `explains` to this contract for the Sandwalkers, and is unchanged for the beach bus.

## Wallbreaker

At the Attack clip's event (2.13 s, release at 0.57 s) it fires the arcing speed-6 `projectile_enemy_ymcnon` (lifetime 10, one hit) for ATK Physical.

Its Trigger selector has `_postFilter` 48, which the handbook line describes as preferring friendly units on Yumen Catastrophe Defenses. Those defenses are stage devices, and the filter value is not decoded. So:
- the runtime **refuses any stage that has devices**;
- otherwise it keeps the ordinary target order.

TG-8 has no devices.

## Sandwalker

Its block volume is 4, so only units with at least 4 Block can stop it (the shared block-volume rule).

**Loading.** The Bus ability runs in the Default mode. It loads up to `Bus.max_cnt` (4) enemies within 0.5 that are:
- on the ground;
- normal or elite level, not Leaders (validator mask 3);
- not machines;
- not already carried.

It uses the shared passenger container (`arkpedia-enemy-passengers.js`): passengers ride hidden, with their HP, buffs and counts kept.

**Unloading at Ladders.** `enemy_ymtro_t[mark]` switches it to the ClosedBus mode on `tile_stairs` (a Ladder) to unload. TG-8 has no `tile_stairs`, and the runtime **refuses any stage that has one**.

**Death and leaks.**
- When it dies, the passengers reappear on its tile centre (`_appearOnTileCenter` 1) and keep their own routes (`_useHostRoute` 0). The container gained `useHostRoute` and `tileCenter` options for this; the beach bus keeps its defaults.
- If it leaks, its passengers leak with it.

## Verification

`test/arkpedia-yumen.test.js`:
- **Admission.** All four are admitted, and so is the beach bus. Each of these is refused:
  - another Ladder tile key;
  - a capacity of 3.
- **Wallbreaker.** One shot deals ATK Physical, and a stage with a device is refused.
- **Sandwalker.**
  - It loads 4 of 5 nearby slugs, which ride hidden.
  - When it dies they reappear alive, on its tile centre, each with its own route.
- **Compiled TG-8.**
  - The Wallbreaker is at 15,000 HP.
  - The Sand Voyager is at 30,000 HP and 1,000 ATK.
  - No battle errors.

The library rebuild published TG-8 and its Challenge (1,037 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, and the browser review passed.

## Boundaries

- **Defense priority.** It is refused on device stages, not modelled.
- **Ladder unloading.** It is refused on `tile_stairs` stages, not modelled.
- **Passenger routes after death.** Each passenger resumes its own route from its tile, re-planned from there.
