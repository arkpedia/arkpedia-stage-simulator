# 14-18, the Kindling Revenant

14-18 "Roaring Inferno" is a boss stage built on one enemy and two devices that work only together. It needed:
- **Both forms of the Kindling Revenant** (PRTS 引火的死魂灵): `enemy_1553_lrdead_2` (the first form, the wave's enemy) and `enemy_1553_lrdead` (the second form, summoned by the first).
- **Torrent Beam Activator** `trap_160_lrlgun` (PRTS 洪流束激发器) and **Core Amplifier** `trap_159_lrcore` (PRTS 核心增幅器).
- **The beam system** `env_v050_mainline14_lrdeadP2Ctrl`, named by the level's `env_system_new` rune.
- **A branch that runs one phase at a time** (`MoveNextLevelBranch` on a spawn branch).

This batch publishes 14-18 and its adverse variant (1,183 available; main story 451 of 564). H14-3 uses the same enemy and devices with other numbers and stays blocked.

## The one rule that is not in the data

The beam system is compiled game code. Its prefab holds effect names only, and its numbers come from the rune. No retained data says where the red and gold beams meet. PRTS and the EN wiki say only that it depends on the energy difference and that each energy step moves it one tile.

The rune gives `difs` 0 to 6 and `offsets` 1 to 7. `revenantBeamReach` (`shared/arkpedia/stage-kindling-revenant-beams.js`) reads them as follows [inference]:
- **Before the first core skill** the red beams reach the guns (columns 4 to 10).
- **After it**, with the allies ahead by d (0 to 6; behind counts as 0), the gold beams reach `offsets[d]` columns from the guns. The red beams cover the rest.
- **The gold beams reach the Revenant** only at their furthest, with the allies 6 or more ahead.

Why this reading:
- The cores start the second form charged, so four skills put the allies 3 ahead at once. The beams then meet mid-field and the tug of war begins.
- The Revenant casts once more at 40% HP. One cast pushes the gold beams off it exactly when they have just reached it.

Against this reading:
- H14-3 keeps `offsets` 1 to 7 with its guns one column further right (column 12) and the red beams still starting in column 4. There the gold beams' furthest reach stops one column short of the red beams' start.

The other reading (the red beams reach `offsets[enemy lead]` columns, and any ally lead reaches the Revenant) fits H14-3's columns but would end the second form with those first four skills. It needs an in-game check.

## Devices

`shared/arkpedia/stage-kindling-revenant.js` reviews both from the pinned prefabs, the skill prefab `sktok_lrcore`, two beam projectiles and the records.

**Torrent Beam Activator** (enemy side; nothing can target it; 20,000 HP)
- **Beam:** 0.5 s after it is fired it runs down the gun's row to the left, through walls. Every second it touches each ally unit in the row that is not a device.
- **Damage:** only the unit with no other ally to its right takes Arts damage of the gun's ATK. That is the unit nearest the gun.
- **ATK:** the first form's ATK (150; 180 in the adverse variant), +20 for each absorbed Soul Maelstrom, +100 from the fourth Soul Echo on.

**Core Amplifier** (enemy side; operators can attack it; 5,000 / 15,000 / 22,500 / 30,000 HP by level, 200 DEF, 20 RES)
- **Always:** immune to Stun, Freeze, Silence, Cold and Disarm; cannot be healed; its own side cannot select it (ALLY_TARGET_FREE), so a Chalice of Regret beside it takes none of its damage.
- **Tiles:** nothing can be deployed on a gun's or a core's tile.
- **In the first form:** invincible until a Soul Echo exposes it; its HP cannot fall below 1; its skill is locked.
- **Soul Maelstroms:** a ground Soul Maelstrom within 0.7 of a core is absorbed.
- **In the second form:** full HP, takes no damage, gains 1 SP for each hit taken, and has taunt -1 while its SP is full.
- **Skill** (25 SP, starts at 25; the player activates it from the device panel): 1 ally energy. The first use starts the gold beams. The other cores are locked for 1.8 s.

## The first form

`shared/arkpedia/enemy-kindling-revenant-features.js` (`revenantFirstNative`); runtime `server/sim/content/arkpedia-stage-kindling-revenant.js`. It stands on its tile, invincible, and does not attack.
- **Soul Echo** (forced 0 s in, then 90, 80 and 60 s after the guns stop): the five guns fire and one core is exposed, in the order of the cores' skill levels.
- **Breaking a core:** every 0.5 s an exposed core at 1 HP is broken. It is invincible again, and the level branch `branch_1` runs its next phase. The fourth core names no branch.
- **The controller** checks every 1 s. After a break it stops the guns and times the next Soul Echo.
- **Absorbed-soul ATK** is cleared when the guns stop after the first, second and fourth Echo. The third gun mode has no clearing step, so that ATK carries into the fourth Echo.
- **All four broken:** the guns shut down and the cores stop absorbing. 5 s later the wave is released and the second form appears on the first form's tile.
- **Deadline:** 500 s in, unless the second form was called, 99 life points are lost.

**The branch.** `tools/arkpedia/stage-branches.mjs` now accepts a multi-phase branch bound by Core Amplifiers: one phase for each core that names it. The viewer lists such phases one after another, each starting at the previous phase's last spawn; the compiled phases keep their own clocks. Branch enemies are not counted.

**A builder fix found on the way.** `tools/arkpedia/build-stage.mjs` took a branch's routes and enemy records from its first phase only. A later phase's enemy then had no record (the Chalice of Regret spawned with placeholder stats) and no compiled path (it skipped its scripted wait). Every phase now counts. This also gives nine published chapter-13 stages (13-7, 13-11 adverse, 13-14, 13-18, 13-21 and their variants) the paths of their Altars' and Throne's later random phases.

## The second form

`revenantSecondNative`; runtime `server/sim/content/arkpedia-enemy-kindling-revenant.js`. 500,000 HP, a 3.95 × 4.95 body centred 0.5 left of and 2 above its tile, no attack.
- **Appearing:** it is not in play for its first 3 s [inference from `_delayToBorn`].
- **First cast** (3.84 s; the trigger 1.84 s in): the beams start with 1 enemy energy, and every core switches to its second mode.
- **Raging Souls:** first 12 s after that cast ends, then every 15 s (the trigger 2.84 s in). Each adds 1 enemy energy. The cooldown is counted from the cast's start [inference].
- **Low HP:** once, at 40% HP or less, one more cast.
- **Deadline:** 200 s after it appears, Arts damage of its ATK to every operator, then 99 life points are lost.
- **Death:** the beams stop; within 1 s the first form dies too.
- **Its tile-blocking token** (`trap_055_tileblock` in the prefab) is not modelled: no tile under its body (columns 0 to 3) can be deployed on.
- **Placed alone** (the enemy test stages have no guns or cores): the first form only stands there; the second form's casts reach no beam system, and its deadline still runs.

**Beam damage** (every 1 s, without a source):
- **Red:** min(400, 150 + 25 × (enemy energy − 1)) Arts damage to each ally unit in a red tile that is not a device.
- **Gold:** the same from the ally energy, as true damage, to each enemy in a gold tile. The Revenant takes it × 100 while the gold beams reach it.

Only 14-18's rune values are accepted (`compileRevenantBeamRule`). H14-3's differ (guns in column 12, other damage numbers, × 60), and its cores use levels 5 to 8. Both enemy record levels are reviewed, but H14-3 stays refused by the rule and the core levels.

## Checked

`test/arkpedia-stage-14-18.test.js`:
- **Reviews:** the gun, core and system reviews pass. A faster beam, another core HP and a cheaper core skill are refused. The rule compiles 14-18's values and refuses H14-3's.
- **Beam reach:** the table above, including that one enemy cast pushes the gold beams off the Revenant.
- **Compile:** 14-18 and its adverse variant; four cores with their levels and branches; five guns; the three branch phases; the second form carried by the stage; H14-3 blocked.
- **Soul Echo:** the guns fire 0.5 s in. In Wiš'adel's row only she is hit, once a second, for 150 before RES. With her gone the next unit takes it.
- **Breaking a core:** invincible again within 0.5 s, 19 Soul Maelstroms from the first phase (none counted), the guns stop, and the next Echo comes 90 s later.
- **Absorbing:** +20 gun ATK, cleared after the first and second Echo, kept after the third, +100 at the fourth.
- **Second form:** it appears 5 s after the last break on tile 1,1 with its body. Its first cast starts the beams 4.84 s later; Raging Souls follows on its clock.
- **Beams:**
  - Red damage to an operator.
  - A core skill: its cost, the 1.8 s lock, 1 SP for each hit, no damage taken, taunt -1 while full.
  - Gold true damage to an enemy; × 100 to the Revenant only 6 ahead.
- **The end:** the low-HP cast, then its death stops the beams, ends the first form, and the stage clears.
- **Deadlines** with the real 3 life points: defeat at 500 s (first form) and about 201 s after the second form appears.
- **Adverse:** the guns fire at 180 ATK; the core HP does not change. A helper-driven run absorbs Soul Maelstroms and brings out the second form with 600,000 HP.
- **Branch phases:** every phase of 14-18's branch and of 13-14's random branches has its paths and enemy records.
- **Chalice of Regret:** it arrives with its 100,000 HP, waits on 3,7, and takes nothing when the core beside it is hit.
- **An operator's own attacks** charge a second-mode core (Wiš'adel on the core at 5,9); deploying on a gun's tile is refused.

