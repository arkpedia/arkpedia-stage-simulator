# Shieldguard

`trap_024_npcsld` (PRTS 盾卫, "Shield Guard") is an ally-side blocker placed on the map. It appears in:
- M8-6 and its Challenge (four on row 5, guarding the lower lane);
- VI-1 and its Challenge;
- PL-5;
- Integrated Strategies (ISW-DF, ISW-NO, ISW-SP).

This batch publishes M8-6, M8-6 Challenge, VI-1 and VI-1 Challenge, which had the Shieldguard as their only blocker. PL-5 and the Integrated Strategies stages still wait on other work.

## Native evidence

`shared/arkpedia/stage-shieldguard.js` (`shieldguardNativeReviewed`) checks the pinned prefab `trap_024_npcsld` (bundle `pkgrps/btl_pfb_tokens_0.ab`), the skill prefab `sktok_npcsld` (`battle/prefabs/[uc]skills.ab`) and the CN tables field by field.

**Root**
- Side 1 (ally), category 1 (character-like).
- One mode; not withdrawable.
- Block radius² 0.5 (PRTS: 0.7071); melee build tile.

**Default mode: an ordinary attack**
- Melee (`_attackType` 1), Physical (`_damageType` 1), ATK ×1.
- No cooldown of its own, so the record's 4 s base attack time paces it.
- **Selector:** enemy side, ground only (`_targetMotion` 1), one target. It skips DISABLE_COMBAT (flag 20) and SHELTERING (combo 1).
- **Range:** `0-1`, its own tile.

**Common abilities**
- `hpsts_unhealable`: HEAL_FREE (flag 7), for life.
- Two battle-log buffs, which have no effect.

**Skill `sktok_npcsld` (列阵！, passive)**
- `npcsld_skill` adds the blackboard `taunt_level` (1) to TAUNT_LEVEL (attribute 20).

**Record**
- 20,000 HP, 700 ATK, 1,000 DEF, 60 RES, block 3.
- The two key frames (levels 1 and 30) are equal, so the instance level changes nothing.

The enum names come from the pinned field dump (`statusDefinitions` in `data/arkpedia-device-native-source.json` now also keeps DISABLE_COMBAT, SHELTERING and TAUNT_LEVEL). PRTS agrees on every value, and adds "attacks, preferring the enemies it blocks".

## Runtime

`server/sim/content/arkpedia-stage-shieldguards.js` sets the Shieldguard up as follows:
- **Placement:** spawns each visible instance as an ally device.
- **Attack profile:** an ordinary melee profile that is ground only, plus `characterLikeDevice` (enemies target it) and `noHeal`.
- **Taunt:** base taunt 1.
- **Attack loop:** the battle core skips devices in its ally loop, so the runtime runs the ordinary `updateAlly` for each guard on `tick`.
- **Hidden instances:** a hidden instance (Integrated Strategies) waits for an `ACTIVATE_PREDEFINED` of its alias. It appears once, and not at all if its tile is taken.

Instances are compiled through `shieldguardDefinition` (level 1–30, skill level 1, a facing); the device runtime carries it as family `shieldguardDefinition`.

## Checked

`test/arkpedia-shieldguard.test.js`:
- **Review:** passes, and refuses each of these changes: a selector that also hits flying enemies, a healable guard, a changed taunt, and stats that grow with level.
- **M8-6 setup:** four guards at (5,2)–(5,5) with the record's stats, taunt 1, `noHeal`, ground only.
- **M8-6 combat:** in a headless run the guards block enemies on the lower lane, strike only enemies on their own tile with Physical hits at least 4 s apart (4 s while they have a target), and take hits themselves.
- **Hidden instance:** appears once when its alias is activated.

## Not checked

- In game.
- Attack timing: the hit lands when the attack starts. The prefab waits for the `Attack` clip's OnAttack event, which was not extracted.
- Art: the guard is drawn as the client's device marker.
