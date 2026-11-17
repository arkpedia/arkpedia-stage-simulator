# "Emperor's Blade", Pursuer

`enemy_1520_empgrd` (two database levels: 28,000 HP / 600 ATK and 40,000 HP / 700 ATK; otherwise identical) is admitted from its pinned CN prefab (`battle/enm_pfb_18.ab`, retained with the scope in `extract-enemy-native-abilities.py`) and the Global buff templates.

The contract (`shared/arkpedia/enemy-emperors-blade-features.js`) pins the following:
- every component reachable from the retained abilities, by local reference or shared GameObject (87 components, including the revive component on the `Reborn` GameObject);
- the five `enemy_empgrd_*` templates;
- the three projectiles (`projectile_enemy_empgrd`, `_aoe`, `_effect`), now retained by the extractor;
- the `x-1` and `0-1` ranges;
- the clip clocks from `refs/arts/enm_art_16.ab`.

Any change refuses the record. The runtime is the new `emperorsBlade` kind.

PRTS (`“皇帝的利刃”，追猎者`) and the EN wiki (`Emperor's Blade/Pursuer`) were read to settle the points the data does not fix; each is named below.

## First form

**Attack.** The attack is ranged and physical, at 1× ATK, with range 2. It hits ground units only (the attack selector has `targetMotion` 1). It stands for the Attack01 clip (1.067 s, strike at 0.6 s).

**Dominion (`BlackFog`, `BlackFogTriggerP1`).** `HpRatioTrigger` fires each time the HP lost reaches an integer multiple of `hp_ratio` × max HP (0.5: at 50%; PRTS: "已损失生命值达到最大生命值50%的整数倍"). The trigger runs the `BlackFog` ability with its damage-recorder selector, then clears the damage tally (`ClearFirstBuffBlackboardByKey` on `empgrd_damage_buffer`).

- **Target.** The selector picks one targetable operator: first one not holding `empgrd_blackfog`, then the highest damage dealt to him since the last Dominion. This is the native low-priority buff key; Invisible and Camouflaged operators are skipped, as the EN wiki says.
- **After 1.45 s** (`_delayToStart` of both projectiles):
  - A permanent zone covers the `x-1` diamond (13 tiles) around the target's tile. If the target has left by then, the zone appears around the Pursuer's tile instead, as the EN wiki says.
  - Every operator within 1.8 of the centre (the AOE collider; `BlackFog.range_radius`) takes 1× ATK Arts splash damage. This includes aerial operators.
- **Pulse.** The zone pulses every 0.3 s and gives every unit standing in it, of either side (untargetable units included, `_ignoreTargetFree`), the 0.6 s `empgrd_blackfog` buff:
  - Operators get −50 ASPD. The buff does not stack.
  - A unit of his side gets the 0.5 Physical and Arts damage resistance (`damage_resistance` template) only if it carries `empgrd_mark_self`, which only he does.
  - Once the Pursuer has left the field, the side check fails for everyone and enemies are slowed too (EN wiki, PRTS).
- The zones are battle state (`battle.emperorDominion`) and outlive him.

**Collapsing Fear (`BlackRingP1`).**
- Cooldown 20 s, initial cooldown 20 s.
- It casts only when a selectable operator is within radius 2 (plus the 0.25 collider).
- The Pursuer stands for Skill_01 (1.767 s). At its strike (1.067 s) he selects again and deals 1× ATK Arts splash damage to every selectable operator in range, aerial ones included.
- It then defeats (`InstantKill`, `_skipReborn` false) every selectable target holding `empgrd_blackfog`.

## Revive

The revive component (`_maxRespawnCnt` 1, `_modeIndex` 1, `_hpRechargeRatio` 0.5) runs `RebornSkill`:
- Skill_02_Begin 1.8 s, then Rest 3 s (`rest_duration`), then Skill_02_End 2.4 s. These add up to exactly `Reborn.duration` 7.2 s.
- During it he is invulnerable, untargetable and inert (the shared `reborn()`).
- At Skill_02_Begin's strike (1.167 s) Collapsing Fear hits every selectable operator on the field with `Reborn.atk_scale` × ATK and defeats the Dominion holders.
- He then stands up with full HP (checked in game by the owner, 2026-11-17), gets `reborn_up` (ATK +`Reborn.atk`, a MULTIPLIER modifier read as +50%), and has `reborn_invincible` for 10 s.
- The damage tally is cleared.

## Second form

- **Attack.** He attacks his blocker with the Combat ability. Its own `_atkScale` is 0, and the `enemy_empgrd_atkscale` buff deals one 2.5× ATK physical melee packet. Any other target takes the 1× ranged attack (PRTS: "被阻挡时进行近战攻击，造成攻击力250%的物理伤害").
- **Dominion.** It is cast at every 25% of max HP lost (`BlackFogTriggerP2`), counted from the full HP he revives with.
- **Collapsing Fear (`BlackRingP2`).** The same, with radius 2.5. Its cooldown restarts at 20 s.

## Stage multipliers

DC-8 Challenge applies `enemy_talent_blackb_mul`: `BlackFogTriggerP1.hp_ratio` ×0.6 and `BlackFogTriggerP2.hp_ratio` ×0.8. `talent:BlackFog` declares both keys, and the contract accepts any ratio in (0, 1] for them. Every other value stays pinned.

## Verification

`test/arkpedia-emperors-blade.test.js`:
- admission of both levels, and refusal of a changed talent, a zero threshold, a changed instant-kill node, a changed AOE radius or a changed revive ratio; the DC-8 Challenge thresholds are admitted;
- the Dominion appears 1.45 s after the 50% threshold, on the top damage dealer, with the Arts splash, the 13-tile diamond, −50 ASPD, and halved damage on him while he stands in it;
- an operator outside every Dominion is preferred to a bigger damage dealer inside one;
- Collapsing Fear at 20 s: an operator holding the Dominion within 2 is defeated, another takes Arts damage, one at distance 3 is untouched;
- the knock-out: the field-wide cast, revive at full HP with +50% ATK and 10 s invincibility, and a Dominion after a further 25%;
- the second form's 2.5× melee on its blocker and 1× on others;
- a Dominion outlives him and slows enemies after he leaves;
- compiled DC-8 from the published library: the Pursuer spawns, revives into the second form, stays invincible, and his second knock-out is final, with no battle errors.

The library rebuild published exactly five more stages (DC-8, DC-8 Challenge, WD-8, WD-EX-8 and WD-EX-8 Challenge; 983 available). `check-stage-library.mjs` smoked all 983 graphs with no failures. The browser review passed, and DC-8 opens in the preview.

## Boundaries

- **Revive HP.** He revives at full HP: the owner checked in game on 2026-11-17, matching PRTS ("回复100%生命值"). The native `_hpRechargeRatio` is 0.5 and stays pinned; it does not set the revive HP here, although the Blade Knight (0.2) and Jesselton (1) contracts read the same field as the HP after reviving. Recheck those two if their revive HP is ever questioned.
- **One cast per crossing.** A single hit that crosses two thresholds raises one Dominion, and the count moves past both.
- **Damage tally.** The tally adds the amount of every damage receipt from an operator-side source, before shields and HP floors. The native `RecordDamageModifier` filter is not decompiled.
- **The Combat clip.** Blocked attackers do not stand, so the 1.867 s Attack02 clip only changes the visuals, which use the shared attack animation.
- **Untargetable revive.** The shared `reborn()` makes him untargetable during the 7.2 s. The native component only marks invincibility.
