# Ave Mujica collab review

The five Ave Mujica operators share one battle-wide **Fever** gauge: Togawa Sakiko (`char_4182_oblvns`), Wakaba Mutsumi (`char_4183_mortis`), Misumi Uika (`char_4184_dolris`), Yūtenji Nyamu (`char_4185_amoris`) and Yahata Umiri (`char_4186_tmoris`). This document covers the shared system and each member as they are admitted.

## Source

- All five owner foundations come from `extract-cn-operator.py`/`verify-cn-operator.py` at table commit `a550f5e0` and CN client `26-09-22-07-47-20_6c71fa`.
- Sakiko's extraction exposed an extractor bug. Her S1 references `projectile_chr_oblvns_s1_hit` as an `_audioSignal` value, which the scanner treated as a prefab and failed on. `_audioSignal` is now skipped like the other two audio-signal fields, in both the extractor and the independent verifier. No existing receipt contains such a value, so none changes.
- `tools/arkpedia/fever-source.mjs` writes `data/arkpedia-fever-source.json`:
  - `feverGameData` from the pinned `gamedata_const.json`: 450 needed, 20 s.
  - The official `ba.fever` and `ba.mujica` term text. The member list is checked against the latter.
  - Each member skill's Fever component: `_tryJoinFeverOnSkillStart`, `_continusCastWhenInFever`, `_leaveFeverWhenSkillEnd`, `_skipSkillStateTickJoinFever` and the joined buffs with their abnormal flags.
  - Every template action that reads or writes Fever.

## Shared Fever system (`server/sim/content/arkpedia-fever.js`)

From data:
- **Gauge.** Cap 450, duration 20 s. Members add through their own talents (`AddFeverBySourceIfNotFull`: no gain while full or active).
- **Joining.** A member joins Fever on skill start where the component says so.
- **While joined.**
  - Skills with `_skipSkillStateTickJoinFever` hold their timer.
  - Joined buffs with flag 1 (`SP_RECOVER_STOPPED`) stop SP recovery.
  - `_continusCastWhenInFever` skills are re-cast while idle.
  - `_leaveFeverWhenSkillEnd` members leave Fever when their skill ends.

Declared local mappings (interpretation of the official term text and PRTS notes, not recovered native behaviour):
- **Trigger.** Only a manual skill start at a full gauge starts Fever. A full-charge auto release does not (PRTS, Sakiko S1).
- **Start.** Starting Fever empties the gauge and joins every member on the field. A member whose current skill is idle and not continuous-cast is started free. **Open question for an in-game check:** does Fever really force-start idle members' skills?
- **Timers.** A held skill timer resumes after Fever.

The battle HUD shows `Fever n/450` once a member exists, and `FEVER · Ns` while active.

## Yūtenji Nyamu (`char_4185_amoris`)

From data:
- Earthshaker trait splash (50% of the hit's ATK multiplier).
- Ordinary hit at the Attack clip's single OnAttack event.
- S1: three hits at the Skill_1 events. 160%, then 20% and 20%; the heavy hit's collider radius is 1.5.
- S2: eight hits at the Skill_2 events. The 1st and 5th are 125%, the rest 10%, each at a random target in the x-4 range.
- Hit collider radii come from the projectile prefabs.
- Talent 1: 10% fragile (8% for 2 s at E2).
- Talent 2: Fever +3 per second, plus the Ave Mujica ATK aura.

Declared mappings (PRTS notes):
- **Continuous attack.** With no target she strikes the tile in front (S2: a random tile in range), and only the splash lands. She does not attack when that tile is off the map.
- **S1 range.** S1 shrinks her range to the single front tile.
- **Talent 1 roll.** Talent 1 rolls once per damage instance she deals, before it.

Validation:
- `test/arkpedia-amoris-public.test.js` (31 cases): Fever source reproduction, colliders, admission, stats/cost/SP at all ranks, ordinary timing and splash, continuous attack, S1/S2 hit sequences, the Fever gauge/start/timer hold/SP stop/end, the below-450 refusal, retreat cleanup, and 0-1 clears with both skills.
- `review-amoris-public.mjs`: 4 desktop/touch cases and 28 captures on both the candidate and normal builds, with no errors. It includes the Fever HUD and a Fever start from the skill button.

Still unapproved: native finish/FSM/control, effects/audio, modules, compiled frame/pixel parity.
