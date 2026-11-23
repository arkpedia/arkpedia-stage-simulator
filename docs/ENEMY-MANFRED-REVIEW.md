# Manfred

`enemy_1528_manfri` has two database levels with the same talents and skills:
- level 0: 40,000 HP, 1,000 ATK, 600 DEF, 40 RES; used by 10-17 and 10-17 Adverse;
- level 1: 60,000 HP, 1,200 ATK, 600 DEF, 40 RES; used by H10-1, H10-2 and H10-3.

He is admitted from his pinned CN prefab and the Global buff templates. His extraction scope is new in `extract-enemy-native-abilities.py`, together with `projectile_enemy_manfri_funnel`; only his prefab changed.

`shared/arkpedia/enemy-manfred-features.js` pins:
- every component reachable from the retained abilities (85, across his three modes: Default, Pose and Reborn);
- the twenty templates they use;
- the funnel projectile;
- the clip clocks from `refs/arts/enm_art_17.ab`: both attacks last 1.83 s with the strike at 0.63 s, and the Revive clip lasts 5 s with no strike event.

The runtime is the new `manfred` kind, attached through `talent:Funnel_common`. That feature claims the two skill wrappers (`Funnel_rage` and `Pose`) and the one common ability. The shared keys defer to his contract: `ability:First Form`, `ability:Second Form`, `talent:Reborn` (form bosses), `talent:Shield` and `talent:aura`.

The rules not fixed by the data come from PRTS (`曼弗雷德`, and the H10-1/H10-2/H10-3 stage pages).

## The artillery link

His charge abilities cast `modify_sp[start]` on the one unit tagged `gunctrl`, which is the Londinium Secondary Defense Artillery. The stage battle gains `chargeStageArtillery(amount)`. It adds SP to the first artillery in stage order, capped at the device's 120. The device fires on its next tick, as before. Every original stage he appears in places exactly one artillery.

The Artificer and the drone keep their existing inert charge. Their charge is not wired into the device, and no published artillery stage changed its bundle.

## First form (the floating cannon)

- **Shot.** One ground operator within 2.0 takes 50% ATK as Arts damage (`Funnel_s1.attack@atk_scale`), at the Attack_1 strike, with no projectile. Each shot adds 3 SP to the artillery.
- **Focus.** Each consecutive attack on the same target adds +60 attack speed, up to 5 stacks. A new target, or 6 s without attacking, clears the stacks. The same-target buffs sit on both forms' attack objects, so Focus also applies in the sword form, although the handbook lists it under First Form.
- **Military Training.** He has 80% Physical and Arts dodge. When the artillery damages him while he has the dodge or its disable timer, he loses the dodge, is stunned for 8 s, and starts a 30 s timer (`enemy_manfri_mark` on the artillery, then `Shield[disable]`). A hit during the timer stuns him again and restarts it. The dodge returns when the timer runs out.

## First knock-out

- **The wave.** The current wave is released (`FinishCurrentWave`, and he is tracked in the next wave when one exists).
- **The revive.** A 20 s revive (`Reborn.duration`) at full HP; the native `_hpRechargeRatio` is 1 here.
- **The barrage.** During the revive, every 0.8 s the cannon hits one random ground operator anywhere on the field for 30% ATK Arts damage (`Funnel_rage.atk_scale`). Each shot adds 6 SP. In the simulator that is 24 shots. The 25th tick falls at the same instant the revive ends, and the revive's expiry runs first on that shared tick. That is engine ordering, not a rule from the data.
- **Pose.** The Pose cast then plays the 5 s Revive clip, during which he does not act, with 5 s of invincibility (`Reborn.invincible`).
- **Sword form.** He then switches to the sword form and regains the dodge. Only `enemy_manfri_aura_on` survives the revive, so a running disable timer ends with it.

## Second form (sword and funnel)

- **Sword.** A 100% ATK Physical attack at the Attack_2 strike. It does not charge the artillery.
- **Funnel.** At the same moment the funnel fires a speed-20 projectile at the same target, dealing 50% ATK Arts per hit. Each hit adds 6 SP.
- **Bounces.** The projectile is a bounce controller with one hit per `Funnel_s2.times`, 0.53 s apart. After the first hit, the next goes to one other operator within its 1.5 selector; if there is none, it hits the traced target again (`_hitTraceTargetIfNoOtherTarget`, and PRTS H10-2).
- **The next knock-out is final.**

## Stage overrides