**In the browser:** the stage opens with Wiš'adel placed, four cores and five guns as markers; the guns' rows are tinted while they fire; a core's panel shows "Exposed · 5000 HP" with Activate disabled in the first form. In the second form (reached with a temporary hook that broke the cores, since removed) the red tiles cover columns 4 to 10; a real click on Activate started the gold beams and left the core at "0 / 25 SP", disabled as "charging"; after four skills the tiles showed red on columns 4 to 6 and gold on 7 to 10. No console errors.

## Not checked

- In game.
- **Inferences**
  - **The beam meeting rule** (above). This decides how hard the second form is.
  - **The 3 s appearance** of the second form: untargetable and invincible meanwhile.
  - **Raging Souls' cooldown** counted from the cast's start.
  - **Core SP:** every hit an opposing unit lands gives 1 SP, including hits that deal no damage. Necrosis-type injury gives none.
  - **Wiš'adel's summoned shadows** count as units for the guns, so a shadow can be the first unit in its row.
- **Simplifications**
  - The first form's Soul Echo takes effect when it is forced; its attack animation's event time is not retained.
  - The first form can be targeted (it is invincible), as the data has it.
- **No art:** the guns and cores draw as markers, the beams as coloured tiles. The Revenant's own cast animations are not played.
- **With no player input** Wiš'adel breaks the first core and then falls to the guns; the three Infused Soul Husks leak at about 210 s.
