# 'Crossroads' Production Model and Prototype

Two laser vehicles with no ordinary attack:
- **Production Model** (`enemy_1331_cbsisy`): 15,000 HP, 190 ATK, 800 DEF, 10 RES, move speed 0.8, weight 4. It is immune to Stun, Silence, Sleep, Freeze and Levitate.
- **Prototype** (`enemy_1331_cbsisy_2`): 20,000 HP, 250 ATK, 900 DEF; otherwise the same.

The Production Model alone blocked CW-6 "Gathering of Heroes".

Both are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-crossroads-features.js` holds the contract. It pins:
- the record;
- every component reachable from the retained abilities (the variants differ only in their skeleton);
- seven templates;
- both laser projectiles;
- the looping Move and Idle clip clocks from `refs/arts/enm_art_13.ab`.

The runtime is `server/sim/content/arkpedia-enemy-crossroads.js`, kind `crossroads`, under `talent:AttackTrigger`.

## The laser loop

`AttackTrigger` holds `enemy_cbsisy_t`, a permanent buff with UNBALANCE_IMMUNE (it is never shifted). It triggers every 1 s, the first at once. Each trigger casts:

1. **CloseAttack.** Every ground operator inside the 0.7 collider takes `attack@CloseAttack` (1.0) × ATK Arts.
2. **FourDirAttackMove / FourDirAttackIdle,** depending on whether it is walking (`IfEnemyIsMovingBySelf`); the two are identical. Four `projectile_enemy_cbsisy` lasers fly along the cardinal directions:
   - speed 6, life 0.2 s, so a reach of 1.2;
   - hitbox 0.2, one hit, ground or aerial;
   - `attack@FourDirAttack` (0.5) × ATK Arts.

**Release timing.** Both casts wait for the attack event of the looping clip that is playing: Move (1 s loop, events at 0.2 and 0.7) or Idle (0.5 s loop, event at 0.2). Each cast's `preDelay` of 3 s caps that wait. The interrupt buffs end each cast once it has fired, so the next trigger can cast again.

**Distance split.** The English wiki gives it as 0–0.7: 100% ATK, >0.7–1.2: 50%. The runtime follows that:
- a laser stops at the first unit in its lane;
- a unit the close attack already hit takes no laser damage.

**No other attack.** The Combat component is empty, so it never attacks otherwise.

## Planetary Debris

`AntiRistar`, `RistarSpeedDown`, the `*ForRistar` casts and the `enemy_cbsisy_t_2` / `enemy_cbsisy_move_ristar` templates act only on Planetary Debris along `tile_ristar_road`. They are pinned, not run. The runtime throws on any stage with a `tile_ristar*` tile, so a debris stage cannot be published by mistake. CW-6 has none.

## Verification

`test/arkpedia-crossroads.test.js`:
- **Admission.** Both variants are admitted. Each of these is refused:
  - a larger close collider;
  - a 2 s trigger;
  - a Physical close attack;
  - a faster laser.
- **Damage pattern.** For both variants:
  - an operator 0.5 away takes 100% ATK Arts;
  - operators 1 tile up and 1 tile left take 50%;
  - an operator 2 away and one off the lanes take nothing;
  - the next second brings exactly one more volley.
- **Lanes.** A laser stops at the first unit in its lane.
- **Compiled CW-6.** The Production Model has 15,000 HP and 190 ATK. It hits a Myrtle 0.5 away with its close attack every second. No battle errors.

The library rebuild published CW-6 (1,027 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, and the browser review passed.

## Boundaries

- **Distance split.** The runtime follows the wiki. In the data, a laser from the body could also meet a unit within 0.7; the wiki says such a unit takes only the 100%.
- **Clip phase.** The loop phase restarts when it switches between walking and idling. The client's exact animation phase is not tracked.
- **Debris.** Debris pushing is not implemented; stages that need it are refused.
