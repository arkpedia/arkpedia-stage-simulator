# Commander Ulšulah

Commander Ulšulah `enemy_1368_spilot` (PRTS 指挥官厄尔苏拉) is an elite ranged Arts caster.
- **Her cast:** she upgrades a Bloodcalling Altar, which then produces Blood Amber.
- **When killed:** she returns through an Altar 20 s later.

This batch publishes 13-17, 13-18 and both their adverse variants, plus SE-8 (1,160 available; main story 430 of 564). Each was blocked by:
- the pilot herself;
- the Altar's pilot instance keys;
- the pilot branch binding.

**Still blocked**
- **SE-8 challenge mode:** an unrelated talent addition on `enemy_1363_spnshd`.
- **The crisis stage `level_crisis_v2_04-05`:** a hidden Altar.

## Native evidence

`shared/arkpedia/enemy-pilot-features.js` (`pilotNative`) checks the pinned prefab and three templates. The extractor now keeps her `Default`, `ChargeOre`, `DebuffAura`, `Attack`, `Charge`, `Aura` and `Reborn` objects and their siblings. That includes the Charge trigger's selector and the Aura circle.

**The record**
- 30,000 HP, ranged, Arts.
- `Reborn.duration` 20.
- One skill, `Charge`: cooldown 20, initial 10, `hit_duration` 10, `attack_speed` −80.

**Charge (【凝髓隙环】)**
- **The wrapper:** its trigger selects one own-side trap carrying `trap_bonore_need_upgrade`, with post-filter 11 (PRTS: the nearest Altar not yet upgraded). It does not ignore silence.
- **The combo:** it runs `DebuffAura` and `ChargeOre` together, and both finish when `ChargeOre` (the main one) does.
- **`DebuffAura`:** for `hit_duration`, it wraps `Aura`. Opposing units (category 1) inside the Aura circle get `enemy_spilot_atk_speed[down]`, attribute 7 (ASPD) from the blackboard. The circle's radius is 1.7.
- **`ChargeOre`:** its projectile gives the Altar `trap_bonore_upgraded[trigger]`. That finishes `trap_bonore_need_upgrade` and gives the Altar `trap_bonore_upgraded` with no time limit.

**Reborn**
- A passive `enemy_spilot_reborn[trigger]`. When she is killed (`ON_OWNER_KILLED`), it puts `enemy_spilot_reborn[bonore]` on one own-side trap carrying `trap_bonore_spilot[mark]`.
- That trap is picked with post-filter 14 (PRTS: a random Altar).
- The buff lasts `duration` (20 s), with one stack and no refresh.
- **`enemy_spilot_reborn[bonore]`:**
  - **When it ends:** if the Altar is alive, the Altar runs `SummonSpilot`.
  - **When the Altar is killed first:** the same buff goes to another marked Altar, never itself, for a fresh 20 s.

**The Altar side** (pinned in `stage-blood-altar.js`)
- **Passive:** it adds `trap_bonore_need_upgrade` and `trap_bonore_spilot[mark]`.
- **Hidden talent `1`:** `trap_bonore_upgraded[summon]` fires on a timer (`triggerLifeType` 2, `waitFirstTriggerInterval` 1). While the Altar holds `trap_bonore_upgraded`, it runs `SummonEnemiesFollowBranchRoute`.
  - The run is managed and not unharmful, with no override enemy and `_summonAllRoute` false.
  - The skill blackboard gives it `talent@branch_id` `bonore_dfello` and `talent@enemy_key` Blood Amber.
- **`SummonSpilot`:** `SummonEnemiesFollowBranchRoute`, with the same flags, on the instance's `SummonSpilot.branch_id`. Its selector picks a `trap_bonore_spilot[mark]` trap with post-filter 14.

**The stages:** on 13-17, 13-18 and SE-8, every Altar instance names `SummonSpilot.branch_id`. That branch has one phase, which spawns one pilot. 13-18 and SE-8 also repeat `branch_id` as `talent@branch_id`. On 13-17 the talent falls back to the skill's `bonore_dfello`, which is the Altar's own branch there.

## Runtime

