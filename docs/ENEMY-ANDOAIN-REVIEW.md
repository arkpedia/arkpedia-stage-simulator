# "Martyr", Andoain

`enemy_1527_martyr` (two database levels: 27,000 HP / 750 ATK / 550 DEF and 38,000 HP / 900 ATK / 600 DEF; otherwise identical) is admitted from his pinned CN prefab and the Global buff templates. Its scope is in `extract-enemy-native-abilities.py`, which now also follows a projectile's `_scanSelector` and `_hitSelector`. That changed only `projectile_enemy_martyr_scan`.

The contract (`shared/arkpedia/enemy-andoain-features.js`) pins the following:
- every component reachable from the retained abilities (78);
- five templates: `enemy_martyr_bounce_to_wpnsts`, `enemy_martyr_smokebomb`, `enemy_martyr_smokebomb_trigger`, `enemy_spmode_sp_reduce` and `track_at_next_wave_when_buff_finish`;
- six projectiles;
- the `x-1`, `x-4` and `0-1` ranges;
- the clip clocks from `refs/arts/enm_art_17.ab`.

The only components the extractor leaves out are the visual bone followers and a steering component.

The runtime is the new `andoain` kind. The rules not fixed by the data come from PRTS (`“殉道者”，安多恩`), named below.

He cannot be blocked (the existing trait). He attacks at range 2.5 and hits both ground and aerial units (`_targetMotion` 3). He stands for the Attack1 clip: 2.4 s, strike at 1.6 s.

## Ammo and bouncing rounds

- **Ammo account.** He has an SP account of 5/5 that does not regenerate (`sp`: max 5, initial 5, increment 0). It is shown as rounds (`_showSpAsBulletMode`) through the shared `enemyAmmo` account.
- **With a round (`BounceAttackP1`/`P2`, SP cost 1).** The attack fires a bouncing round instead of the plain shot.
  - The round travels at speed 7 and hits for 1.5× ATK physical damage.
  - A Gelato Stop (`TAG_TRAP_WPNSTS`) also takes the `enemy_martyr_bounce_to_wpnsts` hit: 5× ATK physical, apply-way none.
  - 0.15 s after each hit (`_perDamageInterval`), the round picks a random selectable unit within the `x-4` square (the eight tiles around the one just hit). Gelato Stops come first. It never picks the unit just hit (`_canSelectAllExceptTracetarget`), so between two targets it goes back and forth.
  - It hits at most `times` (5) times in total, the PRTS reading ("至多命中5次").
- **Without a round.** The attack is a plain 1× shot at speed 10.

## Light Unto Sufferers

- **Trigger.** `HpRatioTrigger` fires each time the HP lost reaches an integer multiple of `hp_ratio` × max HP: 0.5 in the first form, 0.25 in the second. There is no target choice and no tally.
- **Placement.** It runs `SmokeBomb`. The field's tile is taken at cast: his own tile (`0-1`). After 1.45 s it becomes a permanent `x-1` field.
- **Effect.** Every 0.3 s, units of his side standing on it get the 0.6 s `enemy_martyr_smoke_bomb` buff. This includes him and untargetable units.
  - The buff is a `prob` (0.5) Physical and Arts dodge, and Physical and Arts damage taken × `damage_scale` (0.7). This is the native Evade, then DamageScale if not evaded.
  - It does not stack.
- **Lifetime.** The fields are battle state (`battle.andoainFields`) and outlive him.

## Revive and second form

- **Revive.** The revive component (`_hpRechargeRatio` 1, `_modeIndex` 1, `Reborning` with the Revive clips) brings him back after `Reborn.duration` (5 s) at full HP. PRTS agrees ("恢复100%生命值").
- **On standing up.** M2's `PassiveP2` applies:
  - `track_at_next_wave_when_buff_finish`: `FinishCurrentWave` with `_trackSourceAtNextWave`, through `stageWaveScheduler.releaseCurrentWave`;
  - ATK +`PassiveP2.atk` (20%, a MULTIPLIER modifier);
  - `martyr_p2_invincible` for `recovery_time` (20 s).
