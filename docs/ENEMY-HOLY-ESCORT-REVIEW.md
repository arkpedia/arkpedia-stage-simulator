# Vesperwings and Wasteland Robbers (HE-EX-1)

The two enemy families that, between them, blocked HE-EX-1 "Come Ye Faithful" and its Challenge:
- **Vesperwing** (`enemy_1336_bldbat`): 3,500 HP, 150 ATK, aerial, ranged Arts, range 1.5, attack interval 3. Bleed value 30.
- **Startled Vesperwing** (`enemy_1336_bldbat_2`): 4,500 HP, 200 ATK. Bleed value 60.
- **Wasteland Robber** (`enemy_1337_bhrknf`): 5,500 HP, 350 ATK, Physical, range 2, attack interval 2. SP cost 2.
- **Elite Wasteland Robber** (`enemy_1337_bhrknf_2`): 7,000 HP, 450 ATK. SP cost 1.

All four are admitted from their pinned CN prefabs. `shared/arkpedia/enemy-holy-escort-features.js` holds the contract. It pins each record verbatim, every component reachable from the retained abilities, the templates (`bldrat_t_1[blood]`, `blood_dec`, `bhrknf_t_1[cost]`), both projectiles, and the attack clips from `refs/arts/enm_art_13.ab`.

The runtime is `server/sim/content/arkpedia-enemy-holy-escort.js`, with the kinds `vesperwing` and `wastelandRobber`.

**Feature keys.**
- `skill:BloodHit` and its Bleed ability line are the Gnawbeasts'. `enemy-gnawbeast-features.js` dispatches them to this contract for the Vesperwings.
- `skill:CostRangedAttack` and `skill:CostMeleeAttack` are new keys.

## Vesperwing

- **SP.** SP rises by 1 per attack, up to 1. BloodHit costs 1, so every second shot is a BloodHit.
- **Shot.** Both shots are the same speed-10 `projectile_enemy_bldbat` (lifetime 10) for ATK Arts.
- **Bleed.** On a BloodHit's accepted hit, the Gnawbeast's native program `bldrat_t_1[blood]` runs. If the Vesperwing is not silenced and the target is not a token or trap, the program adds `blood_dec`: the target loses `blood_value` HP every second for `blood_duration` (5) s.

## Wasteland Robber

- **Attacks.** When blocked, it strikes its blocker (Combat, clip `Attack_2`). Otherwise it fires the speed-10 `projectile_enemy_bhrknf` (Attack, clip `Attack_1`). Both deal ATK Physical.
- **Cost attacks.** SP rises by 1 per attack, up to `maxSp`. The Cost skills (melee when blocked, ranged otherwise) make the next attack a cost attack. Its accepted hit on a non-token, non-trap target runs `bhrknf_t_1[cost]`: `ModifyCost` by `cost` (−1 DP) for the target's owner, unless the Robber is silenced.
  - The native program compiler does not support `ModifyCost` yet, so the runtime applies it directly. The template is pinned literally.

## The Holy Statue

Both handbook lines say they prioritise the Holy Statue, a stage device. That priority is not modelled, so both runtimes **refuse any stage that has devices**. HE-EX-1 has none.

## Verification

`test/arkpedia-holy-escort.test.js`:
- **Admission.** All four are admitted, and the Gnawbeast keeps its BloodHit. A cost action on the wrong unit is refused.
- **Vesperwing.** Both variants Bleed their target after the second shot, and the target loses `blood_value` the next second.
- **Robber.**
  - Free, it shoots, and exactly one DP steal (of −1) lands per cost cycle.
  - Blocked, it uses the melee clip and strikes its blocker.
- **Compiled HE-EX-1.** Both variants appear at least at their record HP. No battle errors.

The library rebuild published HE-EX-1 and its Challenge (1,039 available); no other stage's bundle changed. `check-stage-library.mjs` smoked every graph with no failures, and the browser review passed.

## Boundaries

- **Holy Statue priority.** It is refused on device stages, not modelled.
- **"Can appear in the battlefield".** The Robber's handbook line is presentation; its spawn comes from the stage waves.
- **DP steal target.** DP is taken from the hit operator's owner.
