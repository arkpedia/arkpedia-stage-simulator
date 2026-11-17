# 小八界 (enemy_2125_dylnpp) and the CN template fallback

## CN template fallback (owner's decision, 2026-11-17)

Enemy prefabs are pinned CN, but buff templates were pinned only to the Global `buff_template_data`. CN-only enemies name templates Global does not ship, so 394 unadmitted records could not be verified.

`tools/arkpedia/extract-enemy-native-abilities.py` now also reads the CN `zh_CN/gamedata/battle/buff_template_data.json`, pinned at the prefabs' commit (`a550f5e0`, 27,996,217 bytes, Git blob `a94bbb39`, SHA-256 `b1199173…`). It is a fallback only:
- Global stays authoritative for every key it has;
- a key is taken from CN only when Global lacks it;
- each such key is listed in `cnTemplateKeys`, and the pin in `source.cnTemplates`.

The first extraction added exactly 16 CN-only templates. No existing template or prefab changed.

## 小八界

`enemy_2125_dylnpp` (three database levels, CN-only, `applyWay` NONE: it does not attack) is admitted from its pinned CN prefab (`battle/enm_pfb_28.ab`) and the CN fallback templates.

**Low-altitude hovering (`近地悬浮`).** The first mode's passive holds `enemy_dylnpp_fly` (abnormal flag 8). That buff ends on a disabling control: it switches to the second mode, stuns the unit for 0.5 s, and grounds it. The second mode's animator hook replaces `Move`, `Idle` and `Die` with their `_2` clips. This is the existing `hover` kind used by the Dublinn Flying Soldiers, with this enemy's grounded clips.

**Burst after 15 hits (`CircleDamage`).** The talent passive `enemy_dylnpp_t` runs on every damage instance taken, except those marked ignore-for-SP (`dmg.noSp` here) and elemental buildup:
- it adds 1 to `damage_cnt`;
- at `take_damage_cnt` (15) it resets the count;
- every ally within `range_radius` (3.5) that is not already stunned takes the database `stun` for `stun` (15 s) and `enemy_dylnpp_t[damage]`: `atk_scale` (3) × ATK Arts damage.

This is the new reusable `damageCountBurst` kind. The passive also logs the kill (`stageOutcomeCounter`).

## Verification

`test/arkpedia-dylnpp.test.js`:
- all three levels admitted, their three templates in `cnTemplateKeys`, the CN pin at the prefabs' commit;
- refusal when the hit count or the damage template change;
- hovering until a stun grounds it with the `_2` visuals;
- the 15th hit bursting on allies within 3.5 who are not already stunned, for 15 s and 3× ATK Arts, then again after another 15;
- hits that give no SP do not count.

## Boundaries

- **Burst radius.** The range action has `_useRadius` with `_radius` 0; the radius used is the talent's `range_radius` (3.5).
- **Attacker's ATK.** `DamageViaAttr` reads ATK with `_getAttrFromTarget`; read as 小八界's own ATK, the buff's source, as the ability text describes.
- **No attack.** `applyWay` NONE: the grounded mode's melee component is retained but unused, matching the handbook's non-attacking unit.
- **Hover.** As for the Dublinn hover: the controls that ground it are stun, freeze, sleep, levitate and ground-bind.
