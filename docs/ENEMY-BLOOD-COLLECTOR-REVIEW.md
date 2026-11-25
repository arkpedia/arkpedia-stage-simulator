# Blood Collectors

Sarkaz Bloodwalker `enemy_1366_dcolle` and Sarkaz Bloodnexus `enemy_1366_dcolle_2` (PRTS 血之收集者) pick up Blood Amber (`enemy_1367_dseed`). They drop it when they die and give it to a Bloodcalling Altar's pulse.

This batch publishes 13-14 and 13-14 adverse (1,151 available; main story 426 of 564). Their only blockers were this enemy and the Altar's guard against unmodelled reactions.

## Native evidence

`shared/arkpedia/enemy-blood-collector-features.js` (`bloodCollectorNative`) checks the pinned prefab and three CN templates. The extractor now keeps the Collectors' `Default`, `Attack`, `Collect` and `Passive` objects, plus `Collect`'s trigger circle.

**The record**
- 10,000 / 15,000 HP. Damage type none, no skills. It cannot be blocked (an existing feature).
- Talent `Collect.max_stack_cnt` 5.

**Never attacks**
- `Attack` has no selector, so the Collector never attacks.
- `Passive` is an effect only, with the `empty` template.

**Collect**
- **Circle:** a trigger circle of radius 0.5, centred on the Collector.
- **Validator:** ground (motion 1), enemy-side units carrying `enemy_dcolle_mark`. Blood Amber carries that mark on its own passive (prefab dump, not pinned).
- **Buff:** `enemy_dcolle_collected`, removed when the target leaves.

**`enemy_dcolle_collected`, on the Amber, sourced from the Collector**
- **Gate:** it acts only while the Collector's `enemy_bonore_mark[cnt]` stack is below `max_stack_cnt`. Otherwise nothing happens.
- **Effect:**
  - adds one `[cnt]` stack (`enemy_dcolle_collect[cnt]`, STACK, at most 10);
  - gives the Collector +1 SP (its bullet display);
  - kills the Amber (InstantKill).

**`enemy_dcolle_collect[cnt]`**
- Each stack puts one `enemy_bonore_mark` on the Collector (template `enemy_dcolle_bonore[action]`).
- Override is disabled, so the marks coexist: one per held Amber.

**`enemy_dcolle_bonore[action]`**
- **The Collector is killed:** unless the death reason is FALLDOWN, each mark summons one Blood Amber on the Collector's route (`SummonEnemiesFollowMyRoute`, 1, no delay).
- **The mark finishes:** −1 SP, and one `[cnt]` stack is removed.

**The Altar**
- Its pulse selects units carrying `enemy_bonore_mark`, so it takes a Collector holding Amber and passes an empty one by.
- `trap_bonore_s` counts the marks into branch phases (at most 10) and finishes them. The marks' end only empties the Collector: it survives and can collect again.

## Runtime

**The Collector** (`server/sim/content/arkpedia-enemy-blood-collector.js`, kind `bloodCollector`)
- `e.mem.bonoreMarks` is its mark count.
- **Each tick:**
  - it takes live ground Amber whose centre is within 0.5 + 0.1 (Amber's collider), nearest first, until it holds 5;
  - each taken Amber is killed.
- **On a kill:** unless the Collector fell (`deathByFall`), it drops that many Amber on its spot, on its remaining route.

**The Altar** (`arkpedia-stage-blood-altars.js`)
- **Targets:** the pulse selects any unit whose mark count is positive (Amber 1, a Collector its held count), with the same box and the same cap of 10 units.
- **Each hit:** runs that many branch phases. An Amber dies; a Collector is emptied.
- The Collectors leave `BLOOD_ALTAR_UNMODELLED`. Bone Drifters and pilots remain there.

## Checked

`test/arkpedia-blood-collector.test.js`:
- **Pins:** both records pass. Refused:
  - a pouch of 6;
  - a circle of radius 1;
  - a death that drops nothing.
- **Collect** (13-14 with no waves):
  - 7 Amber at 0.3 → 5 taken, 2 left;
  - an Amber at 0.65 stays.
- **Death:**
  - 3 held → 3 Amber on its spot, each with a route;
  - a fall drops none.
- **Altar:**
  - a Collector holding 3, in the 13-14 Altar's lane, gives 3 Bloodborn Spawn at about 20.2 s and survives empty;
  - it collects again, and the 40 s pulse takes that one.
- **Empty Collector:** the pulse passes it and takes an Amber beyond.
- **Headless 13-14:**
  - a Collector holds Amber;
  - the Altar converts at least 6;
  - the stage clears.

## Not checked

- In game.
- **Inferences**
  - The contact is the circle plus Amber's 0.1 collider, measured centre to centre. Amber's collider and its `enemy_dcolle_mark` come from the prefab dump, not from pinned evidence.
  - With several Amber in reach in one tick, the nearest are taken first.
  - The dropped Amber appear at the Collector's position, spread as `spawnChildren` does, not with the template's ±0.2 random offset.
- The SP bullets are not drawn; the mark count is the same number.