**The pilot** (`server/sim/content/arkpedia-enemy-spilot.js`, kind `spilot`, dispatched from the shared `talent:Reborn`; `skill:Charge` is shared with the R-Series engineers)
- **The cast:**
  - **When:** first at 10 s, then 20 s after each cast begins, while some Altar is still not upgraded.
  - **What:** a 10 s cast at the nearest such Altar. She stands still and doesn't attack, and silence or stun ends the cast.
  - **During it:** operators within 1.7 of her get ASPD −80.
  - **A finished cast** upgrades the Altar; an interrupted one does nothing.
- **Killed** (a fall included): she marks a random live Altar. If that Altar already holds a mark, nothing happens. Reaching the exit is not a kill.

**The Altar** (`arkpedia-stage-blood-altars.js`)
- **Amber clock:** it runs every 10 s from the Altar's start. Once the Altar is upgraded, each tick summons one Blood Amber on its own branch (`StageBranchScheduler.summonFollowRoute`, a branch phase with its enemy replaced).
- **Pilot return:** 20 s after the mark, it runs the pilot branch.
- **`destroy()`:** a pending return moves to another random live Altar for a fresh 20 s. With none left, it is dropped.
- **Ending the battle:** neither the pending return nor the Amber clock holds it. The Amber and the returned pilot hold it like any branch body, as the Altar's other spawns do.

**Stage compile**
- **`stage-device-instances.mjs`:** accepts exactly the three Altar blackboard shapes:
  - `branch_id`;
  - `branch_id` with `SummonSpilot.branch_id`;
  - both of those with `talent@branch_id`.
  With a pilot branch, the Amber branch (the instance value or the skill's `bonore_dfello`) must equal `branch_id`.
- **`stage-branches.mjs`:** binds the pilot branch and checks that it is one pilot ×1.
- **The device runtime:** binds `pilotBranchId` as an optional binding (`pilotBranchId?`).

## Checked

`test/arkpedia-pilot.test.js`:
- **Pins:** both reviews pass. Refused:
  - a longer return;
  - a weaker aura;
  - a wider circle;
  - a return to the nearest Altar;
  - Amber every 5 s;
  - an Altar without the pilot mark.
- **The cast (13-17, no waves):**
  - an operator beside her gets ASPD −80 from 10 s to 20 s;
  - the Altar upgrades at 20 s and the aura ends;
  - Amber arrives at 30 s and 40 s;
  - there is no second cast with no Altar left to upgrade.
- **Silence:** at 15 s it ends the cast with no upgrade. The next cast starts at 30 s and upgrades.
- **The return (13-17):**
  - killed, she comes back 20 s later as a branch body;
  - a second pilot killed while the Altar holds the mark gets no return;
  - leaving through the exit marks nothing.
- **The handover (SE-8):**
  - the marked Altar destroyed: the mark moves to another Altar for 20 s and she returns;
  - all Altars destroyed: her death is final.
- **Headless clears:** 13-17, 13-18, both adverse variants and SE-8.
  - In each run an Altar upgrades and she returns.
  - Except on SE-8, an upgraded Altar makes Amber.
  - A test hook kills her every 40 s and every other enemy after 0.5 s.

`test/arkpedia-blood-altar.test.js`: a pilot stage whose Altars name no pilot branch is refused.

## Not checked

- In game.
- **Inferences**
  - **Amber interval:** 10 s, from the talent blackboard `interval` and PRTS. The serialized buff interval is 5.
  - **Cast length:** 10 s, from `hit_duration` and PRTS. `ChargeOre`'s pre-delay (2 s) and projectile flight are not timed.
  - **Movement and attacks:** she is read as rooted and not attacking while casting.
  - **Amber clock:** it is read as starting with the Altar, not with the upgrade (`waitFirstTriggerInterval`).
  - **Several-phase branches:** for an Amber branch with several phases (13-18's second Altar), one phase is drawn at random. Nothing reviewed names which.
  - **A second mark:** on an Altar already holding one it is read as lost (one stack, no refresh), so on 13-17 a second pilot killed within 20 s of the first does not return.
  - **Falls:** a fall counts as a kill (`ON_OWNER_KILLED`).
- **Silence:** PRTS says the cast can be silenced. The model also ends it on stun, as it does for every timed enemy cast.
