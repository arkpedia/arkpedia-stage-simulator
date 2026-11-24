# "The Last Steam Knight"

`enemy_1533_stmkgt` has two database levels:
- **Level 0:** 65,000 HP, 1,600 ATK, 2,000 DEF, 40 RES. Used by 11-20 and its adverse variant.
- **Level 1:** 80,000 HP, 1,800 ATK, 2,400 DEF, 40 RES. Used by H11-2 adverse and H11-4 adverse.

All four stages are published.

Level 1 lists only `reborn.def` (-2,000) and its Boost (40/40 s, hard). Like the other sparse higher levels, it is read over level 0: talents by key, skills by prefab key. PRTS lists the full kit for both levels.

Both levels are admitted from his pinned CN prefab:
- 78 components across four native modes: First, Second, HeroBomb_1 and HeroBomb_2;
- fifteen buff templates;
- `projectile_enemy_stmkgt_s`.

The clocks come from `refs/arts/enm_art_17.ab` (`data/arkpedia-stmkgt-animations.json`):

| Clip | Length | Release |
|---|---|---|
| Attack_A/B | 2.0 s | 1.13 s |
| Boost_A | 1.0 s | effects at the cast start |
| Skill_1_Begin_A/B (Zantetsuken charge) | 5.0 s | |
| Skill_1_Attack_A/B | 2.5 s | 0.7 s |
| Skill_2_Begin_A/B (take-off) | 1.2 s | |
| Skill_2_End_A/B (landing) | 1.5 s | |

The runtime is the new `steamKnight` kind (`server/sim/content/arkpedia-enemy-steam-knight.js`). It is attached through `skill:Boost`, the only feature key both levels carry. The shared `talent:reborn`, `ability:First Form` and `ability:Second Form` defer to his contract through `FORM_BOSSES` and `FORM_BOSS_ROOTS`.

## Kit

- **Attack.** The blocked operator takes 100% ATK physical. Each attack gives +1 SP (`INCREASE_WHEN_ATTACK`, max 4).
- **Debut (`BornWeak`).**
  - Attack speed -50 and movement ×0.5 (formula MULTIPLIER, PRTS "-50%").
  - Only his first Boost ends it (`stmkgt_t_finish_weak`). A knock-out does not.
- **Boost (first form only).**
  - Timing: cooldown 45 s, first at 25 s; level 1 40/40. It needs no target. Its effects start with the cast, and the cooldown runs from the cast start (PRTS: "技能释放后立刻进入冷却").
  - For 15 s: attack speed +100 and movement ×1.3, with immunity to stun, silence, disarm, freeze, cold, levitation and sleep.
  - `is_hard_level` (`enemy_stmkgt_boost[buff]`) decides how it ends:
    - "true": 30% damage resistance for the duration, and no stun.
    - "false": a 5 s self-stun when it ends, in the first form only.
  - PRTS H11-2 and H11-4 adverse confirm the hard reading: "【蒸汽增压】期间受到伤害降低，且结束时不再眩晕".
- **Zantetsuken (SP 4).**
  - He locks the blocked operator.
  - Skill_1_Begin charges until the skill's `duration` (7 s) less Skill_1_Attack (2.5 s), which is PRTS's 4.5 s. At Skill_1_Attack's OnAttack he deals three hits of 125% ATK physical, at 5.2 s.
  - A stun or knock-out ends the cast; the SP is spent.
- **HeroBomb (誓死).**
  - **Trigger.** He has lost the talent's ratio of max HP since the mark: 50% in the first form, 30% in the second. The mark is set at spawn, at the revive and at the end of each HeroBomb (`MarkCurrentHpRatio`, `HpRatioTrigger` GT).
  - **During Zantetsuken** the HeroBomb waits until the cast ends (`stmkgt_s_zantetsuken[flag]`).
  - **While airborne** he is invincible, untargetable, unblockable and unmovable, and immune to stun, silence, freeze, levitation, tremble, palsy and sleep. Control already on him is cleared.
  - **Sequence:**
    1. Skill_2_Begin (take-off).
    2. An 8 s mark on the 1 (first form) or 2 (second form) ground operators with the highest max HP.
    3. A bombard area on the 3×3 tiles (`x-4`, PRTS "9格") around each operator selected again at that moment.
    4. Skill_2_End; he lands where he took off. His form returns, and the Boost cooldown restarts from its initial value.
  - **Bombardment** (`projectile_enemy_stmkgt_s`): every 0.5 s (first after 0.5 s) for 5.5 s, the unit in the area with the highest HP ratio is hit, ground or air. The damage, 50% (first form) or 40% (second form) ATK Arts, lands 0.2 s later (`stmkgt_s[damage]`). There are at most 8 hits, so an area with a target throughout ends after 4 s.
  - **Hard level** (`is_hard_level` "true", `stmkgt_s[hero_hard]`): each area's buildable tiles become Sealed Ground (`trap_055_tileblock`, 封印的地面), with no deployment there for the rest of the battle. An occupied tile cannot take the token, so units already there stay. PRTS H11-4 adverse: "封锁范围内无单位的区域".
  - **Cooldowns.** The skills' 0 and 99999 initial cooldowns change nothing. TriggerEnemySkill casts them: `HeroBomb[second_state]` has 99999/99999 in the database and still runs on every revive.
