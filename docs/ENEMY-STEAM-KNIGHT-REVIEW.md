# "The Last Steam Knight"

`enemy_1533_stmkgt` has two database levels:
- **Level 0:** 65,000 HP, 1,600 ATK, 2,000 DEF, 40 RES. Used by 11-20 and its adverse variant (not published yet, see Boundaries).
- **Level 1:** 80,000 HP, 1,800 ATK, 2,400 DEF, 40 RES. Used by H11-2 adverse and H11-4 adverse, both published here.

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
- **Compiled stages.** H11-2 and H11-4 adverse: level 1 at 96,000 HP (×1.2 rune) with the literal Boost, bomb and revive values, and no battle errors.

**Headless runs.** Waves were cleared and his HP drained.
- **H11-2 adverse:** five Boosts and no stuns, 57 Zantetsuken hits, first-form HeroBomb at 50%, the revive, four second-form HeroBombs (at entry, 70%, 39% and 9%), death, and no errors.
- **H11-4 adverse:** four Boosts, the first-form HeroBomb sealed tiles, and no errors. He then leaves by his route, because the script does not block him.

The gallery review renders his body and 21 clips.

The library rebuild published H11-2 adverse and H11-4 adverse (1,084 available); no other available stage changed.

## Boundaries

- **11-20 and 11-20 adverse.** Their four `route1`–`route4` branches spawn Corrupted Seeds (`enemy_1266_nhapos`), the Twigs payload, but the levels place no Twigs and no wave, device or enemy names those branches. PRTS's 35 targets match the waves without them. They stay blocked until the branch compiler accepts that exact case.
- **Assumptions:**
  - A HeroBomb restarts the Boost cooldown from its initial value, read from the FSM restart as for the Black Snake.
  - The bombardment area is `x-4` (3×3); the projectile's selector has no range of its own.
  - Ties in max HP and HP ratio go to the earlier-deployed unit.
- **Presentation.** Sealed tiles have no tile marker yet, only the deployment refusal. The mark, the range effect and the shadow toggles are not drawn.
- **Steam Knight S** (`enemy_1534_stmkgt2`, 11-19) shares his skeleton but has its own kit (branch `allady`, HeroBomb[failure]); it is not admitted.
