# Blazing and Pyric Originium Slugs

Ranged Arts slugs that inflict Burn:
- **Blazing Originium Slug** (`enemy_1305_mhslim`): 1,200 HP, 50 ATK, 0 DEF, 0 RES, range 1.8, attack interval 2, move speed 0.8.
- **Pyric Originium Slug** (`enemy_1305_mhslim_2`): 1,800 HP, 80 ATK; otherwise the same.

The Blazing Slug alone blocked VEC-A "Passionate Threat", where it fields 7,000 HP.

Both are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-burn-slug-features.js` holds the contract. It pins:
- the record;
- every component reachable from the retained abilities (the variants differ only in their skeleton);
- the templates;
- `projectile_enemy_mhslim`;
- the Attack clip from `refs/arts/enm_art_12.ab`: 1 s, release at 0.67 s.

They use the existing `animatedProjectileAttack` kind; no new runtime kind is needed.

**Feature keys.** `talent:EpDamage` was a covers-only entry: a later key overrode the elementOnHit family entry of the same name. It now dispatches `covers`, `ability` and `explains` to this contract for the slugs, and is unchanged for every other record. It also accepts stage multipliers on `attack@ep_damage_ratio`.

## The shot

The Combat (blocked) and Attack (ranged) components are identical. Each targets one unit in range, ground or aerial. At the Attack clip's event the slug fires `projectile_enemy_mhslim`, an arcing projectile:
- speed 5, lifetime 10;
- one hit, and it always reaches its traced target, so the engine's homing single-target transport is used; the arc is visual.

On an accepted hit it deals ATK Arts, then Burn of `EpDamage.attack@ep_damage_ratio` (1.0) × ATK (`_elementDamageType` 3).

`LogKilled` is a kill counter with no combat effect.

## Verification

`test/arkpedia-burn-slug.test.js`:
- **Admission.** Both slugs are admitted, and the Cleanup Squad (another EpDamage user) still is. Each of these is refused:
  - a 0.5 ratio;
  - Corrosion instead of Burn.
- **The shot.** Each shot deals ATK Arts and ATK × 1.0 Burn.
- **Compiled VEC-A.** The Blazing Slug is at 7,000 HP and 50 ATK, and hits a deployed Myrtle with Arts and Burn. No battle errors.

The library rebuild published VEC-A (1,033 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, and the browser review passed.

## Boundaries

- **Arc.** The paracurve (`_raiseHeight` 0.3) is not drawn; the shot flies straight to its target at speed 5.
