# Mandragora

`enemy_1523_mandra` has two database levels:
- level 0: 50,000 HP, 640 ATK; used by 9-19, its Challenge and the Victoria Annihilation `camp_r_09` (which overrides HP to 40,000);
- level 1: 65,500 HP, 740 ATK; used by H9-6.

She is admitted from her pinned CN prefab and the Global buff templates. `shared/arkpedia/enemy-mandragora-features.js` pins:
- every component reachable from the retained abilities (112, across four modes);
- fourteen templates;
- two projectiles;
- the clip clocks from `refs/arts/enm_art_16.ab`;
- the Tattered Pillar's `2-2` collapse range.

The runtime is the new `mandragora` kind, attached through `skill:PetrifiedRay`, which claims the six skill wrappers and the two common abilities (`Passives`, `TileSpawn`). The rules not fixed by the data come from PRTS (`蔓德拉`).

## Level one

Level one lists two talent values (Stoneshield 65%, recovery at 35% HP lost) and one skill (the Gaze with radius 1.6). As with Jesselton and The Leader, it is read as a sparse overlay on level zero, here by talent key and by skill prefab key. PRTS lists the same skills and second-form rules for both levels.

## Stoneshield and the four modes

Her state follows the native modes: P1, P1_NoStoneSkin, P2 and P2_NoStoneSkin.

- **Shield up.** She takes `damage_resistance` (60%, or 65% on level 1) less Physical and Arts damage. In the second form she also hovers (`float`, unblockable, released from her blocker). Every second she deals `StoneSkin_2.atk_scale` (0.3) × ATK Arts splash to operators within 1.7.
- **Breaking.** Damage from a Tattered Pillar (`dupilr_trait`) breaks the shield (`enemy_mandra_in_stone_skin`):
  - a channelled Gaze is interrupted, with no seal, and its 15 s cooldown starts;
  - the skill cooldowns pause until the shield is back (`enemy_mandra_restore_cd`);
  - in the second form she first staggers for C2_Stun (0.67 s).
- **Recovery.** `ReSummonStoneSkin` brings the shield back after 25 s, or once her HP falls 40% (35% on level 1) of max HP below where it broke. She recasts it during C1_Skill_2 or C2_Skill_2 (1.5 s).

## Mandragora's Gaze

- **When.** Initial cooldown 5 s. It casts when an operator is within `range_radius` (1.5; 1.6 on level 1), ground only in the first form and also aerial in the second.
- **Target.** After 0.25 s she links to the highest-ATK operator (`_postFilter` 17).
  - The target's ASPD is multiplied by 0.3 (final multiplier, `attack_speed` −0.7).
  - It takes `atk_scale` × ATK Arts damage at the end of the opening clip (0.833 s), then every `hit_interval` (1 s).
- **Duration.** The channel lasts `mandra_ray[cd].duration` (7.1 s), then she plays the closing clip and the 15 s cooldown runs.
- **Sealing.** If the linked target leaves the field during the channel, its tile is sealed (`TileSpawn`: no operator can be placed there again) and she may link to the next target at once.

## Revive and second form

The revive takes `Reborn.duration` (5 s) and she stands up at full HP. Like the Emperor, she does so although `_hpRechargeRatio` reads 0.5; PRTS says 100%.

On standing up:
- she enters P2 with the shield;
- `mandra_p2_invinsible` for 3 s;
- the current wave is released without tracking her (`finish_current_wave_when_buff_finish`);
- the Gaze's cooldown is set to 10 s and Collapse's to 20 s.

`MoveNextLevelBranch` has nothing to run: none of her stages defines branches.

In the second form:
- **Attacks.** A speed-10 Arts shot, ground only. In the first form she attacks only her blocker, in melee (the attack trigger is `NeverTrigger`).
- **Collapse (`SummonDupilr`).** Cooldown 15 s, with the shield up. She picks the nearest intact Tattered Pillar that has an operator in reach. At C2_Skill_3's strike she turns it toward the direction holding the most operators (ties in the order right, left, up, down). 5 s later (`dupilr_t[auto_collapse].interval`), the existing pillar collapse runs in that direction. `StageDemolition.collapse` now takes that direction.

## Stage values

9-19 Challenge sets `PetrifiedRay.atk_scale` ×1.2 and `StoneSkin_2.atk_scale` ×1.5.
- Both are declared on the boss feature and accepted as positive values; every other value stays pinned.
- The stage-rule parser now also accepts an `enemy_skill_blackb_mul` rune that names its skill inside the key (`PetrifiedRay.atk_scale`) instead of with a `skill` selector.

## Verification

`test/arkpedia-mandragora.test.js`:
- **Admission.** Both levels are admitted with the overlay, and the Challenge Gaze is accepted. Records are refused for a changed revive or a shield break keyed to a different buff.
- **Gaze.** It channels on the highest-ATK operator: ASPD ×0.3, Arts ticks every second for 7.1 s. It releases at the end and gazes again after 15 s.
- **Sealing.** A gazed operator that leaves seals its tile, and the Gaze moves to the next operator.
- **Shield.** Pillar damage breaks it with no seal; it returns after 25 s, and again after 40% HP lost.
- **Revive.** It releases the wave, then she hovers with 3 s of invincibility, the aura and a Gaze after 10 s. A pillar in the second form removes hover and aura until the shield is recast.
- **Compiled stages.** 9-19 (level 0) and H9-6 (level 1) take her into the hovering second form. In 9-19 a real Tattered Pillar collapse breaks her shield. 9-19 Challenge carries both multipliers into her record.

The library rebuild published exactly four more stages: 9-19, 9-19 Challenge, H9-6 and `camp_r_09` (996 available). `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and 9-19 opens in the preview.

## Boundaries

- **The seal.** It marks the tile unbuildable. The `trap_047_mandrablock` token itself is not in the CN character table, so its body, if any, is not modelled.
- **Collapse timing.** Her collapse starts 5 s after the warning and then takes the pillar's own collapse time (1.5 s), as any collapse in the engine does.
- **Collapse reach.** "Operator in reach" means a ground operator on the pillar's collapse line in any direction.
- **Gaze timing.** The first hit lands at the opening clip's end and later hits follow the loop's 1 s events; the beam projectile's own hit timing is not decoded.
- **Ray cooldown.** Its native interplay (cleared on recast during the channel, set at 6 s and again at 7.1 s) is reduced to: a re-link inside the channel, then 15 s from the channel's end.
