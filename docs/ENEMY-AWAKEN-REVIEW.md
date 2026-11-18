# 'Awaken'

`enemy_1531_bbrain` has two database levels:
- level 0: 37,500 HP, 1,200 ATK; used by DV-8;
- level 1: 50,000 HP, 1,350 ATK; used by DV-EX-8 and its Challenge.

Both levels carry the same talents and skills. She is admitted from her pinned CN prefab and the Global buff templates.

Her damage sharing was already reviewed separately as `talent:DamageSplit` (`enemy-awaken-features.js`, the `markedEnemyDamageShare` kind): 50% of the damage she takes passes as HP loss to the Power Armor drivers on the field, except instant-kill damage. That contract is unchanged; only its note and test now say the boss is admitted.

The rest is pinned in `shared/arkpedia/enemy-awaken-boss-features.js`:
- every component reachable from the retained abilities (109);
- nine templates;
- the four Journey projectiles;
- the clip clocks from `refs/arts/enm_art_17.ab`.

The extractor now also keeps her abilities' sibling components. Only her own prefab changed.

The runtime is the new `awaken` kind, attached through `skill:Blink`. That feature claims the five skill wrappers and the five active abilities: Activate, Aura, the kill-log Aura Logger, and both Passive bodies. The rules not fixed by the data come from PRTS (`“唤醒”`).

## Damage sharing (talent:DamageSplit, reviewed earlier)

The source aura selects other grounded, selectable allied enemies carrying
`lypa[driver_mark]`. Its reverse source bindings name the recipients of
`DamageSplitToBuffKeySources`. The lower-priority damage template excludes
`INSTANT_KILL_LIKE_DAMAGE` and keeps half of the incoming damage. The shared
runtime transfers the other half, split equally, through the existing HP-loss
path after mitigation. Recipient DEF/RES is not applied again.

The loss keeps the original credit and sourceless classification. A dying
recipient's unused share is not redistributed. With no eligible recipient she
takes full damage.

`instantKillLike` survives damage normalization as a classification flag. The
source-reviewed Logos and Makoto execution packets set it. It does not bypass
shields, fatal hooks or invulnerability, and the native cancellation-mask
limitation documented for it remains. HP loss and cancelled hits do not enter
this sharing hook.

Native aura refresh timing, overlapping aura ownership, and lower-priority
ordering against other rare damage modifiers are not client-frame certified.

## Both forms

**Self-bound.** She never walks, attacks or gets blocked (`Passive`: abnormal flags 22 and 8). Her damage comes from her skills only.

**Journey (`AttackLR`, cooldown 5 s, initial 5 s).** It casts when a ground operator is on the field. At Skill_1's strike (0.667 s of 1.067 s) one shot leaves per direction:
- left and right in the first form;
- all four directions in the second (`AttackUDLR`).

Each shot flies at speed 3 for up to 6 s. It hits the first ground unit within its 0.5 collider (plus the operator's 0.25) for 1× ATK Physical, then stops.

**Blink (cooldown 38 s, initial 50 s).**
- She jumps to the next MOVE checkpoint of her route (`BlinkNode`, `_toNextCheckpoint`; nothing happens when none is left).
- She is untargetable and invulnerable for the 1 s hide (the "blink protection").
- Then `enemy_bbrain[aoe_when_finish]` casts Shattered Vision.

**Shattered Vision (`Aoe` / `AoeM2`).** She charges `aoe_prepare_duration` (3 s). At Skill_2_End's strike (1.433 s of 2.1 s), every ground operator on the field shares `atk_scale` (5) × ATK as melee Physical damage, split equally. In the second form, operators on high-ground tiles are also stunned for `stun` (15 s) divided by their number.

## Revive and second form

- **Revive.** It takes `Reborn.duration` (10 s), invulnerable, and she stands up at full HP (PRTS). The revive component's `_hpRechargeRatio` reads 0.8; as with Emperor's Blade and Mandragora it does not set the HP.
- **At its end:**
  - the current wave is released, tracking her at the next wave;
  - `Activate` fills the SP of every R-Series Power Armor still marked `lypa[car_mark]` (`modify_sp[ratio]`, 100%), so the stage runtime activates them;
  - `M2.atk` (+25%) applies and Journey's timer restarts.

## Verification

`test/arkpedia-awaken-boss.test.js`:
- **Admission.** Both levels are admitted; records are refused for a changed ATK bonus or a changed Journey speed.
- **Journey.** It hits the left and right operators once each at 1× ATK and misses the one above.
- **Blink.** She lands on the next checkpoint and is protected. Shattered Vision then splits 500% ATK over the ground operators, and there is no further checkpoint.
- **Revive.** It releases the wave with tracking, fills a marked armor's SP, raises ATK by 25%, and the second form's Journey hits the operator above too.
- **Second-form Shattered Vision.** It stuns the two high-ground operators for 15 s shared between them.
- **Compiled stages.** On DV-8 (level 0) and DV-EX-8 (level 1) she blinks to her first route checkpoint after 50 s. After her revive, every placed Power Armor is filled or already activated, with no battle errors.

The library rebuild published exactly three more stages: DV-8, DV-EX-8 and DV-EX-8 Challenge (999 available). `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and DV-8 opens in the preview.

## Boundaries

- **Blink trigger.** The trigger's extra conditions (no `blink_mark`, a distance-to-exit comparison) are not read. She blinks whenever the cooldown is ready and a checkpoint remains.
- **Journey volley.** The four directions fire together at the Skill_1 strike. The secondary shots' own 1.067 s timing is not separated.
- **High ground.** It means any tile that is not low ground (the selector's buildable type 2).
- **Up/down collider offset.** The up and down projectiles' collider children have a local y offset of −1. The runtime treats every Journey shot as centred on its path, so the up and down shots hit at the projectile centre rather than one tile below it.
- **Blink clips.** Move_Start and Move_End (0.5 s each) only matter visually. The 1 s hide buff decides when Shattered Vision starts.
- **Presentation.** Original particles and native frame ordering are not reproduced.
