# Sarkaz artillery chargers

Four Sarkaz records charge the Londinium Secondary Defense Artillery (`trap_058_gunctrl`, tagged `gunctrl`):
- **Drones:** Requisitioned Engineering Drone (`enemy_1227_dair`) and Cutting-Edge Drone (`enemy_1227_dair_2`).
- **Artificers:** Heirbearer Artificer (`enemy_1223_dmech`) and Artificer Captain (`enemy_1223_dmech_2`).

All four were already admitted, but their charging was inert. The drones' line had no runtime. The artificers' `artilleryCharge` kind only counted seconds on the battle and never reached the artillery. So every published stage with the artillery and these units was easier than in the game: 10-6, 10-7, 10-11, 10-12, 10-14, 10-15, 10-17, 13-5, TR-20 and their adverse variants.

`shared/arkpedia/enemy-artillery-charge-features.js` now pins:
- each record;
- every component reachable from their abilities;
- the templates `enemy_dair_charge[trigger]`, `enemy_dmech_charge[interrupt]` and `modify_sp[start]` (and `empty` for the artificers);
- `projectile_enemy_dmech_charge`.

The runtimes are in `server/sim/content/arkpedia-enemy-artillery-charge.js`. Both go through `battle.chargeStageArtillery`, the `modify_sp[start]` path Manfred already uses: it charges the first `gunctrl` unit in stage order and does nothing without one.

## Drones (`droneArtilleryCharge`)

`charge_trigger` keeps `enemy_dair_charge[trigger]` on the drone. On every attack cast on a target (`ON_ABILITY_CAST_ON_TARGET`), it runs the `charge` ability on the first `gunctrl` unit: `modify_sp[start]` by the talent's `charge.sp` (1). This happens per attack cast, so a missed or dodged bolt still charges. The runtime charges in the attack dispatch, once per target.

## Artificers (`artificerArtilleryCharge`)

`charge_gunctrl` is a skill with SP INCREASE_WITH_TIME, 5 SP. It fires once (`_maxTriggerTime` 1), and silence blocks it.
1. **The link.** After a 0.667 s pre-delay it fires `projectile_enemy_dmech_charge`: a link that reaches the artillery at once and lasts `_linkDuration` 20 s.
2. **The charge.** The link re-hits every `_keepAlreadyHitTime` 1 s, and each hit adds the skill's `sp` (1), so 20 in all.
3. **The cast.** It waits for the link to end, then 0.667 s more; the Artificer stands still throughout.
4. **The penalty.** `enemy_dmech_charge[interrupt]` lasts for `hit_duration` (20 s). If the cast is interrupted, or ends while the Artificer is silenced, the artillery takes `modify_sp[start]` of `enemy_dmech_charge[sp_reduce].sp` (−15). Interruption here means stun, freeze or levitation.

The old `artilleryCharge` kind remains only for records outside this contract.

## Stage multipliers

- **10-14 adverse:** `enemy_talent_blackb_mul` sets `charge.sp` ×3 on the drones; `talent:charge` declares it.
- **10-6 adverse:** `enemy_skill_blackb_mul` sets `charge_gunctrl.sp` ×2 on the Artificer; `skill:charge_gunctrl` declares it.
- **13-5 adverse:** carries the drone multiplier too.

## Verification

`test/arkpedia-artillery-charge.test.js`:
- **Admission.** All four are admitted; another link length is refused.
- **Drone.** Each drone charges exactly once per attack cast on a target, by `charge.sp`.
- **Artificer.** No charge before 5 SP. One link adds exactly 20, once. A stun mid-link stops it after 5 to 6 charges and costs 15.
- **Compiled adverse records.** They carry ×3 and ×2.

The old enemy-features test now checks only that an Artificer with no artillery on the field does not link, and that he still leaves his reborn child.

The library rebuild published 10-6, 10-14 and 13-5 adverse (1,066 available). The bundles of the 14 published stages that field these units changed, because their charge now counts. `check-stage-library.mjs` smoked all 1,066 graphs with no failures.

## Boundaries

- **Death during the link** is not read as an interruption: no penalty.
