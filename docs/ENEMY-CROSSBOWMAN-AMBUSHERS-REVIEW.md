# Heavy Crossbowman Ambusher and Hunter

`enemy_1404_msnip` and `enemy_1404_msnip_2` (one database level each, 400 and 500 ATK) are admitted from their pinned CN prefabs. Their bodies match the Rapid Crossbowmen's (`docs/ENEMY-RAPID-CROSSBOWMEN-REVIEW.md`):
- the same blocked-only melee path;
- the same Straight Shot line filter, with Barricade and Exposed fields;
- the same bolt: every projectile row is identical apart from effect names.

The differences:

**Shot.** The skill (initial cooldown 2, cooldown 8, silenceable, only while unblocked) is an ordinary projectile packet driven by a Begin/Loop/End channel:
- `Skill_Begin` (17 frames);
- `Skill_Loop` for the skill's `duration` (2 s), the packet's `_cooldownKey`;
- `Skill_End` (33 frames).

Each phase has `_Up` and `_Down` variants. One bolt leaves at End's frame-2 `OnAttack` event, 2.633 s into the 3.667 s cast. It deals `atk_scale` (1) × ATK Arts damage to the first body in its path, then applies the database `stun` buff for the blackboard `stun` (5 s), status-resistable.

**Invisible.** A common toggle ability holds `enemy_msnip_invisible` (abnormal flag 9). Its checker turns it off while blocked or in attack state, and back on 3 s later (`_restoreDelay` 3). The existing `nativeStealth` attachment handles the blocked case. The Straight Shot module now also switches the stealth off for the whole cast and starts the 3 s restore when the cast ends.

## Shared changes

- `straightShot` takes a list of phases (one plain clip, or Begin/Loop/End), an optional on-hit status and an optional stealth key. The Rapid Crossbowmen use one phase; their behaviour is unchanged.
- `skill:CrossAttack` lives in `shared/arkpedia/enemy-straight-shot-features.js` and dispatches by record to each family's contract and parameters.
- The shared `<$ba.invisible>Invisible</>` feature verifies the Ambushers' contract, attaches their native stealth and claims their common ability.
- Original models are in `arkpedia-sd-assets` `8945dbf1`.

## Verification

`test/arkpedia-crossbowman-ambushers.test.js`:
- admission, and refusal when the stun, restore delay, attack-state reveal or loop key change;
- the Begin/Loop/End clocks and one 5 s stunning Arts bolt;
- stealth lifted during the cast and restored 3 s after;
- no shot while blocked or off the line, and silence cancels an unreleased shot.

## Boundaries

As for the Rapid Crossbowmen, plus:
- **Loop length.** Read as the skill's `duration` blackboard value (the packet's `_cooldownKey`), with `_timeMode` 2. The packet's own `_cooldown` (2.5) is not used, because the record supplies `duration`.
- **Attack state.** Only the Straight Shot cast is read as the attack state that lifts stealth. The ordinary melee happens only while blocked, which already lifts it.
