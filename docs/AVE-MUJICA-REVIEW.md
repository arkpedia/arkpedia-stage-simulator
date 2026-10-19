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

## Yahata Umiri (`char_4186_tmoris`)

From data:
- **Trait and ordinary attack.** Stalker trait (all enemies in range, 50% Physical/Arts dodge, low threat). Ordinary Physical hit (`_damageType` 1) at the Attack clip's OnAttack event, after her deployment clip.
- **Talent 1.** 21% sluggish for 3 s at E2. The E2 candidate (`mark` 1) carries range y-3, used while a skill is active.
- **Talent 2.** Fever +2 for every sluggish or fear she inflicts. While she is deployed, Ave Mujica members deal ×1.10/×1.15 (by potential) to sluggish or feared enemies. This uses a new per-recipient output multiplier hook in `dealDamage` (`battle._dealtMultipliers`), so a shared area damage object is never mutated.
- **S1.** Two charges, 4 SP per attack. Five Arts hits (`_damageType` 2) on ground enemies in range at the Skill_1 events.
- **S2.** Fears everything in range for 1.5 s on start, deals 100% Arts every second, and multiplies the talent chance by 2.2.

Declared mappings:
- Talent 1 rolls after each damage instance she deals.
- When another Ave Mujica member starts a skill, S1 releases its five-hit burst once more, free, without spending a charge.
- S2 replaces her ordinary attack.

Validation:
- `test/arkpedia-tmoris-public.test.js` (29 cases): source types and events, stats/cost/charges at all ranks, all-in-range Physical attack and dodge, the sluggish rate over ~119 hits with exactly +2 Fever each, the S1 burst and its extra release on Nyamu's cast, S2 fear and ticks, the members' damage bonus against a sluggish target, and both 0-1 clears.
- `review-tmoris-public.mjs`: 4 cases and 28 captures on both the candidate and normal builds.

## Misumi Uika (`char_4184_dolris`)

Uika has a single original model (native binding `Single`). `cn-owner-art.py` gained an explicit single-model mode for her (`"single": true` in the recipe). It verifies that model once as Front and requires Back to be a byte-identical `fixed-original-front` alias, the form Heidi already uses in SD; the Back alias is added in SD.

From data:
- **Trait.** Bard: no attack; heals every injured ally in range for 10% of ATK each second; not inspired herself.
- **Talent 1.** A 35% ATK heal on the lowest-HP ally every 4 s while no skill is active.
- **Talent 2.** Fever +5 per heal of an Ave Mujica member, and a 30% ATK Arts add-on to each target of a member attacking inside her range.
- **S1.** x-2 range; ATK inspiration (55% of her ATK) and DEF inspiration (55% of her DEF); 100 HP heal per hit an inspired ally takes.
- **S2.** The trait stops healing. Every 0.3 s she deals 100% Arts to a random enemy in range and heals an ally for 25% of ATK. The other allies are inspired for 100% of her ATK.

Declared mappings:
- "Lowest HP" means the lowest HP ratio among injured allies; during a skill the heal prefers Togawa Sakiko.
- Talent 1's cooldown starts at its heal, so it fires as soon as someone is hurt.
- The talent 2 add-on is credited to her.

Validation:
- `test/arkpedia-dolris-public.test.js` (27 cases): stats/cost at all ranks; trait and talent 1 heals; Fever only from member heals; the talent 2 add-on value; S1 inspiration and heal-on-hit; S2 trait stop, pulse count and inspiration; both 0-1 clears.
- `review-dolris-public.mjs`: 4 cases and 28 captures on both the candidate and normal builds.

## Wakaba Mutsumi (`char_4183_mortis`)

Built on the generic Dollkeeper stand-in (20 s, switch windows). The stand-in does not attack (`dollNoAttack`).

From data:
- **Ordinary attack.** Physical melee at the Attack clip's event, after her deployment clip.
- **Talent 1.** Physical/Arts taken ×(1 − 0.3), with 0.3 × 0.5 of the raw amount returned as her own Apoptosis. The stand-in gains +24% DEF. Members' attacks have a 20% chance per damage instance to cut the stand-in by 1 s.
- **Talent 2.** Fever +3 per damage or element instance aimed at her, dodged ones included, and +10% max HP for members.
- **S1.** +DEF, +2 block and +1 taunt.
- **S2.** 2-1 range and −0.3 BAT. Three Arts shots per attack at random ground targets in range, with blocked enemies counted. Each successful hit costs her 20 Arts.

Declared mappings (PRTS notes):
- Talent 1 applies to her and the stand-in.
- If she is knocked out during S1, S1 continues on the stand-in until it leaves, and the stand-in blocks with (skill block − 2) instead of 0.

Validation:
- `test/arkpedia-mortis-public.test.js` (28 cases): stats/cost at all ranks; ordinary timing and type; the exact 30%/15% Apoptosis split; Fever and the HP aura; stand-in entry, DEF and member shortening; S1 persisting into the stand-in with the block arithmetic; S2 shots and self-damage; both 0-1 clears.
- `review-mortis-public.mjs`: 4 cases and 28 captures on both the candidate and normal builds.
