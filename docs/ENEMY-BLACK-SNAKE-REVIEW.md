# "Deathless Black Snake" and the Energy Aggregate

`enemy_1515_bsnake` has two database levels with the same talents and skills:
- level 0: 50,000 HP, 770 ATK, 800 DEF, 50 RES; used by JT8-3 and JT8-3 Challenge;
- level 1: 60,000 HP, 1,000 ATK, 800 DEF, 50 RES; used by H8-4.

Both levels are admitted from his pinned CN prefab: 101 components across his four native modes (Default, Reborn, ScreenAttack, FinalScreenAttack), eleven Global buff templates and `projectile_enemy_bsnake`. The clocks come from `refs/arts/enm_art_16.ab`:

| Clip | Length | Release |
|---|---|---|
| Attack_A/B | 2.33 s | 1.03 s |
| Skill_1_A/B (Ignite) | 1.97 s | 1.17 s |
| Skill_2_A/B (Detonate) | 1.97 s | 1.03 s |
| Skill_3 (SummonFlame) | 2.33 s | 0.90 s |

The runtime is the new `blackSnake` kind, attached through `talent:protect`. It claims the nine skill wrappers and the two Inferno screen-effect auras. The shared `talent:reborn` defers to his contract through `FORM_BOSSES`.

The rules not fixed by the data come from PRTS (`“不死的黑蛇”`, `能量聚合体`, the H8-4 page).

## Kit

- **Attack.** He targets one ground operator in range 2.0 and deals 100% ATK True damage at the clip's OnAttack. He then applies Burning Breath (talent `fire.attack@dragon_fire.*`).
- **Burning Breath (`dragon_fire`).** True damage every second, rising linearly from 50 to 230 over 30 s, for 30.5 s. Resistance cuts the duration; the tick interval and the ramp are fixed. A re-application refreshes the duration without stacking and without restarting the ramp (PRTS). Talulah's burn now uses the same helper, `server/sim/content/arkpedia-burning-breath.js`; her selectors never re-apply it, and her tests are unchanged.
- **Ignite.** 19 s, first at 19 s. Up to two operators anywhere (ground and air) that carry no Burning Breath. It needs at least one target.
- **Detonate (`DragonFireExplode`).** 35 s, first at 35 s. It casts even with no carrier. At the release, every unit carrying Burning Breath (PRTS: all carriers) goes through these steps in order:
  1. it takes 100% ATK Arts damage;
  2. its Burning Breath ends;
  3. the operators on its tile and the four orthogonal tiles around it (range `x-5`), except itself, take 100% ATK Arts damage and are re-ignited.

  A carrier killed by step 1 ends its own chain (PRTS: a failed step stops the rest).
