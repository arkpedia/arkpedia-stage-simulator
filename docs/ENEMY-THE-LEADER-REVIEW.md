# "The Leader"

`enemy_1536_ncrmcr` has two database levels:
- level 0: 30,000 HP, 800 ATK, 750 DEF; used by FC-8 and the Victoria Annihilation `camp_r_17`;
- level 1: 50,000 HP, 1,000 ATK, 800 DEF, with elite soldiers and flames; used by FC-EX-8 and its Challenge.

She is admitted from her pinned CN prefab and the Global buff templates.

Her Rebirth aura was already reviewed separately as `talent:Aura` (`enemy-eblana-features.js`, the `deathConversionAura` kind). While she is on the field, an eligible enemy defeated by anything but a fall becomes an Ember-form Flamechaser 0.5 s later. That contract is unchanged; only its note and test now say the boss is admitted.

The rest is pinned in `shared/arkpedia/enemy-the-leader-features.js`:
- every component reachable from the retained abilities (77);
- the eleven templates her abilities use;
- three projectiles;
- the clip clocks from `refs/arts/enm_art_17.ab`.

The runtime is the new `theLeader` kind, attached through `skill:Sacrifice_1`, the only boss feature both levels carry. The rules not fixed by the data come from PRTS (`“领袖”`), named below.

## Level one

Level one's talent blackboard lists only `Aura.enemy_key`. As with Jesselton's reviewed level one, it is read as a sparse overlay on the pinned level-zero values: `Reborn.duration` 5, `Reborn.invincible` 15, `AtkUp.atk` 0.3 and `Combat_scale.atk_scale` 0.8. PRTS gives the same values for both levels.

Skills are read per level by prefab key. Level one has `duchns_2` and `duskls_2`, and `Chain_2`'s initial cooldown is 0 there (5 on level zero). 22 records have such a sparse higher level; this is the reviewed reading, not a new one.

## First form

- **Attacks.** Ground targets only.
  - On her blocker she uses the Combat ability: 1× ATK Arts, melee.
  - Otherwise she fires a speed-10 projectile for 1× ATK Arts at one target (PRTS; the form-one attack selector is not retained by the extractor).
  - The attack stand is Attack_a: 1.167 s, strike at 0.5 s.
- **Sovereign (`Chain_1`).** Cooldown 30 s, initial 5 s.
  - It casts when an operator or summon is within `range_radius` (2) and is not already held by an Exhausted Flame. This is the selector's `enemy_duchns_kill_source` exclusion; the Exhausted Flame runtime now exports `boundByExhaustedFlame`.
  - The target and its tile are taken when the cast starts (`_selectTileInSnapshot`).
  - At Skill_a_1's strike (0.867 s of 1.5 s), a speed-10 projectile flies to that tile and summons `enemy_key` there, uncounted (`_unharmful`). The existing Exhausted Flame runtime then binds whoever stands there, or goes out.
- **Give and Take (`Sacrifice_1`).** Cooldown 70 s, initial 5 s. It casts when a non-Ember soldier of `enemy_key` is anywhere on the field, and it takes priority over Sovereign.
  - At Skill_a_2's strike (0.733 s of 1.333 s), up to `max_target` (5) such soldiers are knocked out (`InstantKill`, rebirth not skipped). Each becomes an Ember through its own rebirth.
  - From each knocked-out soldier a speed-3 projectile flies back to her. On arrival she gains an independent barrier of `scale` (0.5) × max HP against Physical and Arts damage, lasting `duration` (60 s).
- **Revive.** The revive component (`_hpRechargeRatio` 1, `_modeIndex` 1) runs for `Reborn.duration` (5 s). Its sequence finishes the current wave at the knock-out (`FinishCurrentWave`, tracking her at the next wave). She stands up at full HP with `reborn_invincible` for `Reborn.invincible` (15 s).

## Second form

- **ATK.** +`AtkUp.atk` (30%, a MULTIPLIER modifier).
- **Arson.** On entering the form she casts Arson. She stands for Skill_b_3 (11.67 s), and at its strike (9.2 s) every Reed on the field ignites (`stageReeds.igniteAll()`), even on a stage without Reeds.
- **Attacks.** On her blocker, two Arts strikes of `Combat_scale.atk_scale` (0.8×) ATK, at Combat_b's two OnAttack events 0.833 s apart. The second needs the same blocker. Otherwise up to two ranged targets (the form-two selector's `_maxNum` 2), with the Attack_b stand (1.5 s, strike 0.5 s).
- **Skills.** `Chain_2` (up to 2 targets) and `Sacrifice_2` (cooldown 60 s); their timers restart from their initial cooldowns.

## Verification

`test/arkpedia-the-leader.test.js`:
- **Admission.** Both levels are admitted, level one with the sparse overlay. Records are refused for a changed invincibility, a changed revive ratio or a barrier that blocks only Physical damage.
- **Sovereign.** It summons the flame on the free operator's tile and skips an operator already held.
- **Give and Take.** Five of six soldiers become Embers, and five barriers of 50% max HP arrive, each with its own 60 s timer.
- **Revive.** The wave is released at the knock-out. She revives at full HP with +30% ATK and invincibility, and Arson ignites the Reeds once, 9.2 s into its 11.67 s cast.
- **Second-form attacks.** Two 0.8× strikes 0.833 s apart on the blocker and no shot while blocked; two ranged targets otherwise.
- **Compiled stages.** FC-8 (level 0) and FC-EX-8 (level 1) spawn her with the right record and take her into the second form without battle errors.

The library rebuild published exactly four more stages: FC-8, FC-EX-8, FC-EX-8 Challenge and `camp_r_17` (992 available). `check-stage-library.mjs` smoked all 992 graphs with no failures, the browser review passed, and FC-EX-8 opens in the preview.

## Boundaries

- **Sacrifice order.** Soldiers are taken oldest spawn first, which stands in for "lowest aggro" (`_postFilter` 46) among enemies.
- **Unretained selectors.** Form one's attack selector and the range helpers of Chain and Sacrifice are not retained; their readings follow PRTS and the retained colliders.
- **Chain reach.** Sovereign's reach is `range_radius` plus the operator's 0.25 collider. The retained trigger collider is 2.1.
- **Arson priority.** Arson's priority (5) only matters on entering the form, where it is cast at once.
