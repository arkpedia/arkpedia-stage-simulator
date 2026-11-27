# 15-20, PRTS, Source Code and the Mimic Machine

15-20 "Return to Beginnings" and H15-4 are built on a pair of bosses that work only together:
- **PRTS, Source Code** `enemy_1564_mpprts` (PRTS "PRTS，“源代码”"): it stands on its tile and can be hurt only while the Mimic Machine is down.
- **Mimic Machine** `enemy_1565_mpprme` (PRTS 拟态机械): the fighter. The hand (Intrusive Call) puts it on the field and later holds it in the air.

This batch publishes 15-20, its six-star variant and H15-4 (1,219 available; main story 483 of 564).

Sources: both prefabs, their buff templates and the Mimic's five projectiles (retained in `data/arkpedia-enemy-native-abilities.json`), the clip clocks (`data/arkpedia-prts-source-animations.json`), and the two PRTS pages. Review: `shared/arkpedia/enemy-prts-source-features.js`. Runtime: `server/sim/content/arkpedia-enemy-prts-source.js`.

## PRTS, Source Code

50,000 HP (60,000 at level 1), 3,000 DEF, 75 RES. A 2.95 × 4.95 body centred 2 above its tile. It does not move, attack or get blocked.
- **Standing:** invincible.
- **When the Mimic Machine goes down:** it falls over (2.67 s) and is no longer invincible. It then gains 1 SP every second and 1 SP for each hit it takes.
- **At 50 SP:** it is invincible again at once, the Mimic Machine stands up, and 1.87 s later it is standing.
- **Defeated while exposed:** the Mimic Machine is removed too, without a recovery.
- **Deadline:** 420 s after it appears, and 0.5 s later the battle is lost.

## Mimic Machine

25,000 HP, 600 ATK, 3,000 DEF, 75 RES, range 2.5, one Arts shot every 4 s (level 1: 30,000 HP, 700 ATK). The hand carries it to its tile; its clocks start when it is put down.

**Recovery ("Rebuild")**
- A lethal hit on the ground does not defeat it while PRTS, Source Code stands. It falls (1 s), is restored to full HP and is invincible, unable to move or attack.
- When that state starts: ATK +100 (up to five times), PRTS, Source Code falls over, and DP comes about three times as fast (the interval × 0.33).
- When PRTS, Source Code reaches 50 SP it stands up (1.73 s) in its second phase, and its skills start over.
- **The first downing releases the wave.** Enemies of wave 0 already on the field no longer hold it; the rest of wave 0's schedule still runs, as for the other bosses that release a wave.

**Write Restriction** (5 s after it is put down, and again 5 s after each recovery)
- A 4.83 s cast; 2.63 s in it fires at the deck. The shot takes 0.8 s and bursts 1 s later.
- The four costliest cards that are waiting, ready and not sealed cannot be deployed for 20 s.
- After a recovery the game also locks the top bar (pause, speed, settings). That is interface only and is not built.

**Heavy Ion Elastic Recoil** (first after 12 s, then every 12 s; on the ground only)
- A 6.83 s cast; 4.57 s in it fires an orb at the nearest operator. The orb follows its target at 2 tiles a second for up to 10 s.
- It stops when an operator enters its collider (radius 1.0), and bursts 0.75 s later: Arts damage of 240% ATK within 1.5.
- Every 0.25 s of flight: collider −0.05, burst radius −0.075, damage −10% of ATK, 14 times at most (0.3, 0.45 and 100%).

**Dynamic Deployment** (first after 20 s; after a recovery, first after 50 s)
- It stops, and 1.1 s later calls the hand. This order goes ahead of every other order the hand has.
- The hand flies to it and takes hold (0.93 s into the clip); 0.27 s later it is in the air.
- **In the air, 25 s:** it counts as a flying unit and cannot be blocked. Range 3.5, attack interval 3.5 s, two targets (after a recovery: range 4.5, interval 3 s). It keeps walking its route, and the hand stays on it.
- **Shot down early:** it records its HP ratio minus 30% at take-off. A hit that leaves it at or under that lands it.
- **It cannot be downed in the air.** A lethal hit leaves it at 1 HP and lands it.
- **Landing:** 0.9 s, then the 1.67 s clip. The hand lets go and takes its next order.

**Chain Reaction** (after a recovery only; first after 10 s)
- Needs a Weakening Node that the player has not switched on. Same take-off.
- **In the air, 20 s:** no normal attack. It fires a beam through each such node (up to three), 0.5 wide and running 15 tiles past the node. Every second, operators on a beam take Arts damage of 50% ATK.
- The same early landing as above (the recorded ratio is never under 1%).

## Where the sources disagree or are silent

