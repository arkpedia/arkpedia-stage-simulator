# Undertide Gloompincer visibility benefit

Undertide Gloompincer and Undertide Gloompincer α now consume a shared environment-stat component. Their native condition bit is 8, their movement modifier is additive +30%, and the source buff is silenceable. The component owns one stat instance, removes it when the condition clears or silence applies, and continues evaluating while frozen. Independent movement bonuses compose through the ordinary stat pipeline.

Stage components provide `battle.environmentConditions.maskAt(actor)`; an absent provider means no active conditions. This keeps visibility ownership with the stage and the benefit with the enemy. The original lighting controller remains gated for the stages phase. A selected stage must implement that provider before claiming night visibility support; these fixtures inject the mask explicitly and do not claim an original night-stage clear.

Native admission checks the sole mode, ordinary physical melee, condition checker and toggle, exact modifier formula, silence/control flags and record values. The ordinary enemy additionally retains its source killed-result passive through the shared outcome counter. The elite has no such passive and does not invent one. Both original native bodies are pinned to asset commit 62d521e60b6cc426237419f0510f8b24828ca188. They have different skeleton/texture bytes and are not aliases.

Forty-eight admission/loading regressions and 67 overlapping shared-component tests pass. Desktop/touch fixtures verify ratios 1.0 → 1.3 → 1.0 under darkness, visibility and silence, with freeze retaining the bonus. Only the selected environment-stat and outcome modules load. Both bodies decode all five clips and render correctly in the desktop/touch gallery. Native callback/frame ordering and lighting effects are not certified by these isolated fixtures.

Combat coverage increases from 726 to 728 enemies, with 793 database levels. The existing 970 stage graphs remain pinned until the stages phase.
