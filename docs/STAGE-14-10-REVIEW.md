# 14-10, Charles Lynch and successor operators

14-10 "From the Light" is a story stage. Its squad is fixed: the source places six story operators and redeploys four of them, upgraded, later in the stage. It needed:
- **The deck-card rune** `level_deck_cards_enable`.
- **Successor actors:** a second copy of an operator already placed (`#2`).
- **The scripted withdrawal** `WITHDRAW_PREDEFINED`, and the presentation-only `DIALOG` action.
- **Charles Lynch** `trap_158_lrsteam` (PRTS 查尔斯·林奇), a device a wave action deploys.
- **Light of Glory's storm talent:** 14-10 has an Active Originium Storm (`docs/STAGE-LIGHT-OF-GLORY-REVIEW.md`).

This batch publishes 14-10 (1,176 available; main story 445 of 564).

## The stage's operators

**Fixed squad.** The level is a training level (`isTrainingLevel`) with no cards of its own. The EN wiki says "Squad composition: None" and that the operators cannot be changed, so the player brings no squad.

**Deck cards** (`level_deck_cards_enable`; blackboard empty, every profession and tile)
- No other stage in the game uses this rune, so it is read from its key [inference]: the preset operators keep ordinary deployment cards.
- Once one leaves the field (knocked out, or withdrawn by the script), its card waits for its redeploy time. Then the player can place it again for its DP cost (initial DP 10, maximum 99).
- Without the rune, preset operators have no card, as before.

**Successors** (`tools/arkpedia/stage-predefined-operators.mjs`)
- A later actor of an operator already preset is that operator's successor, if it is hidden and a wave action activates it. These are 14-10's `#2` entries for Siege, Morgan, Dagda, Indra and Bagpipe.
- **Their builds differ:** Bagpipe goes from level 30 to 80, and the other four from skill rank 7 to 10. The EN wiki describes them as the same operators redeployed with these upgrades.
- Any other repeated operator is still refused. `char_112_siege#3` is never activated, so it is left out.
- **On activation** (`server/sim/arkpedia.js`, `_succeedStagePredefined`):
  - The operator's one bench entry swaps in the successor's build: its record, behaviour program and card cost.
  - If the predecessor is still on the field, it leaves without a refund. The successor is then placed on its own tile.
  - If another unit holds that tile, the build is still swapped and the card is left ready for the player [simulator choice].
- **Not swapped:** squad-wide services installed at battle start keep the first build's record. Bagpipe's Vanguard SP talent is one; it does not change between level 30 and 80 at Elite 2.

**The scripted withdrawal** (`WITHDRAW_PREDEFINED char_112_siege#1`, wave clock 51 s) retreats Siege, without a refund, if Siege is on the field. Siege #2 follows at 52 s on 5,8.

## Charles Lynch

`shared/arkpedia/stage-charles-lynch.js` (`charlesLynchNativeReviewed`) checks the pinned prefab, the skill prefab `sktok_lrsteam`, the projectile `projectile_trap_lrsteam` and the record. All three are now kept by the device extractors, with the skill's box collider.

**The device**
- Side 1, category 1, one mode; block radius² 0.5.
- **Attack:** an ordinary Physical attack, ATK ×1, on one ground enemy it blocks, in range 1-1 (its own tile and the one it faces).
- **Record (level 1):** 20,000 HP, 1,500 ATK, 600 DEF, 50 RES, block 99, attack interval 3.75 s.
- **Passive `trap_lrsteam_passive`** (for life): HEAL_FREE (flag 7: it cannot be healed), and immunity to STUNNED (0), SILENCED (12) and FROZEN (16).

**Skill 誓死** (`sktok_lrsteam`): AUTO, 116 of 120 SP, +1 SP/s, `atk_scale` 2.05, `duration` 4.
- After a 2.83 s wind-up, three volleys go out 0.3 s apart (`_additionalTimes` 2, `_triggerDelta` 0.3).
- **Each volley** selects up to 5 targets (`_maxNum` 5, random beyond that, `_alwaysRandomInTheEnd`). The area is a 3×3 box centred two tiles ahead (collider offset y 2, size 3×3), ground enemies only (`_targetMotion` 1).
- **Each target** takes one shell: Physical, ATK ×2.05, 0.3 s after it is fired.
- **Filter type 23** is read as tiles holding an enemy [inference].

**Runtime** (`server/sim/content/arkpedia-stage-charles-lynch.js`, family `charlesLynch`)
- **Arrival:** hidden until its wave action (wave clock 40 s) places it on 4,7 facing LEFT. On an occupied tile the action finishes without a body, as for a Shieldguard.
- **Fighting:** it blocks and attacks through the ordinary ally attack loop, as a Shieldguard does.
- **Skill:** its SP charges at its SP recovery. Originium pollution lowers that like any unit's (0.2 SP/s on a polluted tile). In the stage the storm has usually eaten the tiles around it by then, so it casts about 4 s after arriving.
- **While casting** (4 s) it does not attack.

## Checked

`test/arkpedia-charles-lynch.test.js`:
- **Reviews:** Charles Lynch's review passes and refuses a stronger shell, a wider area and more volleys. Light of Glory's review refuses an earlier storm shrink.
- **Compile:** a fixed squad of deck-card actors, five successors with their builds, `#3` left out, one scripted withdrawal, and both device activations.
- **Successor:** Morgan #2 replaces a living Morgan #1 on 3,4 at skill rank 10. The withdrawal retreats Siege without a refund, and Siege #2 lands on 5,8.
- **Deck card:** a knocked-out Dagda cannot be placed during its redeploy time. After it, it can, for DP.
- **Charles Lynch:**
  - Arrives on 4,7 by its action and is immune to stun, silence and freeze.
  - Casts 4 s later.
  - With seven enemies in the box and one outside, it lands three volleys of five shells, 3.1, 3.4 and 3.7 s after the cast. None hits the enemy outside.
- **Storm:** 7 s after Light of Glory switches on, the core lands. The storm then dies on the tick the reviewed shrink predicts, from its radius at that moment.
- **Headless run** on the real clock, with no player input and no damage helpers:
  - Group ① falls to the Sarkaz (by about 24 s).
  - Charles Lynch arrives and fires.
  - Siege #2 and the four successors are placed on their tiles.
  - The storm vanishes, and the stage clears (with life raised to 999).

## Not checked

- In game.
- **Inferences**
  - **The rune's meaning:** read from its key alone.
  - **Filter type 23:** read as selecting tiles that hold enemies.
  - **A blocked successor tile:** the card is left ready; the game's behaviour there is unknown.
  - **Pollution and Charles Lynch:** pollution lowers his SP recovery as for any unit.
- **Unmodelled**
  - PRTS's "damage taken −90%" for operators in Light of Glory's circle.
  - The storm's damage falling with its intensity.
- **No art:** Charles Lynch has no sd-assets model and draws as a marker.
- **The life limit:** with 3 life points and no player input, enemies leak once group ① falls. The deck cards are how the player covers that gap.
