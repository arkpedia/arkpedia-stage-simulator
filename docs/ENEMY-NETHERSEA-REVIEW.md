# Nethersea Spewers and Predators

Seaborn that use Nethersea Brand:
- **Nethersea Spewer** (`enemy_1233_dsshtr`): 4,000 HP, 650 ATK, 100 DEF, 50 RES, attack interval 2, move speed 0.3. A ranged Physical attacker.
- **Nourished Spewer** (`enemy_1233_dsshtr_2`): 5,000 HP, 800 ATK; otherwise the same.
- **Nethersea Predator** (`enemy_1231_dsrunr`): 4,000 HP, 450 ATK, 50 DEF, attack interval 3, move speed 1. A melee attacker.
- **Nourished Predator** (`enemy_1231_dsrunr_2`): 5,000 HP, 550 ATK, 80 DEF, dodge 0.9.

The Spewer alone blocked SN-1 "Center Plaza", and the Predator alone blocked SN-2 "Plaza South". Neither stage has Brand tiles.

All four are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-nethersea-features.js` holds the contract. It pins:
- the records;
- every component reachable from the retained abilities (the variants differ only in their skeleton);
- the templates;
- the Spewer's projectile;
- the Attack clips from `refs/arts/enm_art_10.ab`.

The runtime is `server/sim/content/arkpedia-enemy-nethersea.js`, with the kinds `netherseaSpewer` and `netherseaPredator`.

**Feature keys.** These keys are shared, and dispatch to this contract for these records:
- `talent:EpDamage` carries the ability and claims the Predator's BlockFree common ability;
- `talent:Attack` covers the Spewer;
- `talent:Evade` covers the Predator.

**Nethersea Brand.** The data marks it with `buff_creep[tile]`. Here it means standing on a `tile_creep` or `tile_creepf` tile, the Brand tiles the carapace stages already read.

## Nervous Impairment (both)

`trap_creep_ep_damage` runs on every damage the unit outputs. It puts `trap_creep_apply_ep_damage` on the target: `ApplyElementDamage` SANITY, which is Nervous Impairment, of `EpDamage.ep_damage_ratio` × ATK. The ratio is 0.02 for the Spewers and 0.1 for the Predators.

## Spewer

One selector takes units inside its 1.0 collider **or** units carrying `buff_creep[tile]` anywhere on the map. It takes up to `Attack.attack@max_target` (3) of them. A blocked Spewer hits its blocker.

At the Attack clip's event (1 s, release at 0.57 s) it fires the linear speed-10 `projectile_enemy_dsshtr` (lifetime 5) at each target, for ATK Physical.

## Predator

- **Evade.** Physical and Arts dodge of `Evade.prob` (0.8; 0.9 for the Nourished Predator). The pinned enum dump decodes the disabling flags as STUNNED, FROZEN, SILENCED, LEVITATE, UNMOVABLE, STUNNED_NO_AMPLIFY_DAMAGE and the SLEEPING combo. In the engine those are the `stun` flag (which covers stun, freeze, sleep and levitate), `silence` and `noMove`. The handbook line is silenceable too.
- **BlockFree.** Every 0.2 s: on Brand it becomes block-free and is released from any blocker; off Brand it can be blocked again.

## Verification

`test/arkpedia-nethersea.test.js`:
- **Admission.** All four are admitted. Each of these is refused:
  - Burn instead of Nervous Impairment;
  - another Brand buff key;
  - a Physical-only dodge;
  - two targets instead of three.
- **Spewer.**
  - It hits the operator in reach and the one on Brand, and not the two that are neither.
  - Each shot deals ATK Physical plus the Nervous Impairment.
- **Predator dodge.** The dodge is on, and off while stunned, silenced or unmovable.
- **Predator on Brand.** Blocked off Brand, it hits with Nervous Impairment. On Brand it is released within 0.2 s, and off Brand again it is blockable.
- **Compiled stages.** SN-1's Spewer (4,000 HP, 650 ATK) attacks up to three targets. SN-2's Predator (4,000 HP, 450 ATK) dodges. No battle errors.

The library rebuild published SN-1 and SN-2 (1,035 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, and the browser review passed.

## Boundaries

- **Brand source.** Brand is read from the tile. Other sources of `buff_creep[tile]` (operators or devices that grant it) are not modelled.
- **`_postFilter` 4.** It is read as the ordinary enemy order among the Spewer's candidates.
- **Regressed variants.** The tombstone ("Leaves its remains") variants `_3`/`_4` are not admitted.