- **Second-form fields** come every 25% of max HP lost, counted from full HP.

## Ashes to Ashes, Dust to Dust (`NoonArrived`, second form only)

- **When.** Cooldown 70 s, initial cooldown 0. It casts only while some selectable operator is on the field (a global trigger). He stops attacking and moving for the whole cast.
- **Scan.**
  - It starts after Skill_1_Begin (0.2 s).
  - A 0.5 × 20 line (offset −0.4) sweeps the field's columns (`battle.grid.rect`) from left to right in `projectile_life_time` (10 s).
  - Every 0.2 s it locks at most one selectable operator it touches (ground or aerial; the scan selector's `_maxNum` 1), 5 at most (`_maxHitNum`).
  - Within a column the topmost goes first. Compiled rows are bottom-origin, so that is the higher row.
  - Locked units carry `enemy_martyr_skill_select_mark` for `duration` (12 s).
- **Shots.** At Skill_1_End's strike (1.033 s after the scan), every locked unit that is still selectable and marked takes a speed-10 shot: 2× ATK physical, and Gelato Stops a further 10×.
- **Reload.** At the end of Skill_1_End (2 s) his Ammo is restored by `sp` (5, `enemy_spmode_sp_reduce`) and the marks are removed.

## Stage values

FD-8 Challenge adds −0.35 to `SmokeBomb.damage_scale` (to 0.35), and GA-EX-8 Challenge adds +0.25 to `SmokeBomb.prob` (to 0.75), through `enemy_talent_blackb_add`. `talent:SmokeBomb` declares both keys as stage additions, and the contract accepts values in [0, 1]. Every other value stays pinned.

## Registration

`talent:Reborn`, `ability:First Form` and `ability:Second Form` are shared keys. They now defer to a list of form bosses (Emperor's Blade, Andoain) whose own contracts implement their forms. For these bosses Pancho's ability and wrapper claim no longer apply.

Each level compiles to one ability plus the unblockable trait. `talent:SmokeBomb` claims the three skill wrappers.

## Verification

`test/arkpedia-andoain.test.js`:
- **Admission.** Both levels are admitted. Records are refused for a changed revive, a changed SP account, a changed scan interval or a changed wave-release node; the two challenge additions are admitted.
- **Bounces.** A round hits 5 times at 1.5×, goes to the Gelato Stop first, and adds the 5× station hit. Between two units it goes back and forth; alone it hits once; with no Ammo he fires a plain 1× shot.
- **Field.** The field appears on his tile 1.45 s after the 50% threshold and protects him and a neighbouring slime (dodge 0.5, taken ×0.7), not operators.
- **Revive.** He revives in 5 s at full HP with +20% ATK and 20 s of invincibility, calls the wave release once, and casts a field at a further 25%.
- **Scan.** It locks five operators left to right, the top one first within the last column. It hits them for 2×, adds 10× on the station, and reloads to 5.
- **Compiled GA-8.** Holding him in place, 120 s after a knock-out brings more spawns than 120 s without one: the revive released the wave. FD-8 shows no difference, because its waves do not wait on him.

The library rebuild published exactly five more stages: FD-8, FD-8 Challenge, GA-8, GA-EX-8 and GA-EX-8 Challenge (988 available). `check-stage-library.mjs` smoked all 988 graphs with no failures, the browser review passed, and GA-8 opens in the preview.

## Boundaries

- **Bounce timing.** Each hop travels at speed 7, and the next search waits 0.15 s after a hit. `_speedAfterFirstReach` (1) is not read.
- **Lost targets.** A round whose target is gone before arrival fizzles. The native `_useMapPosIfTargetInvalid` would continue the chain from that position.
- **Cast length.** The cast lasts the clips (0.2 + 10 + 2 = 12.2 s); the blackboard `duration` is 12 and only times the marks.
- **Sweep timing.** The sweep spans the field's column rectangle linearly. The native moveType 3 path is not decoded.
- **Dodge.** Packets that cannot be dodged (`canDodge` false) skip the field's dodge but still take its ×0.7.
