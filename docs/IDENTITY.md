# Civilian and spy identity (chapter 11–12)

This is the largest remaining stage mechanic: Chapters 11 and 12 are 0/50 and 0/55 built, and several event stages reuse the same units. The source exports enough data to model it, but it needs a small engine layer before any of those stages can be built honestly.

## Data

| Record | Role | Reviewed data |
|---|---|---|
| `enemy_1313_wdfmr` | Norport Civilian | `civilianTalent.max_cost = 2`; abilities "Friendly Unit" and "once identity is confirmed, restores max DP after retreating to the Objective Point" |
| `enemy_1313_wdfmr_2` | Norport Civilian (variant) | same |
| `enemy_1314_wdnjd` | Pathfinder Spy | `moveSpeed.move_speed = 0.05`; `EnhancedAttack.atk_scale = 2`; "when identity is revealed, the next attack's ATK is greatly increased" |
| `enemy_1315_wdyjd` | Sentry Spy | `moveSpeed.move_speed = 0.2`; "when identity is revealed, becomes Invisible" |
| `enemy_1319_wdfmpm` | Rebellion Instigator | "when not blocked, all unrevealed Civilians or Spies cannot be blocked" |
| `enemy_1322_wdgyht` | checkpoint attacker | "after several attacks, moves towards the next checkpoint for the next attack"; reviewed `blink` wrapper |
| `enemy_1317_wdexg` | DP-draining ammo unit | "attacks reduce DP when carrying ammo. Ammo capacity: 3" |

The stage geometry marks civilians/spies as ordinary wave spawns; there is no separate identity field in the export. The reveal source is a stage device/checkpoint, not a per-spawn flag.

## Engine plan

1. **Profile flags.** Add `profile.friendly`, `profile.spy`, `profile.revealed` and `profile.requiredBlock` (already exists for the Theater Golem). Friendly units are skipped by `canTargetEnemy` and never counted as leaks against life.
2. **Blocking.** `_blockerFor` must reject an unrevealed spy/civilian while the Instigator is alive (the `1319` aura), and allow it once revealed. A revealed Sentry Spy gets the stealth flag; a revealed Pathfinder Spy arms one `EnhancedAttack` hit.
3. **Civilian reward.** On reaching the objective, a friendly civilian adds `civilianTalent.max_cost` to max DP (not current DP) and leaves the field. This needs a small `Battle` hook so it does not route through `enemyLeak`.
4. **Reveal.** The stage device/checkpoint calls `b.revealIdentity(enemy)`, which sets `revealed`, applies the spy consequence and fires a `reveal` FX. The exact reveal trigger is stage data; model the API first, then wire one stage.
5. **Blink.** `1322` reuses the reviewed wrapper/blink builder, but its cadence is "after several attacks", not Crownslayer's blocked trigger. Add a parameterised `nthAttackBlink` rather than a new mechanic.
6. **Ammo/DP drain.** `1317` needs a small ammo counter and a DP-drain hook; keep it separate from the identity layer.

## Tests

- Friendly unit is never selected by an operator and does not subtract life.
- Civilian objective reward raises max DP by the reviewed `max_cost`.
- Unrevealed spy is unblockable while an Instigator is alive; revealed spy is blockable and gains the reviewed stealth/next-hit effect.
- The reveal API is idempotent.
- A stage-level test builds one chapter-11 stage end-to-end, including the reveal device.

## Open questions

- Does a friendly civilian count as an enemy for wave-clear/3-star conditions? The export's `enemies.total` includes it, but the game's counter does not. Resolve before promoting a stage.
- Are civilians targetable by enemy attacks? The record is a normal enemy unit; likely not, but the source does not say. Keep them out of operator targeting and out of enemy `allies` lists until a test proves otherwise.
- The reveal device is not in `stage-geometry`; it may need a new `gates`/`devices` entry from the source. Do not hard-code per-stage reveal times.
