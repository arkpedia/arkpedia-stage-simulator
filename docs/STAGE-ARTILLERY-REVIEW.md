# Londinium Secondary Defense Artillery: original instances

Date: 2026-11-23. Device: `trap_058_gunctrl` (伦蒂尼姆城防副炮), skill `sktok_gunctrl`.

## What changed

Before this change, the artillery was a plain spec, and every artillery ran with level-1 values (cost 120, starting SP 0). The device list also included a hidden instance as a live gun. Both were wrong on published stages:

- **Skill levels.** The pinned CN tables (`data/arkpedia-device-source.json`, which now includes the artillery) give three skill levels:

  | Level | SP cost | Starting SP | Gain |
  |---|---|---|---|
  | 1 | 120 | 0 | +1/s |
  | 2 | 90 | 40 | +1/s |
  | 3 | 120 | 60 | +1/s |

  10-6, 10-7, 10-12 and 13-5 (normal and adverse) use level 3. TR-20 uses level 2. The others use level 1.
- **Hidden instances.** 10-4 places two artillery on one tile: `#1`, visible at level 1, and `#2`, hidden at level 3. The simulator ran both, so the stage fired twice as often. 10-4 adverse's `level_predefines_enable` rune turns `#1` off and `#2` on, so the stage starts with one level-3 gun at 60 SP.
- **Activations in a disabled hidden group.** AW-1's only artillery is hidden. It is activated by an `ACTIVATE_PREDEFINED` action in the `raid` hidden group, which normal AW-1 switches off. In the game it never fires there, but the simulator had it firing from the start.

## How it works now

- **Instance review.** The spec is now `staticLevelReview` with `skillLevels` 1 to 3. `selectStaticDeviceInstances` keeps only the instances that are active, from the original `hidden` flag or a `level_predefines_enable` toggle. Actions in a hidden group that the stage's rules switch off are ignored. A hidden artillery is kept when the actions that run switch it on by its own alias (`ACTIVATE_PREDEFINED trap_058_gunctrl#1`). It carries `scheduledActivation`, its alias joins the wave program's device aliases, and the battle keeps it off (no ticks, no charge) until the action runs. From then it charges from its own starting SP. Any other activation is still refused. AW-1 Challenge (`raid` on, wave 0) and `victoria_camp_r_23` (wave 2) are such stages.
- **Values.** `artilleryDefinition` (`shared/arkpedia/stage-artillery.js`) validates the instance (level 1, skill level 1 to 3) and reads the skill: `AUTO`, no blackboard, `INCREASE_WITH_TIME`, increment 1. The compiled device carries the instance. The battle sets each gun's starting SP and its own cost. `chargeStageArtillery` caps at that cost.
- **Unchanged.** The 3000 True blast, its shape and its targeting (PRTS).

## Verification

`test/arkpedia-artillery-levels.test.js`:
- **Skill levels.** The three levels match the table above. A level-2 instance, a skill level of 4 and missing instances are refused.
- **Instance selection.** Without the rune, 10-4's selection keeps `#1`. With it, the selection keeps `#2`, the level-3 gun. With `raid` off, the gun is dropped. With it on, the gun is kept hidden and switched on by its alias. An activation by the bare device key is refused.
- **Switched-on guns.** On the compiled AW-1 Challenge and `victoria_camp_r_23`, the one gun starts off at 0 SP and refuses charge. It stays at 0 until its wave action, then gains about 5 SP in 5 s.
- **Compiled stages.** One gun on each of 10-4, 10-17, 10-12, 13-5, TR-20 and 10-4 adverse:

  | Stage | Cost | Starting SP |
  |---|---|---|
  | 10-4 | 120 | 0 |
  | 10-4 adverse | 120 | 60 |
  | 10-12 | 120 | 60 |
  | 13-5 | 120 | 60 |
  | TR-20 | 90 | 40 |
  | 10-17 | 120 | 0 |

  On each, SP rises at least 1/s up to the cost, and a large charge caps at the cost. AW-1 has no artillery.

`test/arkpedia-stage-devices.test.js` now takes its 10-14 blast check from the compiled library stage. The frozen standalone `data/arkpedia-stage-10-*.json` files predate instances and are not served.

The library rebuild published 10-4 adverse, AW-1 Challenge and `victoria_camp_r_23` (1,070 available, none withdrawn). The frozen standalone files for every published artillery stage take the library's artillery entries (instance, alias, switch-on), so the legacy catalogue smoke runs the same devices. Every artillery stage changed bundle: 10-4, 10-6, 10-7, 10-8, 10-11, 10-12, 10-14, 10-15, 10-16, 10-17, 13-2, 13-4 and 13-5 (all normal and adverse), plus H10-1, H10-2, H10-3, TR-20 and AW-1.