- **Protect.** Damage from a unit carrying his own Burning Breath (`BUFF_SOURCE`) is reduced by 50%, multiplied by 0.5. A burn from another source (an Energy Aggregate's) does not count.
- **Casts.** He stands through each clip and does not attack. The cooldowns run from the cast start and restart from their initial values when the second form begins.

## Knock-outs

`_maxRespawnCnt` is 2.

- **First knock-out.** The current wave is released and he is tracked into the next one (`track_at_next_wave_when_buff_finish` on leaving Default). A 5 s revive follows. He comes back at full HP: the pinned `_hpRechargeRatio` of 0.5 is read as for the reviewed bosses, matching PRTS "恢复100%生命值". `reborn_up` gives +50% max HP and ATK. The first Deathless Inferno follows.
- **Deathless Inferno.**
  - Duration 28 s. He is invincible and unmovable (flags 5 INVINCIBLE and 22 UNMOVABLE_PRIVATE). He cannot be blocked, attack or cast.
  - Every 2 s, ten times, first at 2 s, a column of fireballs enters from the left border, one per row, flying right.
  - Each fireball: speed 2.5, collider 0.25, lifetime 60, through walls, up to 0.1 s random start. It hits the first operator it meets for 100% ATK Arts, at the enraged ATK.
  - After 28 s he returns in the second form with 15 s of invincibility.
- **Second knock-out.** The current wave is released (`finish_current_wave_when_buff_finish`, no tracking). He stays down 5 s, then the final Inferno runs. Its `InstantKill` is his real death.

## Second form: Energy Aggregates

**SummonFlame.** It runs only in the second form, every 50 s, first at 75 s, and ignores silence. It performs MoveNextLevelBranch with `_isLoop` on the stage's `bsnake_flame` branch:
- the next five hidden Energy Aggregates appear;
- after the seventh phase the branch starts again from the first;
- an alias whose earlier body withdrew comes back as a new body.

`StageBranchScheduler.advance` gains a `loop` option. The activation-branch compiler accepts `trap_021_flame` and repeated aliases for it only.

**Energy Aggregate (`trap_021_flame`).** It is pinned in `data/arkpedia-device-native-source.json` and `data/arkpedia-device-source.json`, and compiled as the device family `flameDefinition` (`shared/arkpedia/stage-flames.js`). Its runtime is `server/sim/content/arkpedia-stage-flames.js`.
- **Body.** Enemy side, category 1: operators can attack it ("容易受到我方单位的攻击"). 6,000 HP, 200 DEF, 20 RES.
- **Skill (`sktok_flame`).** Automatic, 25 SP at 1/s, starting at 0. It plays Die and fires four fireballs, up, right, down and left (`_useEightDirections` 0).
- **Fireball.** Speed 2.5, lifetime 60, one hit, through walls, collider 0.25. Each deals the skill's fixed `damage` as Arts: 1,000 at skill level 1 (JT8-3) and 1,500 at level 2 (H8-4). It then applies Burning Breath with the skill's values.
- **After firing.** The device withdraws (`flame_s[withdraw]`). Destroyed first, it never fires.

**`hint.location` / `hint.interval`.** These are the warning marks shown 27 s before each summon. They are injected presentation parameters: two native types and a strict format. The compiled stage test checks that each `hint.location` group equals the corresponding branch phase's tiles.

## Verification

`test/arkpedia-black-snake.test.js`:
- **Admission.** Both levels, with and without the stage hints, are admitted. A changed Protect value, a third life, a changed Ignite count, malformed hints and a zero interval are each refused.
- **Parameters.** Literal values for every block.
- **Attack.** True damage and the burn; a second hit refreshes the same burn.
- **Protect.** Damage is halved only from a carrier of his own burn.
- **Ignite.** At most the two operators without a burn, at the release after 19 s.
- **Detonate.** Two carriers each take 100% Arts and lose their burn. The orthogonal neighbour is hit and re-ignited; the diagonal neighbour and a far operator are not.
- **First knock-out.** The release is tracked. After 5 s he is at 1.5× max HP and ATK at full HP. He takes no damage through the Inferno. Thirty fireball hits (ten volleys over three occupied rows) land, none before 2 s, at the enraged ATK. He then enters the second form with 15 s of invincibility, and all three skills restart from their initial cooldowns.
- **SummonFlame.** The branch runs at 75 + 0.9 s, then every 50 s, and loops back to phase 1.
- **Second knock-out.** The release is not tracked; 5 s down, then the final Inferno, then death.
- **Energy Aggregate.**
  - Its pinned native passes review, and skill levels give 1,000 and 1,500 damage.
  - On its alias it spawns an enemy-side body with 6,000 HP; a repeat activation does not add a second one.
  - After 25 s its four fireballs hit the four operators around it for 1,500 Arts each and burn them, and it withdraws.
  - Re-activated, a new body appears. Killed early, it never fires.
- **Compiled stages.** H8-4 and JT8-3 in the library have:
  - levels 1 and 0, at 60,000 and 50,000 HP;
  - ten hidden branch-activated Aggregates at 1,500 and 1,000;
  - a seven-phase branch of five aliases each, matching the hint groups;
  - no battle errors.

**Headless run.** Both stages were run in full with the waves cleared and the civilians spared.
- **JT8-3:** revive at 40 s, Inferno, second form at 73.1 s, Aggregates at 148.9 s and 198.9 s, second knock-out, final Inferno, death. There were 20 Inferno hits and no errors.
- **H8-4:** the same through the second form. He then leaves by his route, because the script does not hold him.

The gallery review renders his body and 19 clips.

The library rebuild published H8-4 and JT8-3 (1,080 available, none withdrawn, no other bundle changed).

## Boundaries

- **Energy Aggregate art.** Its body is a Unity Animation graphic, not a Spine skeleton. The device model pipeline admits only single-Graphic Spine bodies, so it shows as a labelled marker. The Die clip is not timed, so its four fireballs leave when the charge completes.
- **Civilians.** The Ursus Civilians are enemy-side in the simulator, so fireballs hit operators only. PRTS's footnote names overlapping civilians as collision candidates; that is not modelled.
- **Detonate count.** The selector pins `_maxNum` 2, the same as Ignite's, but the stage text, the handbook and PRTS all say "all carriers". The runtime detonates every carrier. An in-game check with three or more carriers would settle it.
- **Protect source.** Only his own burns count (`_buffSourceType` BUFF_SOURCE). Burns applied by an Energy Aggregate do not reduce his damage taken.
- **Not published.**
  - JT8-3 Challenge waits on its `char_skill_blackb_add` rune: `trap_021_flame` damage +400.
  - The TN-4 boss-rush stages wait on the Entitative Program devices.
- **Presentation.** The Inferno screen effect, the hint marks and the bgm switch are not reproduced.