| Point | Reading | Why |
|---|---|---|
| Chain Reaction's time in the air | 20 s | `FlyRay.duration` sets the whole flight. PRTS says 25 s for the flight and 20 s for the beams. |
| The deadline | The battle is lost | The template ends in `FinishGame LOSE`. The handbook says it "drains all Life Points". |
| HP after a recovery | 100% | PRTS. The prefab's `_hpRechargeRatio` is 0.5, read as full HP as for the other reviewed bosses. |
| Does it move while held? | Yes | Its fly modes carry no UNMOVABLE flag; only the downed state does. [inference] |
| Cooldown of the take-off skills | Counted from the moment the hand has hold of it | The skill lasts until then (`_waitForAttachFinishEvent`). Counted from the cast, it would take off again the moment it lands. [inference] |
| Skills after a recovery | All start over | PRTS says the card seal "becomes stronger after the first recovery", so it is cast again; its cooldown is 999 s. [inference] |
| Skills during a flight | Their cooldowns keep running | Not stated. [inference] |
| Which cards on a cost tie | The later card in the deck | PRTS: "the rightmost". The simulator's deck order stands in for it. [inference] |
| Beam damage type | Arts damage | The template applies MAGICAL damage. PRTS calls it Arts HP loss. |
| The Spawn talent in the prefab | Off | The records give it no parameters. A record that does is refused. |
| Wave 1's two Shadows, sent to the tiles of wave 0's fixed Hot Drink Machines | The deploy fails while a machine stands there | PRTS: a highland target taken by any character unit fails the deploy. Those spawn routes are marked FLY, and PRTS also says a flying unit's deploy cannot be stopped; the Shadow's own record is a ground unit, so it is not read as flying. [inference] |

## The hand

`StagePrtsControl` (`arkpedia-stage-prts-control.js`) now keeps its orders by priority, as the game's templates number them: carrying an enemy 0, a Weakening Node's call 100, holding the Mimic Machine 200. Within one priority the first order goes first. A hold order: fly to the unit, take hold (`Grab_Begin_2`), stay on it until it lands, let go (`Grab_End_2`), fly back. A lethal hit on the Mimic Machine drops a hold order that has not started.

## Checked

`test/arkpedia-stage-15-20.test.js`:
- **Reviews:** both bosses pass at both levels. Another deadline, flight time or orb damage, and a record that turns the Spawn talent on, are refused.
- **Opening:** PRTS, Source Code is on 1,1 with its body, invincible (a 5,000 hit does nothing). The Mimic Machine is carried in and put on 2,3 at 16.6 s, uncounted. With no player the battle is lost at 420.5 s.
- **Write Restriction:** with six cards, the four costliest are sealed ("Sealed by the Mimic Machine.") and freed 20 s later.
- **The orb:** it flies 2 tiles in the first second, by then at 200% ATK, radius 1.2 and collider 0.8; it stops when the operator enters its collider and bursts 0.75 s later.
- **Dynamic Deployment:** it stops and waits; in the air it is a flying unit with range 3.5, interval 3.5 s and two targets, it moves, and the hand is on it. 29% of its HP in damage does not land it; the next hit does. The next take-off comes 35 s after the hold; a full flight lasts 25 s.
- **A lethal hit in the air** leaves it at 1 HP, landing, and not downed.
- **Recovery:** downed at full HP and invincible; the wave is released; PRTS, Source Code is exposed 3.67 s later and DP comes 3.03 times as fast. Three hits give 3 SP, and it stands up 47 s after it fell. The Mimic Machine is back with 700 ATK. After six more recoveries it has 1,100 ATK (five stacks).
- **Defeating PRTS, Source Code while exposed** removes the Mimic Machine and ends the DP boost.
- **Chain Reaction:** after a recovery it is held for 20 s with two beams. An operator placed 2 tiles past the first node takes Arts damage once a second. With every node switched on by the player it does not take off.
- **H15-4 and six-star 15-20** load with their own numbers (level 1 records; 60,000 HP and 660 ATK at 120% and 110%) and run to the deadline without errors.
- **A cleared run** (every ordinary enemy defeated on sight, the Mimic Machine downed, PRTS, Source Code hit while exposed): wave 1 starts after the first downing and the stage clears without errors. The two Shadows sent to the machines' tiles are lost; with the machines destroyed first they are fixed there.
- **Edge cases:** a take-off under 30% HP is not landed by an ordinary hit, only by a lethal one; a lethal hit in the air restores its range, interval and target count; in six-star 15-20 the hand moves at 130%.
- **Counts:** 29 counted enemies before summons in 15-20 and 37 in H15-4, as PRTS lists. The two Hot Drink Machines become fixed forms.
- **In the browser:** the stage opens (10 enemy types, 2 waves, 3 life points) with no console errors. A battle was not watched there.

## Not checked

- In game.
- **A run with real operators.** The cleared runs are driven by direct hits; no test wins the stage with a squad.
- **The readings in the table above.**
- **H15-4 beyond its count:** it loads, runs to the deadline and has PRTS's 37 enemies; its waves were not walked through.
- **The card seal in the browser.** It is the one new thing the player touches, and it was only tested headless.
- **No art:** both bosses draw as ordinary units. The orb, the beams and the held state have no drawing of their own, and the card seal shows only as a refused deploy with its message.