- **Revive (`_maxRespawnCnt` 1).**
  - The first knock-out releases the current wave without tracking. He holds for 8 s, then returns at full HP in the second form.
  - He gets 15 s of invincibility.
  - The permanent boost (`stmkgt_boost[second]`):
    - attack speed +100;
    - movement +0.3, formula ADDITION, so 0.5 → 0.8;
    - DEF -1,500 (level 1: -2,000) and RES -40;
    - the same control immunity as Boost;
    - 30% damage resistance when `reborn.is_hard_level` is "true".
  - 0.1 s later comes a HeroBomb (`stmkgt_t[reborn_bomb]`).
  - The second knock-out is his death.

## Stage parameters

**Stage skill lists change the named skills in place and keep the rest.** The ordinary rule replaces the database list. 11-20 names only the two HeroBombs, and PRTS lists Boost and Zantetsuken there. The accepted overrides:

| Stage | Talents | Skills |
|---|---|---|
| 11-20, 11-20 adverse | `reborn.is_hard_level` "false" | both HeroBombs `is_hard_level` "false" |
| H11-2 adverse | none | both HeroBombs `is_hard_level` "false"; `HeroBomb[first_state]` `initCooldown` 99999 |
| H11-4 adverse | `reborn.move_speed` 0.5 | Boost `initCooldown` 25 |

- `stageStringOverrides` and `stageSkillStringOverrides` are new. They accept a changed string only for an existing string parameter of the same entry, and only where the feature declares the key; `is_hard_level` takes "true" or "false".
- `stageSparseTalents` is new: a stage talent override on level 1 is checked against the level-0 overlay.

## Verification

`test/arkpedia-steam-knight.test.js`:
- **Admission.** Both levels are admitted. A changed HeroBomb ratio, two revives and a third bomb target are each refused.
- **Parameters.** Literal values for level 0, the level-1 overlay and all three stage overrides. A string other than "true"/"false", an undeclared string key and a HeroBomb initial cooldown of 5 are refused.
- **Debut and Boost.** He boosts at 25 s; the debut slow ends; attack speed rises by 150 in all; he refuses a stun. After 15 s comes a 5 s self-stun, and the next Boost follows 45 s after the first cast.
- **Hard Boost.** A 1,000 damage hit takes 700, and there is no stun.
- **Zantetsuken.** It casts after four attacks, with three phys hits at 5.2 s and the cast ending at 7 s.
- **HeroBomb.** It fires at 50% HP: invincible, palsy-immune, 1.2 s + 8 s, then 8 Arts hits at 50% ATK. The first goes to the highest HP ratio in the area, and the far operator is never hit. The new mark is his HP after landing.
- **Hard HeroBomb.** It seals the eight empty tiles around the operator, not the operator's own tile.
- **Zantetsuken delay.** A trigger during Zantetsuken waits for the cast to end.
- **Revive.**
  - The wave is released; 8 s later he is in the second form at full HP, with 15 s of invincibility and DEF -1,500.
  - He is stun-immune, and a HeroBomb comes at once on two targets.
  - The second knock-out kills him.
- **Compiled stages.** H11-2 and H11-4 adverse: level 1 at 96,000 HP (×1.2 rune). 11-20: level 0 at 65,000 HP. 11-20 adverse: 78,000 HP. Each has its literal Boost, bomb and revive values and no battle errors; 11-20's branches spawn no seed.
- **Inert payload rule.** It refuses a level with Twigs placed or as a hard-level card, a branch with another enemy or two seeds, and a level without branches.

**Headless runs.** Waves were cleared and his HP drained.
- **H11-2 adverse:** five Boosts and no stuns, 57 Zantetsuken hits, first-form HeroBomb at 50%, the revive, four second-form HeroBombs (at entry, 70%, 39% and 9%), death, and no errors.
- **H11-4 adverse:** four Boosts, the first-form HeroBomb sealed tiles, and no errors. He then leaves by his route, because the script does not block him.

The gallery review renders his body and 21 clips.

The library rebuild published H11-2 adverse and H11-4 adverse (1,084 available); no other available stage changed.

## 11-20 and 11-20 adverse: the inert Twigs payload

