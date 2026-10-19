# Perfumer the Distilled review

Perfumer the Distilled (`char_1022_flwr2`) is an Abjurer Supporter. The source foundation came from `extract-cn-operator.py`/`verify-cn-operator.py`; the art receipt is `source-reviews/flwr2.json` (SD).

From data:
- **Trait.** Arts attacks at the Attack clip event. While a skill is active she heals allies for 75% ATK instead.
- **Talent.** Sanctuary (14%/16%) for allies in range, not herself, whose HP ratio is at or below hers.
- **S1 (auto, two charges).** An immediate 500% ATK heal and +25% DEF for 10 s, non-stacking.
- **S2 (passive).** +50 ASPD and talent Sanctuary ×2. Each heal grants +30% ATK for 3 s and costs 1% max HP per second; this HP loss cannot kill and does not stack.

Declared mappings:
- The heal target is the injured ally in range with the lowest HP ratio.
- S2 is passive, so with S2 selected she heals for the whole battle.

Validation:
- `test/arkpedia-flwr2-public.test.js` (26 cases): stats/cost at all ranks, Arts attack timing, Sanctuary eligibility and value, the S1 heal and DEF buff, S2 healing-only mode with the ATK buff and double Sanctuary, and both 0-1 clears.
- `review-flwr2-public.mjs`: 4 cases on both the candidate and normal builds.
