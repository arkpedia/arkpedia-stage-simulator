# Mephisto (`enemy_1507_mephi`)

The Reunion healer boss of chapter 5, at two levels:

| Level | HP | ATK |
|---|---|---|
| 0 | 28,000 | 500 |
| 1 | 60,000 | 1,000 |

Both levels: range 20, speed 0.5, BAT 6, `dmgType` heal. He was the last blocker of **5-10 "The Dark Before Dawn"** and its Challenge, which also needed Faust (`docs/ENEMY-FAUST-REVIEW.md`).

`shared/arkpedia/enemy-reunion-mephisto-features.js` holds the contract. It pins:
- both records (talent `healaura`, no skills);
- every component reachable from `Heal`, `HealAura` and `Trigger`;
- the `empty` template;
- the Attack clip from `refs/arts/enm_art_16.ab` (3.167 s, event at 1.1 s).

The runtime is `server/sim/content/arkpedia-enemy-reunion-mephisto.js`, kind `reunionMephisto`.

**Feature keys.** `talent:healaura` belongs to the Singer's contract (`enemy_1514_smephi`), which dispatches it here for this Mephisto.

## The heal

- **Targeting.** His only attack heals. The attack trigger selects his own side, ground and air (`_targetSide` 1, `_targetMotion` 3), within his range (the scalable range-1 selector at `rangeRadius` 20). `_postFilter` 3 is read as the Wither Caster review read it: injured units, lowest HP ratio first. `_maxNum` 3.
- **The cast.** The Attack clip heals each target for ATK at its event (the heal ability has no scale key; `_isHpRatio` 0).
- **Timing.** One cast per attack interval (6 s). There is no cast without an injured target (`_allowNoTarget` 0).
- **No attack on operators.** Mephisto never attacks an operator, so the heal runs on its own clock rather than the generic attack; he stands still for the clip.

## The aura

`mephi_t_healaura` goes on every unit of his side, field-wide. It is the same aura script as Inspiration's, which has no range. It applies HP_RECOVERY_PER_SEC MULTIPLIER + `hp_recovery_per_sec` (1), so allied enemies regenerate twice as fast while he lives.

## Verification

`test/arkpedia-reunion-mephisto.test.js`:
- **Admission.** Both levels are admitted, and the Singer keeps `talent:healaura`. The parameters are 3 targets, a 6 s interval and ×2 regeneration.
- **Heal.** No cast while nobody is hurt. Then one heal reaches the three most hurt allies for ATK and not the fourth, and the next comes on the 6 s clock.
- **Aura.** It doubles allied regeneration (10 → 20 HP/s) and lifts on his death.
- **Compiled stages.** 5-10 and 5-10 Challenge field Mephisto and Faust at their stage stats, with the `faust_ballis` branch, and no battle errors.

The library rebuild published 5-10 and 5-10 Challenge (1,054 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,054 graphs with no failures. Browser review: 5-10 runs with no console errors, and Mephisto enters with his original art from asset commit `6264770b`.

## Boundaries

- **Stacking.** Two Mephistos' auras would multiply, not add. No stage fields two.
- **Effects.** The heal effects are not played.
