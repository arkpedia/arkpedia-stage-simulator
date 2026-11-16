# Rapid Crossbowmen

The Light and Heavy Rapid Crossbowmen (`enemy_1403_gunsho`, `enemy_1403_gunsho_2`, one database level each) are admitted from their pinned CN prefabs (`battle/enm_pfb_16.ab`) and the projectile bundle. Both prefabs are identical apart from component IDs; only ATK and the other statistics differ (350 and 400 ATK).

**Ordinary attack.** The record is `RANGED` with a raw range of −1 (effective 0). The only mode's combat and attack are plain physical melee packets behind the blocked-attack trigger (`248012603862317511`), so the crossbowman hits only the operator blocking it. This is the existing generic path, already used by `enemy_1085_sotiwz`.

**Straight Shot (`CrossAttack`).** One skill wrapper, initial cooldown 2 and cooldown 5 from the record, silenceable. Its trigger and the skill's selector are the same filter:
- global range: the range component has no shape;
- one target on the opposing side, ground and air (`_targetMotion` 3), the ordinary taunt and deploy order after the blocker;
- `_checkOnTheSameLine` with offset bounds X ±0.5 and Y −0.5 to 0.1 (Q32.32 fixed point).

The skill plays `Skill` (or `Skill_Up` / `Skill_Down`, 47 frames each) and fires `projectile_enemy_gunsho` at the frame-31 `OnAttack` event, then twice more 0.1 s apart (`_additionalTimes` 2, `_triggerDelta` 0.1). Each bolt deals 100% ATK physical damage.

**Bolt.** `_moveType` 4 at speed 5 toward the target, continuing past it, lifetime 10 s. A 0.03 s passer-by check (`_hitPasserby` 1) with a 0.3-radius collider hits the first body in the path and stops (`_maxHitNum` 1). The passer-by selector group has two filters:
- any operator, ignoring camouflage (`_forceIgnoreCamouflage` 1) and target-free status;
- any unit carrying `trap_ads_mark` (Temporary Cover).

## Shared changes

- `server/sim/content/arkpedia-enemy-straight-shot.js`: the reusable `straightShot` kind, with the selection and the bolt exported for the other Straight Shot families (the Crossbowman Ambusher/Hunter pair, Mateo's guards, Captain Mateo).
- `tools/arkpedia/extract-enemy-native-abilities.py` follows a projectile selector's `_selectorGroup`. Only this projectile has one, so no other retained projectile changed.
- Original models are in `arkpedia-sd-assets` `59ec8d81`.

## Verification

`test/arkpedia-rapid-crossbowmen.test.js`:
- admission of both records, and refusal when the skill's bolt count, the wrapper's family mask, the line offset, the passer-by flag or the collider radius change;
- the runtime constants equal the pinned native values;
- three bolts on the original clocks;
- the first body in the path takes all three, camouflage notwithstanding;
- row and column selection, and no shot while blocked;
- silence and stun cancel an unreleased burst and keep the spent cooldown;
- Barricade and Exposed selection.

## Boundaries

These readings were not established from method bodies:
- **Same line.** Read as: the source lies inside the target tile's row or column band (|dx| ≤ 0.5 or |dy| ≤ 0.5). This matches the handbook ("same row or column") and the X bounds. The asymmetric Y maximum (0.1) is retained in the pinned filter but not applied.
- **Unblocked only.** `_familyMask` 1 is read as "only while not blocked", where other wrappers use 3. The EN wiki's Straight Shot page states the same condition.
- **Aim after the target leaves.** Later bolts aim at the selected target's current position, or its last position once it is no longer on the field (`_emitToInputPosWhenTargetIsInvalid` 1).
- **Barricades and Exposed.** An ally carrying `trap_sheltr_mark` is not selected unless it also carries `enemy_tgshd_exposed_mark`. The Barricade, Temporary Cover and Expose sources are not implemented. Every stage with these crossbowmen also places Barricades or other unimplemented devices, and stays blocked by them, so the barricade line-of-sight rule is finished together with the Barricade device.
- **Abnormal flags.** Flags 32 (shot filter) and 17 (passer-by filter) are pinned. Their selectability uses the engine's existing rules: ordinary targeting for the shot; for the bolt, every live operator except an untargetable, sleeping or ground-evading one.

No stage became ready with this batch: every one of the about 60 blocked stages with these enemies also needs devices or tokens (Barricade, Originium Explosive, `trap_143_rnfcar`, `trap_144_ads`, `trap_145_edd`).
