# Lost Colossus, Jetman and Wandering Puppet

Three Integrated Strategies mid-bosses. Each one alone blocked one Phantom & Crimson Solitaire stage:
- Lost Colossus (`enemy_2003_rockman`): ISW-DF "Mind the Doors" (b-1);
- Jetman (`enemy_2004_balloon`): "Theft from Above" (b-2);
- Wandering Puppet (`enemy_2013_csbot`): "Fatal Melodies" (b-4).

Each has one database level. Each is admitted from its pinned CN prefab (`battle/enm_pfb_19.ab`) and the Global buff templates.

`shared/arkpedia/enemy-phantom-midboss-features.js` holds one contract per enemy. Each contract pins:
- the record (stats, abilities, talents, skills);
- every component reachable from the retained abilities;
- the templates they name;
- the clip clocks: Lost Colossus and Jetman from `refs/arts/enm_art_17.ab`, the Puppet from `enm_art_18.ab`.

The runtime is `server/sim/content/arkpedia-enemy-phantom-midbosses.js`, with three kinds: `lostColossus`, `jetman` and `wanderingPuppet`.

The rules not fixed by the data come from the English wiki (arknights.wiki.gg: `Lost_Colossus`, `Jetman`, `Wandering_Puppet`).

## Lost Colossus

**Stats.** 75,000 HP, 1,500 ATK, 600 DEF, 0 RES, attack interval 4.4. b-1 raises his HP to 80,000.

**Attack.** A melee attack. The Attack clip is 5.17 s, with its hit at 2.77 s.

**StunAttack (the rock).** `skill:StunAttack` is the Punisher's key too. `enemy-features.js` dispatches `covers`, `ability` and `explains` to this contract for him.
- **Timing.** Cooldown 13 s, the first after 13 s. The cooldown runs from the cast start.
- **Target.** One operator, ground or aerial, within the 2.5 trigger collider. The selector excludes any unit with the `stun` buff.
- **The throw.** He stands through the 2.33 s Skill clip and does not attack meanwhile. At its event (1.07 s), the speed-10 `projectile_enemy_rockman` flies to the target.
- **The hit.** 70% ATK Physical (`atk_scale` 0.7), then the database stun for 25 s (`stun`).
- **No target.** When every operator in reach is stunned, he waits until one is free.

## Jetman

**Stats.** 58,000 HP, 400 ATK, 280 DEF, 30 RES, attack interval 2. b-2 raises him to 70,000 HP and 500 ATK.

**Attack.** A melee attack. The Combat ability does not wait for the clip event: its 0.63 s pre-delay is the hit.

**TakeOff (`skill:TakeOff`).** The skill casts every 25 s, the first after 1 s. Its trigger is the self selector, so it always succeeds; the cooldown runs from the cast.

1. **Arming.** The cast installs `balloon_s[trigger]` (`enemy_balloon_s`), unless one is already waiting.
2. **Waiting.** Every 0.33 s the trigger checks whether he is blocked (`CheckBlocked`).
3. **Take-off.** When he is blocked, the trigger ends, he is released, and:
   - `balloon_s[fly]` for 7 s (`duration`): BLOCK_FREE, motion FLY, the Fly mode (no attack), and move speed +50% (MULTIPLIER `balloon_s[fly].move_speed` 0.5);
   - `balloon_s[take_off]` for 1.5 s: move speed FINAL_SCALER -0.9.
4. **Landing.** When the flight ends: motion WALK, the Default mode, and `balloon_s[land]` for 1.333 s (BLOCK_FREE, FINAL_SCALER -0.9).

A cast while a trigger is waiting does nothing. A cast during the flight arms a new trigger, which can fire only after he lands.

## Wandering Puppet

**Stats.** 40,000 HP, 900 ATK, 800 DEF, 50 RES, attack interval 1.5.

**Not blocked (Default mode).** The Poison talent has no selector. Every opposing unit on the map gets `enemy_csbot_t` (the `enemy_toxcar_t` template): no-source Arts damage of `poison.damage` (100) every 1 s, the first after 1 s. The damage gives no SP.

**Blocked.** A block checker (at least one blocker) switches him to the Combat mode, which detaches the Poison (`_removeBuffWhenAbilityDetached`). The buff is removed, and he attacks with the Combat clip: 2 s, hit at 1 s. Being defeated or leaking also ends the buff.

