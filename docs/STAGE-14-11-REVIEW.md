# 14-11, a preset operator's module

14-11 "Of Heroes" and 14-20 "Procession of Kings" place Logos on the field wearing his module (`uniEquipIds`: `uniequip_002_logos` at stage 3). The stage compiler refused any worn module, so both were blocked.

This batch publishes 14-11 and its adverse variant (1,178 available; main story 447 of 564). 14-20 still needs its environment and the Blood Lord's aura parameter.

## Scope

- **Preset operators only.** A module is accepted when `shared/arkpedia/predefined-modules.js` has reviewed that module at that stage for that build. Anything else is still refused (`Unsupported predefined operator override`).
- **Player squads have no modules.** The player catalogue (`loadout.js`) is unchanged. A Logos the player brings has his base talent and no module trait.
- **One module is reviewed:** Logos's CCR-Δ, stage 3, at Elite 2 level 60 or higher.

## Source

`tools/arkpedia/predefined-module-source.mjs` writes `data/arkpedia-predefined-module-source.json` from pinned inputs:
- **Table rows:** `battle_equip_table` and `uniequip_table` from the Global tables at the commit Logos's record uses (`57010cb5…`), checked by git blob hash. The CN rows at `a550f5e0…` carry the same numbers.
- **Prefabs:** `battle/prefabs/[uc]equips.ab` from the pinned CN client (`26-09-22-07-47-20_6c71fa`), checked by size, MD5 (the client manifest's) and SHA-256. The Global operator receipt (`arkpedia-caster-third-prefabs.json`) is not changed.
- **Buff templates:** `logos_e_002_tr` and `logos_e_002_t_1` from the pinned CN `buff_template_data.json`.

## The module (CCR-Δ "A Pen Collection from the Convallis", stage 3)

- **Attributes:** +170 max HP, +67 ATK.
- **Trait** (part `logos_equip_1_3_p1`, hidden talent key `10`, `ep_damage_ratio` 0.08; buff `logos_e_002_tr` for life):
  - After Logos outputs Arts damage (`ON_AFTER_OUTPUT_DAMAGE`, damage mask MAGICAL), the damaged unit takes Necrosis injury equal to the damage value × 0.08.
  - The injury is a fixed amount (`_isFixedEpDamage`, empty fixed-scale key), so the 8% applies once. The same shape is used by other modelled fixed injuries (`trap_larva_t_dark_damage`).
  - It applies to every Arts damage he deals: attacks, talent shots and skill damage.
- **Talent** (part `logos_equip_1_3_p2`, talent key `11_root`, talent index 0): Lexical Evolution's buff `logos_t_1` now uses the template `logos_e_002_t_1`.
  - The extra shot is unchanged in kind: 60% chance (40% without the module), Arts damage of 60% ATK (65% from Potential 5), Slow 0.8 s.
  - New: when the shot's target is in its Necrosis burst (`IsTargetInEPBreakRecovery`, DARK), it also takes Elemental damage of 60% ATK, after the Arts damage. PRTS notes the same order.
  - Both damages use the ATK cached when the shot is emitted (`_cacheAtkToActions`).

## How it is built

- **Compile** (`tools/arkpedia/stage-predefined-operators.mjs`): one worn module is accepted when `predefinedModuleDefinition` accepts it. The reviewed definition (attributes, ratio, talent blackboard and text) is stored on the preset entry as `module`.
- **Record** (`shared/arkpedia/predefined-module-record.js`, used by `server/sim/arkpedia.js`): the operator's record gains the attributes, the module talent replaces talent 0, and `record.module` carries the trait. The battle does not import the review or its source data.
- **Runtime** (`server/sim/content/arkpedia-caster-third.js`):
  - Trait: a `damaged` listener on Logos adds the injury (`type: 'element'`, `apoptosis`) for each Arts damage, tag `logos:module-trait`.
  - Talent: the lexical shot adds `type: 'elemental'` damage while the target holds `apoptosisBurst`, tag `logos:lexical-elemental`.
- The engine's Necrosis rules are unchanged: an enemy's burst lasts 15 s, and no injury accumulates while it runs.

## Checked

`test/arkpedia-predefined-modules.test.js`:
- **Review:** it passes, and refuses a stronger trait, a likelier shot, more ATK, another owner, a Physical trait filter, a scaled fixed injury, a missing burst condition and another talent buff.
- **Acceptance:** stage 2, Logos's other module, Elite 1, level 59 and another operator are refused. Potential 5 selects the 65% candidate. A record without the module keeps the 40% talent.
- **Compile:** 14-11 and its adverse variant carry the definition on Logos's entry. Stage 2, the other module and two modules are refused.
- **Import graph:** the battle does not reach the review or its source data.
- **In 14-11:**
  - Logos has +170 HP and +67 ATK over the same build without the module, and a 60% shot.
  - Each Arts damage (attacks and talent shots) carries one injury of 8% of it, and the Necrosis gauge holds their sum.
  - Elemental damage appears only while the burst runs, right after the shot's Arts damage, with the shot's ATK × 0.6.
- **Headless runs** of 14-11 and its adverse variant clear with life raised to 999. With no player input Logos falls and enemies leak.
- **Browser:** 14-11 opens with Logos placed on 3,6 with the module's attributes; no console errors.

## Not checked

- In game.
- **Inference: what the 8% is taken from.** The simulator uses the damage after RES (the `damaged` amount, not capped by remaining HP). The template reads the damage value "without calculate" at `ON_AFTER_OUTPUT_DAMAGE`; whether that value is before or after mitigation is not settled by the data or by PRTS.
- **Order within one hit:** the injury is applied after the Arts damage. If that injury fills the gauge, a talent shot's Elemental damage follows in the same hit.
- **No module art or panel text:** the module's effect prefab (`equipment_system_corecaster_buff_d`) is not drawn.
