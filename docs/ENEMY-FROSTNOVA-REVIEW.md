# FrostNova

`enemy_1505_frstar` has two database levels with the same talents:
- level 0: 25,000 HP, 420 ATK, 250 DEF, 50 RES; Ice Nova every 8.5 s, Ice Shield every 30 s on 2 tiles; used by 4-10;
- level 1: 35,000 HP, 620 ATK, 350 DEF, 50 RES; Ice Nova every 7 s, Ice Shield every 21 s on 3 tiles; no stage uses it yet.

She is admitted from her pinned CN prefab and the Global buff templates. Her extraction scope is new, together with `projectile_frstar` and `projectile_frstar_s1`; only her prefab changed.

`shared/arkpedia/enemy-frostnova-features.js` pins:
- every component reachable from her abilities (31);
- the `empty` template and both projectiles;
- the clip clocks from `refs/arts/enm_art_16.ab`:
  - Attack: 1.6 s, strike events at 0.57 s and 0.93 s;
  - Skill (Skill_1): 3 s, strike at 1.83 s.

The runtime is the new `frostNova` kind, attached through `skill:IceShield`, which claims both skill wrappers and the common sleep-immunity ability. `talent:reborn` defers to her contract through the form-boss list.

"FrostNova, 'Winter's Scar'" (`enemy_1510_frstar2`) is a different record. Every one of her stages also needs a missing branch program, so she would unlock nothing yet.

PRTS refused automated access this time. The rules not fixed by the data come from the English wiki (arknights.wiki.gg, `FrostNova/Enemy`).

## Kit

- **Attack.** A speed-10 projectile for 100% ATK Arts damage at the Attack clip's first event, within 2.0 (the engine's normal ranged attack).
- **Ice Nova (`ArcticBlast`).** Cooldown 8.5 s (7 s on level 1), first at the same delay, priority 1.
  - Target: the nearest ground operator within `range_radius` 2.5.
  - She plays the Attack clip; after the 0.93 s pre-delay, the 0.1 s `projectile_frstar_s1` lands on the target.
  - Every operator within its 2.0 collider takes 150% ATK Arts damage and gets `arctic_blast`: -50 attack speed for 8 s.
- **Ice Shield (`IceShield`).** Cooldown 30 s (21 s), first at the same delay, priority 2, so it goes before Ice Nova.
  - Up to `max_cnt` (2; 3 on level 1) random deployable tiles within its 2.0 collider, not sealed already. The trigger needs at least one tile.
  - At the Skill_1 strike (1.83 s), the unit on each tile is defeated (InstantKill). The tile becomes a Sealed Floor (`trap_004_iceblock`): it can no longer be deployed on, through the engine's `noDeployTiles`.
- **Casts.** She stands through each cast and does not attack meanwhile. The cooldowns run from the cast start.
- **Revive.** On the first knock-out, a 5 s revive (`reborn.duration`). She comes back at full HP with ATK +50% (MULTIPLIER, `reborn_up`).
- **Sleep.** Her common `frstar_c` buff (sleep immunity) is not retained through the revive. Afterwards she can be put to sleep, as the wiki notes. Stun, silence, freezing and levitation immunity come from her record.

## Verification

`test/arkpedia-frostnova.test.js`:
- **Admission.** Both levels are admitted. Each of these is refused: a changed revive ATK, a third tile on level 0, a changed Ice Nova pre-delay, and two revives.
- **Ice Nova.** It casts at 8.5 s on the nearest operator. At the 0.93 s release it hits the target and an operator within 2 of it, not one farther away, for 150% ATK Arts. The -50 ASPD lasts 8 s.
- **Ice Shield.** At 30 s it picks two tiles within 2; the operator on one is defeated and both tiles are sealed. With both skills ready, Ice Shield goes first.
- **Revive.** 5 s, full HP, ATK ×1.5, the sleep immunity gone. The next knock-out is final.
- **Compiled 4-10.** With a Myrtle beside her, she casts Ice Nova and Ice Shield and seals tiles. She revives to full HP, with no battle errors.

The library rebuild published exactly one more stage, 4-10 (1,017 available). No other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, the browser review passed, and 4-10 loads in the preview with no console errors.

## Boundaries

- **Revive HP.** Full HP; the native `_hpRechargeRatio` is 0.5, read the same way as the earlier bosses whose revive HP the owner or PRTS confirmed. This is an in-game check.
- **Revive length.** It uses the record's 5 s; the Reborn clip (Skill_2) is 7.2 s long.
- **Sealed Floor.** Modelled as a permanent ban on deployment for the rest of the battle. No ice-block unit is placed, and `trap_004_iceblock` has no record in the pinned tables.
- **Ice Nova target.** The selector's `_postFilter` 4 is read as the nearest ground operator.
- **Ice Nova area.** It hits flying operators within 2 of the target as well; the projectile's target options are not otherwise restricted.
- **4-10 Challenge is not published.** Its `ebuff_skill_radius` rune (a global skill-radius scale) is not supported by the stage rules. Supporting it needs a library-wide reading of which enemies have a skill radius.
- **Presentation.** The ice effects are not reproduced.
