# Remaining hard mechanics

These are the systems that block the unbuilt stages after round 100. Each is larger than one enemy feature; the order below is the suggested implementation order.

## 1. Deployable tokens (60 stages)

`stage-geometry` carries `suppliedUnits.deployable_tokens` (Roadblock ×5, Allerdale's Guard ×1–3, …) but the engine has no player-placed token deck. Needed:

- A per-stage token inventory with the reviewed count.
- A placement API on `StandardBattle` (tile validation, cooldown, retreat/refund).
- Prep/battle UI buttons and a count badge.
- Tests for placement, block contribution and depletion.

Do not fake tokens by pre-placing them: the stage expects the player to choose the tiles.

## 2. Conditional spawns (63 stages)

All chapter-11 `hasConditionalSpawns` stages expose only the summary count, not the trigger. The trigger is a stage device (altar/checkpoint), not a per-spawn field. Needed:

- A source for the device/trigger (the current geometry export does not contain it).
- A battle event bus for “device activated”/“enemy reached checkpoint”.
- The stage adapter mapping the reviewed trigger to a spawn schedule.
- A refusal test for a conditional stage without its trigger.

## 3. Inspired / Originium Altar (1078, 1079, 1082)

The `strength`/`target` bonuses are conditional on an `Inspired` buff produced by the altar pulse. The altar is not in the geometry export. Needed: the altar device, its pulse cadence and the `ab:inspired` buff, then the three reviewed bonuses (move speed, extra target, ASPD).

## 4. Londinium Secondary Defense Artillery (1223)

The Artificer's `charge_gunctrl` skill charges a stage-level artillery. Needed: the artillery state, the charge rate, the interruption loss (15) and the charged effect. The skill data is reviewed; the device is not exported.

## 5. Talulah, the Fighter (3002)

Phased boss: Burning Breath, Dance Fire, half-HP stats, no ordinary Life Point loss on entry but a loss on death. Needed: the phase triggers, the targeted burning-breath DoT and the half-HP stat switch.

## 6. Decode Basis (10081)

Three modes (`Mode_Fuchou`, `Mode_Youling`, `Mode_Shushi`) selected by 4 physical hits, 4 Arts hits or being blocked. Needed: the mode table and the transform wrappers; the exact mode mapping is not in the record text.

## 7. Damazti Cluster (1542) and the 14-18/20 bosses

Multi-form bosses with shared-HP fragments, identity reveal, periodic sync attacks and summons. These are best implemented after the identity layer is fully exercised by a chapter-11 stage.

Until these exist, the coverage report (`npm run coverage:arkpedia-stages`) keeps the affected stages in the unsupported/conditional/token buckets instead of approximating them.
