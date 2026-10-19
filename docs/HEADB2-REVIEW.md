# Zima the Raging Tide review

Zima the Raging Tide (`char_1051_headb2`) is an Earthshaker Guard. The source foundation came from `extract-cn-operator.py`/`verify-cn-operator.py`; the art receipt is `source-reviews/headb2.json` (SD).

From data:
- **Trait and ordinary attack.** Earthshaker splash (radius 1, 50%) on an ordinary hit at the Attack clip event.
- **Talent 1.** Splash damage ×1.24. HIGH tiles inside the hit area pulse 24–27% ATK with 0.5 s sluggish at E2.
- **Talent 2.** During her skills, every deployed operator gets +ATK/DEF, doubled for `teamId: "student"`. The battle now keeps a `regularTeams` map for team-scoped effects.
- **S1.** +ATK and +ASPD.
- **S2.** SP per HIGH tile triggered while charging. Auto start with 2-5 range and +90% ATK / +60% DEF. From the second use it doubles and lasts forever.
- **S3.** +100% ATK. Five 240% blows at the Skill_3 events, each adding +30% ATK. Pulses ×3.5 and bind for 2 s instead of sluggish.

Declared mappings (PRTS notes):
- **Pulse timing and area.** A pulse fires 0.1 s after its trigger from every HIGH tile within 1.0 of the hit centre, on ground enemies of that tile and its 4 neighbours. Its damage is ranged and sourceless.
- **S3 blows.** They land 1.0 ahead of her with a 1.5 splash and ignore attack speed.
- **S3 spreading.** From the second blow, triggered tiles spread to adjacent untouched HIGH tiles, up to (blows completed) steps. Each tile pulses once per blow.

Validation:
- `test/arkpedia-headb2-public.test.js` (38 cases): the 0-1 HIGH tile, stats/cost at all ranks, ordinary/splash/pulse timing and values with sluggish, the aura and its student doubling, S2 SP from pulses with the doubled infinite second use, S3 blows, and three 0-1 clears.
- `review-headb2-public.mjs`: 6 cases on both the candidate and normal builds.