- **H10-1.** `Shield.disable_duration` is 12. `Funnel_s1.attack@ep_damage_ratio` and `Funnel_s2.attack@ep_damage_ratio` are 0.2: both normal attacks deal an extra 20% ATK as Necrosis. Element 4 is Necrosis per the PRTS H10-1 page ("凋亡损伤"). The funnel keeps its own ratio, which is 0.
- **H10-2.** `Funnel_s2.times` is 2, so the funnel hits an extra target or the same one twice (PRTS H10-2), and `Funnel_s2_charge.sp` is 12.
- **H10-3 (the aura).** The stage sets `aura.isenabled` to `aura_on`, `aura.range_radius` to 1.25 and `Shield.disable_duration` to 8. `enemy_manfri_aura` is a field-wide passive (script `-5793748974791823428`, `_selector` 0). Its validator passes every unit that carries `enemy_vampires[death_rattle]` or `enemy_bloodsucker_mark`. While `isenabled` is `aura_on`, each of those units gets the derived `[damage]` buff. That buff deals sourceless Arts AOE damage around its carrier: `atk_scale` × Manfred's current ATK to every opposing unit, ground and air, target-free units excluded. The `CreateBuff` literal says 1.0 s and the AOE node says radius 1.0. PRTS's H10-3 enemy page gives "every 0.5 s within radius 1.25, 5% of Manfred's ATK", which matches the blackboard (`aura.interval` 0.5, the stage's `range_radius` 1.25, `atk_scale` 0.05). So the blackboard is used, and the buff waits one interval before its first tick.
  - **Carriers.** Inspected on 2026-11-23, the native prefabs attach `enemy_vampires[death_rattle]` to the Heirbearer Warrior, Artificer, Chain Caster and Hatedrinker lines (`dpvt`, `dmech`, `dkmage` and `dklord`, both tiers). The Bombardier (`dthrow`) and Punisher (`dfat`) lines do not have it, although their reborn text is the same. The contract pins those eight keys. Reborn Creations (the Touch and Gift lines) carry the `ab:bloodsuckerMark` that the Reborn Creation runtime already attaches. This agrees with PRTS's carrier list.
  - **Duration.** "While present": the ability is not detached by his revive (`_detachAbilityWhenReborn` 0), so the aura runs through the 20 s revive. It ends when he leaves.
  - **Admission.** `aura.isenabled` is injected through `stageInjectedParameters` and accepts only the two native strings. `aura.range_radius` is a reviewed numeric override.
  - **Rune note.** H10-3's two `enemy_attribute_mul` runes are NORMAL-difficulty only, so the adverse environment keeps the database stats.

## Verification

`test/arkpedia-manfred.test.js`:
- **Admission.** Both levels are admitted. Each of these is refused: a changed dodge, an unknown `aura.isenabled` string, a changed barrage scale, a revive HP of 0.5, and two revives. The H10-1, H10-2 and H10-3 overrides are admitted and change the parameters. `aura_on` only on H10-3; a numeric `aura.isenabled` and a zero radius throw.
- **H10-3 aura.** With real Warrior Captain, Touch of Benevolence and Retrofit ASV records: nothing before Manfred is present; the first tick comes after 0.5 s, then one every 0.5 s; each tick is 60 sourceless Arts (5% of 1,200) to operators within 1.25 of a Warrior or a Touch; an operator 1.3 away, and one beside the ASV (no marker), are untouched; nothing after he leaves.
- **Form one.** A 50% Arts shot adds 3 SP. Focus caps at 5 stacks (+300 attack speed) and resets on a target switch or after 6 idle seconds. The SP stops at 120.
- **Military Training.** Only artillery damage strips the dodge. The stun lasts 8 s. A re-hit restarts the 30 s timer, and the dodge returns after it.
- **Knock-out.** The wave is released with the next-wave option. The barrage hits random near and far operators at 30% Arts and adds 6 SP each. He comes back at full HP with 5 s of invincibility, then does not act until the Pose clip ends. After that come the dodge, a 100% Physical sword hit with no charge, and a 50% Arts funnel hit worth 6 SP. The next knock-out is final.
- **Overrides.** H10-1 adds 20% Necrosis to the cannon and the sword and gives a 12 s disable. H10-2's funnel hits a neighbour, or the same operator twice, and adds 12 SP a hit.
- **Compiled stages.** On 10-17, 10-17 Adverse, H10-1, H10-2 and H10-3, with an invulnerable Myrtle beside him:
  - his shots charge the real artillery;
  - the knock-out moves him to the next wave (H10-2 has one wave);
  - the barrage adds 24 × 6 SP;
  - he ends at full HP in the sword form with the dodge;
  - each stage's own values are observed in the compiled battle, not read back from the record. Max HP after the stage runes is 40,000, 48,000, 60,000, 72,000 and 60,000. An artillery hit disables the dodge for 30 s, 12 s on H10-1 and 8 s on H10-3. Only H10-3 has the aura on, at radius 1.25. Sword-form funnel hits charge 6 SP each, and on H10-2 12 SP with two hits per shot;
  - there are no battle errors.

The library rebuild published exactly four more stages: 10-17, 10-17 Adverse, H10-1 and H10-2 (1,009 available). No other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and 10-17 opens in the preview.

The H10-3 aura batch (2026-11-23) published H10-3 (1,067 available, none withdrawn). The other four Manfred stages changed bundle only because his runtime parameters gained the `aura` block, which is off there. In a headless run of the compiled H10-3, the aura first ticked 0.5 s after he arrived, at 60 Arts every 0.5 s, with no battle errors. The stage opens in the preview.

## Boundaries

- **Attack range.** The attack triggers carry placeholder 0.5 colliders with `_useBlackboardRangeId` 0. The record's 2.0 range is used, which agrees with PRTS.
- **Charge timing.** A charge is added when the shot or hit is dealt. The native charge events (`_runActionOnEvent` 5 and 3) are not modelled separately.
- **Funnel damage.** Funnel hits are not normal attacks (`isAttack` false). They are a separate triggered ability.
- **Bounce target.** The bounce selector has `_targetMotion` 3 and no sort order. The runtime assumes a ground operator and picks the nearest one. Which operator the game picks is unverified.
- **Barrage count.** 24 shots, from the engine's tick order. The game may fire a 25th at the instant the revive ends.
- **Artillery targeting.** The device still excludes stealthed and camouflaged operators. PRTS says the blast ignores them. This existing simplification is unchanged.
- **Artificers and drones.** Their artillery charge is wired since the artillery-charge batch (`docs/ENEMY-ARTILLERY-CHARGE-REVIEW.md`).
- **Presentation.** The funnel and mode effects, the idle-hiding effect buffs and the aura's `enemy_manfri_buff_03_start` effect are not reproduced.
- **Aura clock.** Each carrier's clock starts on the first tick that sees it as a carrier. A unit that keeps the marker through a rebirth is treated as new when its body is replaced.
