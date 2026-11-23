# FrostNova, "Winter's Scar" (`enemy_1510_frstar2`)

The chapter-6 FrostNova, at two levels:

| Level | HP | ATK | DEF | Reborn invulnerability | Reborn Ice Shield tiles |
|---|---|---|---|---|---|
| 0 | 30,000 | 440 | 380 | 20 s | 3 |
| 1 | 45,000 | 530 | 440 | 25 s | 4 |

Both levels: 50 RES; immune to stun, silence, freeze and levitation. This main-story batch published **6-16**, **6-16 Challenge** and **H6-4**, plus the Vigilo side story's **VI-6 "Yesterday"** and its Challenge (1,059 available). 6-17 uses a different record (`enemy_1510_frstar2_s`) and stays blocked.

`shared/arkpedia/enemy-wintersscar-features.js` holds the contract. It pins:
- both records;
- every component (69) reachable from Default, Reborn, Attack, Trigger, IceShield, IceBurst, their `[Reborn]` copies, SummonFrosts, SleepImmune and AttackFreeze;
- the `empty` and `e2c_frozen_atkscale` templates;
- `projectile_frstar2`;
- the Attack, Skill_1 and Skill_3 clips from `refs/arts/enm_art_16.ab`.

The runtime is `server/sim/content/arkpedia-enemy-wintersscar.js`, kind `wintersScar`. It is attached through `skill:IceBurst`, the key both levels carry, which also claims the five skill wrappers and the two SleepImmune abilities.
- `skill:IceShield` belongs to the first FrostNova's contract, which dispatches it here.
- `talent:reborn` reaches her through the form-boss list.

**Level 1.** Level 1 lists only the invulnerability talent. Like the Singer's sparse higher levels, it is read as an overlay on level 0: 10 s rebirth, +50% ATK, 5 s attack Cold.

## Kit

1. **Attack.** A speed-10 Arts bolt on the Attack clip (1.6 s, release 0.933 s). AttackFreeze adds `e2c_cold` (buff table: COLD, ASPD −30) for 5 s on each hit.
2. **Two skill sets, by the transform hierarchy.** The Default mode owns IceShield (priority 2, 35 s, first at 35 s) and IceBurst (priority 1, 10.5 s). The Reborn mode owns `IceShield[Reborn]`, `IceBurst[Reborn]` and SummonFrosts.
3. **IceShield.** The first FrostNova's tile seal (the same script):
   - up to `max_cnt` random deployable, not-yet-sealed tiles within 2.0;
   - the Skill_1 clip (3 s); at 1.833 s the unit on each tile is defeated and the tile is sealed.
4. **IceBurst.**
   - It hits every operator, ground or air, within 2.0 of her. There is no limit, but at least one target is needed.
   - Damage: ATK × `atk_scale` (1) Arts, then `e2c_cold` for 10 s.
   - While it casts, `frstar2_s` (`e2c_frozen_atkscale`) doubles the damage to FROZEN targets, checked before the new Cold.
   - The Default mode plays the Attack clip; the Reborn mode plays Skill_3 (3.667 s, hit 2.9 s).
5. **Rebirth.**
   - The first knock-out holds for 10 s. She returns at full HP (`_hpRechargeRatio` 0.5, read as for the other bosses) in mode 1.
   - `reborn_up` adds ATK MULTIPLIER +0.5, and `reborn_invincible` (flag 5) lasts 20 / 25 s.
   - Sleep immunity is kept: it is both a common ability and the Reborn mode's general ability, unlike the first FrostNova.
6. **SummonFrosts.**
   - It is a Reborn-mode skill with cooldown 0 that fires once; it ignores silence.
   - It runs `MoveNextLevelBranch` on `branch_id` `frstar_frosts`, with the same trigger as Faust's.
   - The hidden Originium Ice Crystals appear the moment she enters her second form.

## Stage support

The activation-branch compile (`stage-branch-noops.mjs`) now covers hidden `trap_010_frosts` instances (level 1, no overrides) as well as Turrets.
- **Specs.** Both `stageDeviceSpec` copies accept a hidden branch-activated Ice Crystal.
- **At load.** The stage adapter skips its tile overlay, and `_tickMvpStageDevices` skips it while `active === false`.
- **On activation.** `activateStagePredefined` turns it on: its tile becomes the crystal's (fly-only, undeployable) and it starts its usual 15 s Cold pulse.

## Verification

`test/arkpedia-wintersscar.test.js`:
- **Admission.** Both levels are admitted and the first FrostNova keeps her kit. The overlay values are checked, and a template without the FROZEN check is refused.
- **Attacks.** A normal hit applies Cold. IceBurst hits the operators within 2, not one 4 away, and deals 2× ATK exactly to FROZEN targets.
- **Rebirth.** 10 s, ATK × 1.5, invulnerable for 20 s and then not. The Reborn IceBurst lands on the Skill_3 clip, and sleep immunity is kept.
- **Compiled 6-16.** Two hidden branch-activated crystals stay off through the rebirth. Both are active right after it, their tiles are undeployable, and the branch is spent.

The Ice Crystal, FrostNova, Faust, Turret, reward-device, Power Armor, Twigs and stage-device suites pass. The library rebuild published 6-16, 6-16 Challenge, H6-4, VI-6 and VI-6 Challenge (1,059 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,059 graphs with no failures.

## Boundaries

- **The frozen double** is read as applying to IceBurst only, as the handbook says: its buff component attaches during the cast. Normal attacks are not doubled.
- **6-17** (`enemy_1510_frstar2_s`: fake attacks, a `blood` periodic-damage talent, one-shot skills) is not admitted yet.
- **Effects.** The crystal-spawn and rebirth effects are not played.
