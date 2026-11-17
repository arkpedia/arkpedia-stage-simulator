# Icefield Arts Fighter and Guard

`enemy_1191_krgrg` and `enemy_1191_krgrg_2` (one database level each, Arts melee) are admitted from their pinned CN prefabs (`battle/enm_pfb_9.ab`) and the Global templates. The prefabs are identical, except that the Fighter's bleed carries an extra visual-effects component. Each variant's set is pinned.

**Death blast (`boom`).** The shared `projectile_on_killed` emits `projectile_enemy_krgrg` from the death tile, unless the unit is silenced. Its reach-only hit (collider radius 1.65, camouflage ignored) selects ground units of **both sides** (`targetSide` 3, `targetMotion` 1). Each takes `boom.atk_scale` × ATK splash Arts damage (1.3; Guard 1.5) and `enemy_krgrg_boom`: `e2c_cold` on operators, `c2e_cold` on enemies. Cold lasts `boom.cold` (5 s); a second Cold becomes Freeze through the engine's existing rule.

This is the new reusable `bothSidesDeathBlast` kind. It is silence-aware through the runtime's `sil` dispatch, and fires only when the unit is killed, not when it leaves.

**Loses HP when shifted (`unbalanced_bleed`).** `enemy_krgrg_bleed` is the already-reviewed `enemy_cbjedi_bleed` with its own keys (`krhrg_blood`); the contract checks exactly that substitution. It uses the existing `unbalancedPeriodicDamage` kind (80; Guard 50, every 0.066 s while unbalanced).

The shared `talent:boom` and `talent:unbalanced_bleed` features dispatch to this contract for these two records only.

## Verification

`test/arkpedia-icefield-arts.test.js`:
- admission, and refusal when the Cold duration, the Cold buff or the blast radius change;
- the blast hitting an operator and a neighbouring enemy within 1.65 (not one 2.5 away) with Arts damage and Cold;
- no blast while silenced or on leaving;
- HP loss in fixed steps while shifted.

The existing Arc Frontliner shift tests pass unchanged.

## Boundaries

- **Cold duration.** `boom.freeze` (5) is not read: the engine's second-Cold Freeze takes the longer remaining Cold, which is also 5 s here.
- **Radius.** Distance is measured to the ally's collider (plus 0.25) and to the enemy's body, as for the other area effects.

## Deferred families noted while ranking (2026-11-17)

These depend on stage mechanics rather than enemy behaviour:
- **Hot Spring lambs** (`enemy_1344_ddlamb*`, `enemy_1345_tplamb*`): their death action `Act27sideModifyTileCachedSideType` marks the tile as enemy-owned, a mechanic of the event's tile-ownership mode.
- **Shanhaizhong Skirmishers** (`enemy_1296_ymknif*`): their range rises on Yumen Catastrophe Defenses tiles.
- **Filth** (`enemy_1390_dhsbr*`): blights paddy tiles on death and turns invisible on Blighted tiles.
