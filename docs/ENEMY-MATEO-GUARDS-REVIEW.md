# Mateo's Guards

`enemy_1409_bdguad` and `enemy_1409_bdguad_2` (one database level each, 1,100 and 1,300 ATK) are admitted from their pinned CN prefabs. `enemy_1409_bdguad_3`, which also refills Captain Mateo's ammo, stays blocked until Mateo is done. The guards share the crossbowmen's blocked-only melee path and Straight Shot line filter (`docs/ENEMY-RAPID-CROSSBOWMEN-REVIEW.md`); their record's `applyWay` is `ALL`.

**Grenades (`CrossBomb`).** One skill wrapper: initial cooldown 2, cooldown 10, silenceable, only while unblocked. It uses the same burst-projectile script as the Rapid Crossbowmen, with two differences:
- `_waitAttackEventForAllAttacks` 1: every shot waits for an `OnAttack` event of `Skill_1` (91 frames, with `_Up` and `_Down` variants; events at frames 56, 61 and 67);
- `_mountPointGroup` `[2, 5]`, two muzzles.

Each grenade deals the skill's `atk_scale` (0.7) × ATK physical damage. It flies like the crossbowmen's bolt: speed 5, lifetime 10, a 0.3 passer-by check that stops at the first operator or Temporary Cover. On that contact it explodes: every selectable operator within `projectile_range` (1.1) of the contact point, plus the operator collider, takes the damage. Camouflage is ignored.

**Unblocked resistance (`DmgResist`).** A toggle holds the database buff `damage_resistance[inf]`: buff key `damage_resistance`, the one-minus Physical+Arts `DamageScale` template, value from the talent (0.4). A block-count checker (minimum −1, maximum 0) keeps it on while the guard is not blocked. This is the existing `unblockedSanctuary` kind, already used by the Surfing Instructor: 40% less Physical and Arts damage while unblocked, none of the reduction while blocked, True damage unaffected. The talent binding has no silence switch, so silence does not remove it.

## Shared changes

- `straightShot` takes an explicit list of release times. The Rapid Crossbowmen keep the event plus 0.1 s steps; the Ambushers keep their single End-event release.
- It also takes an optional blast radius, which replaces the single hit.
- Original models are in `arkpedia-sd-assets` `207b6993`.

## Verification

`test/arkpedia-mateo-guards.test.js`:
- admission of both records, `bdguad_3` still refused;
- refusal when the shot count, the attack-event wait, the block checker or the blast's reach-only check change;
- two grenades on the event clock; blast reach measured from the contact point; 70% ATK;
- 40% less Arts damage only while unblocked, True damage unchanged.

## Boundaries

As for the crossbowmen, plus:
- **Two grenades, not three.** The skill has `_additionalTimes` 2 and its clip has three `OnAttack` events, which could mean three grenades. The ability text ("fires 2 explosives"), the skill blackboard (`times` 2) and the EN wiki ("two grenades") all say two. The blackboard `times` is read as the total, so the first two events fire. The owner confirmed two grenades in game on 2026-11-16.
- **Blast radius.** The blast selector loads a range whose collider radius is 1 (not scalable). The radius used is the blackboard `projectile_range` (1.1), which matches the EN wiki.
- **Block checker.** `_useBlockAsMin` is 0 here and 1 on the Surfing Instructor. Both are read as "while unblocked".
