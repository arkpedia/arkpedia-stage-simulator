# Zinogre S Catapult review

Zinogre S Catapult (`char_1049_catap2`) is a Mercenary Guard. Her source foundation came from `extract-cn-operator.py` and `verify-cn-operator.py`. The art receipt is `source-reviews/catap2.json` in SD.

From data (tables and her own templates):
- **Casts.** Both skills are manual and paid in DP: `cost` is 20 for S1 and 5 for S2. Both store `maxChargeTime` (5) charges. Her ordinary hit lands at the Attack clip event.
- **Talent** (`catap2_s1/s2[trigger]`). A cast consumes every stored charge, with layers = floor(remaining SP / spCost) + 1. It extends the skill by duration × `extend_duration_ratio_each` × layers, and stacks `catap2_s[atk_equip]` ATK per layer (0 at this level). Skill attacks use the skill range (`2-2`).
- **S1.** Base attack time +1.0. The `Skill_1_Begin` morph slash lands five hits at its clip events. After that, attacks alternate the five-hit `Skill_1_Loop_A` and the ten-hit `Skill_1_Loop_B` on every blocked enemy. Every hit adds `atk_magic` × ATK as Arts (`catap2_s1[mag_dmg]`).
- **S2.** +ATK/DEF and a single-hit `Skill_2_Begin` morph slash, with `s2_damage_resistance` while it plays. While S2 is active, Equipment Adaptation (a field button, `retrigger_cost` 10 DP) plays `Skill_2_Overload` (`catap2_s2[extra_dmg]`) and then ends the skill:
  - first event: `attack@extra_physic_atk_scale` Physical plus one `attack@extra_magic_atk_scale` Arts hit;
  - second event: further Arts hits for layers ≥ 2 and ≥ 3;
  - third event: further Arts hits for layers ≥ 4 and ≥ 5.

Declared mappings:
- **Hit areas.** The prefab selector ranges (`ExtraPhysicSelector`, `ExtraMagicSelectorOne`–`Five`) carry no fields, even in the raw typetree.
  - Morph slashes and the Physical adaptation hit strike the enemies she blocks plus the tile ahead.
  - The k-th Arts adaptation hit strikes every enemy up to k tiles ahead.
- **Multi-hit timing.** The later hits of a multi-hit attack land at their own clip events after the first, on the enemies she blocks at that moment.
- **HUD.** The skill timer label shows the table duration, not the extended one.

Validation:
- `test/arkpedia-catap2.test.js` (26 cases) covers:
  - stats, cost, SP and charges at every rank;
  - the blocked ordinary hit;
  - the DP gate and payment, layers, SP clearing and the extended duration;
  - S1 morph hits at the Begin events, the combos and the Arts riders;
  - S2 damage resistance, the adaptation's DP, its Physical hit and per-layer Arts hits, and the skill ending;
  - two 0-1 clears.
- `review-catap2-public.mjs` passes 4 cases on both the candidate and the normal build. They cover the DP-paid cast from the skill button, and the S2 Equipment Adaptation from the field button.