**Several Puppets.** The buff has one shared key, one stack and `disableOverride`, which an earlier review (Aphrissa) read as "an existing same-key buff is kept". So an operator holds one Puppet's buff at a time: 100 Arts per second however many Puppets are unblocked. When that Puppet is blocked or gone, another unblocked Puppet's buff lands, with its own fresh 1 s timer. b-4 spawns three Puppets.

## Stage compile: an empty random choice

b-1's third Lost Colossus spawn is drawn from random group `g1`. One option there is a SPAWN with an empty key (weight 20): nothing spawns.
- The wave compiler (`tools/arkpedia/stage-waves.mjs`) and the random-wave runtime already handled this choice as an `emptyChoice`.
- Only the stage enemy check (`shared/arkpedia/enemies.js`) refused the viewer row `enemy_id: ''`. It now skips that row when it belongs to a random group and the stage has an original wave program; that program pairs the row with its empty choice, or the stage is refused.

No other published stage changed.

## Verification

`test/arkpedia-phantom-midbosses.test.js`:
- **Admission.** All three are admitted. Each of these is refused:
  - a changed stun;
  - a larger trigger collider;
  - stunned units no longer excluded;
  - a changed blocked check or cooldown;
  - the Poison not removed on detach;
  - Physical instead of Arts.
- **Lost Colossus.** The rock at 13 s hits the nearest operator within 2.5 for 70% ATK Physical and a fresh 25 s Stun, and no farther operator. The next rock skips the stunned operator. With every operator in reach stunned, he waits, then throws once the Stun ends.
- **Jetman.** He is armed after 1 s. Once blocked, he takes off within one 0.33 s check: unblocked, block-free, aerial, no attacks, move speed x0.15 for 1.5 s, then x1.5. He lands after 7 s, block-free and x0.1 for 1.333 s. He is not re-armed until the next cast. Unblocked, he never takes off, and a waiting trigger is not doubled.
- **Wandering Puppet.** Every operator, on the route and off it, takes 100 Arts per second, the first after 1 s, with no source. Nothing while he is blocked; the melody resumes once he is free. With two Puppets, an operator takes 100 per second, not 200. When the playing Puppet is blocked, the other takes over after its own 1 s.
- **The empty choice.** An empty random-group row passes the stage enemy check only with an original wave program.
- **Compiled b-1, b-2 and b-4.**
  - b-1: Lost Colossus at 80,000 HP stuns a deployed Myrtle.
  - b-2: Jetman at 70,000 HP and 500 ATK arms his take-off.
  - b-4: an unblocked Puppet hurts the operator every second.
  - No battle errors on any of the three.

The library rebuild published exactly these three stages (1,020 available); no other stage's bundle changed. `check-stage-library.mjs` smoked all 1,020 graphs with no failures. The browser review passed, and the three stages load in the preview with no console errors.

## Boundaries

- **Lost Colossus target order.** The selector's `_postFilter` 11 is read as the nearest operator.
- **Lost Colossus fallback.** The wiki says he throws at a stunned operator when no other is available. The selector excludes the `stun` buff outright, and the handbook line says he "will not target a unit that is already Stunned". The data is kept.
- **Jetman landing early.** The wiki says the flight ends early on Stun, Freeze or Sleep. `balloon_s[fly]` is not stunnable, freezable or sleep-sensitive in its flags, so the data is kept. This is an in-game check.
- **Jetman's route.** In flight he keeps his walking route (motion FLY, route unchanged), so he always lands on a path tile. UNBALANCE_IMMUNE needs nothing more: the engine never displaces a flying enemy.
- **Wandering Puppet stacking.** Several unblocked Puppets deal 100 per second in total, not 100 each, from the `disableOverride` reading above. This is an in-game check for b-4.
- **Wandering Puppet targets.** Operators and summons; devices such as b-4's batteries are not hit (target category 1, as for the other category-1 selectors).
- **Log talents.** Lost Colossus's and Jetman's `Log` talents (`log_killed`, a kill counter for the mode's statistics) sit outside the extraction scope and are not pinned. They have no combat effect.
- **Presentation.** The rock, the jetpack and the melody effects are not reproduced.