Both levels keep four branches, `route1`–`route4`, each a single Corrupted Seed (`enemy_1266_nhapos`). That is the Twigs payload (`trap_086_larva`), but these levels place no Twigs: none in `predefines` or `hardPredefines`, as an instance or a card. No wave action, device, template or enemy prefab in them names a branch (the chapter-11 enemies' prefabs were inspected). PRTS's 35 targets match the waves without the seeds, and the levels have no database entry for the seed.

`inertTwigsPayload` in `tools/arkpedia/stage-branches.mjs` accepts exactly that case:
- it still validates and consumes the viewer's branch entries;
- it compiles each branch as a no-op (`{ spawns: [] }`, as for the unreferenced activation branches);
- it drops the viewer's unused seed configuration.

Any other unbound branch still fails; AK-4 and IG-7 keep their branch blockers. Among the cached original levels only these two match, and the rebuild published only them (1,086 available).

**Headless runs.**
- **11-20:** three Boosts. The first ends in the 5 s self-stun. The second ends during the HeroBomb, where he is immune. HeroBomb at 50%; no errors.
- **11-20 adverse:** the same, with no errors.

## Boundaries

- **Assumptions:**
  - A HeroBomb restarts the Boost cooldown from its initial value, read from the FSM restart as for the Black Snake.
  - The bombardment area is `x-4` (3×3); the projectile's selector has no range of its own.
  - Ties in max HP and HP ratio go to the earlier-deployed unit.
- **Presentation.** Sealed tiles have no tile marker yet, only the deployment refusal. The mark, the range effect and the shadow toggles are not drawn.

## Steam Knight S (11-19)

`enemy_1534_stmkgt2` (level 0: 60,000 HP, 1,600 ATK, 2,000 DEF, 40 RES, BAT 7.5, life cost 0, no ability lines) is 11-19's scripted knight. He shares the Steam Knight's skeleton and clocks and is admitted from his own pinned tree: 44 components, two modes (Second and HeroBomb), and his own templates. The same `steamKnight` runtime runs him through these parameters (`steamKnightSParams`), held by `skill:HeroBomb[failure]`.

- **Entry.** His talent `kill` (`stmkgt2_t[failure_level_buff]`, `InstantKill`) kills him on spawn. His one revive (`_maxRespawnCnt` 1, `reborn.duration` 8 s, `_hpRechargeRatio` 1) brings him back at full HP. Invincibility is 0 s and no HeroBomb follows. PRTS: "出现并进入重生状态".
- **Boost (`stmkgt2_boost`).** Attack speed +200 and movement ×1.3 (formula MULTIPLIER), with control immunity, for `boost_duration` 999 s. When it ends, DEF -1,400 and RES -40 (`stmkgt2_after_boost[weak]`).
- **Checkpoint (`stmkgt2_reach_checkpoint`, every 0.1 s).** Once he has reached his route's checkpoint 1 counted from the end, `MoveNextLevelBranch` runs on `reborn.branch_id` (`allady`). In 11-19 that is (5,4), just before Siege, and the branch makes the protection-point Allerdale's Guard appear. The compiled route repeats the end tile as an ordinary leg; it is not counted.
- **Zantetsuken.** SP 3; three hits of 120% after charging until 8 s less Skill_1_Attack.
- **HeroBomb[failure].** At 50% HP: one ground target, 20% ATK, no sealing.
- **Second knock-out.** It is his death.

**Tests.**
- Admission, with a changed branch id refused; literal parameters.
- Spawn into an invulnerable, unmovable 8 s revive, then full HP with no invincibility, attack speed +200 and stun immunity.
- The branch advances once, only after checkpoint index 5.
- The compiled 11-19 run.

## 11-19

11-19 (直指命运) has a fixed squad of no operators, 3 starting DP and 1 life point. Four operators are preplaced: Dagda, Totter, Hibiscus and Siege. Three Allerdale's Guards are hidden instances (`docs/STAGE-ALLERDALE-GUARD-REVIEW.md`):

| Alias | Tile, facing | Skill | Switched on by |
|---|---|---|---|
| `trap_087_allady#1` | (5,6) left | barrier | wave 0 at 56 s |
| `trap_087_allady#3` | (2,9) left | barrier | wave 1 |
| `trap_087_allady` | (5,6) right | protection point (no effect) | the `allady` branch |

A hidden Guard card (`#2`) is never revealed.

**Compiler changes:**
- Guards may share a tile, so their instances are keyed by alias, and the viewer's alias-less entries match the original instances in order.
- A single activation's `interval` is ignored, because it is moot when the count is 1. That also opened `lk-dp-d` (FrostNova's Ice Crystals) and `vi-5` (Faust's Turrets), whose branch actions carried `interval` 1. Both run without errors.

**What the tests check:**
- Guard `#1` shields Siege and Dagda at 59.2 s.
- Unassisted (no skills used), the preplaced operators fall to the turret and the Withered, and the knight walks his route. Past (5,4) the protection-point Guard appears, he walks into the goal at no life cost, and the stage clears without errors.
- In the game, the player uses the operators' skills; PRTS: "推进之王阻挡<蒸汽骑士S>".
