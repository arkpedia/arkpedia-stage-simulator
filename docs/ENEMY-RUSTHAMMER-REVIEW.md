# Rusthammer Warrior (`enemy_2006_flsnip`)

An Integrated Strategies boss: 40,000 HP, 1,200 ATK, 550 DEF, 40 RES, speed 0.4, attack range 20 (the whole map), silence-immune. It alone blocked the ISW-DF stage "Hunting Group" (`isw-df_level_obt_roguelike_ro2_level_rogue2_b-8`); RM-H2 still has other blockers. Its kit is Faust's, through the shared `faust_*` buffs; Faust himself is not admitted yet.

It is admitted from its pinned CN prefab. `shared/arkpedia/enemy-rusthammer-features.js` holds the contract. It pins:
- the record (talent `invincible`, skill `CriticalHit`);
- every component reachable from `Attack`, `Trigger`, `Invincible`, `Log`, `CriticalHit`, `SummonBallis` and `BlockFree`;
- the templates `log_killed` and `empty`;
- `projectile_enemy_flsnip` and `projectile_enemy_flsnip_s1`;
- the Attack and Skill_1 clips from `refs/arts/enm_art_17.ab` (both 3 s, release at 1.333 s).

The runtime is `server/sim/content/arkpedia-enemy-rusthammer.js`, kind `rusthammerWarrior`. The native claims match the counts exactly: two wrappers (`CriticalHit`, `SummonBallis`) and one active ability.

## Abilities

The abnormal-flag numbers were read from the pinned status dump (`Tim23333/Arknights_timer` `2e5c4306`, SHA-256 `0cd60676…`, as in `koromaru-status-source.mjs`).

1. **Invincible.** `faust_t_invi` carries abnormal flag 5 = INVINCIBLE for `invincible.duration` (60 s). The buff is silenceable, so a silence would end it early, but Rusthammer is silence-immune.
2. **BlockFree.** `faust_c_blockfree` lasts for life: flag 3 = BLOCK_FREE, and combo immunity 0 = SLEEPING. Rusthammer is unblockable and sleep-immune.
3. **Attack.** Physical bolts (`projectile_enemy_flsnip`: speed 10, lifetime 5, traced single hit) on the Attack clip.
4. **CriticalHit.** Cooldown 18 s, initial 18 s; its wrapper ignores silence. Its trigger is the same scalable range-1 selector as the attack's, so once ready it takes the next attack. That attack plays Skill_1 and fires `projectile_enemy_flsnip_s1`: Arts at `atk_scale` (3) × ATK.
5. **SummonBallis.** The prefab carries Faust's ballista wrapper, but this record has no `SummonBallis` skill, so it never casts. `Log` is a kill counter.

## Verification

`test/arkpedia-rusthammer.test.js`:
- **Admission.** Admitted; a CriticalHit bolt at another speed is refused. The parameters are 60, 18, 18 and 3.
- **Invincible.** No damage taken for the first 60 s, damage afterwards. Unblockable and sleep-immune throughout.
- **Bolts.** Physical bolts at 1 × ATK. The first Arts CriticalHit at 3 × ATK lands after 18 s, and the next one at least 18 s later.
- **Compiled stage.** "Hunting Group" fields Rusthammer at its stage stats, with no battle errors.

The library rebuild published that stage (1,047 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,047 graphs with no failures. Browser review: the stage runs with no console errors, and the original art loads from asset commit `20a8f9ab`. Rusthammer spawns only at 189 s, so it was not watched on the field.

## Boundaries

- **Effects.** The invulnerability and bolt effects are not played.
- **Faust.** Faust (`enemy_1508_faust`) shares this kit plus a real `SummonBallis` skill. It waits on the ballistae.
