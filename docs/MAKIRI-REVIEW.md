# Matsukiri review

Matsukiri (`char_4199_makiri`) is a "counsellor" Vanguard: blocks two and supports cards in the deployment zone. The source foundation was extracted and verified by `extract-cn-operator.py`/`verify-cn-operator.py`. The art receipt is `source-reviews/makiri.json` (SD).

From data:
- **Ordinary attack.** Physical melee at the Attack clip event, after deployment.
- **Talent.** After 30 s on the field, once: Defenders and Supporters on the field and in the deployment zone get +12% ATK at E2 P5.
- **S1 (auto at full SP).** +10 DP, and the rightmost card costs 4 less.
- **S2 (manual, 15 s).** 15 DP over the skill, +70% ATK and 10% max HP regen per second. On start, Defender/Supporter cards cost 1 less and gain +15% max HP (up to 2 stacks).

New generic piece: `StandardBattle.cost()` applies a per-card `costDelta`, cleared when that operator deploys.

Declared mappings:
- **Rightmost card.** The last undeployed operator card in this simulator's shelf order (squad order).
- **Card discounts.** They last until that operator next deploys.
- **Talent ATK.** It lasts for the rest of the battle; a card receives it when deployed.
- **S2 max HP.** The stacks apply on the next deployment and clear on retreat.
- **S2 DP.** A full-duration S2 delivers any of the 15 DP still owed as it ends.

Validation:
- `test/arkpedia-makiri-public.test.js` (25 cases): stats/cost at all ranks, S1 auto DP and the single-card discount, S2 DP total, ATK, card discount and the HP stack on deploy, talent timing and later deployments, and both 0-1 clears.
- `review-makiri-public.mjs`: 4 cases and 20 captures on both the candidate and normal builds.
