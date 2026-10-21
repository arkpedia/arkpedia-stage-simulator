# Nasti review

Nasti (`char_4212_nasti`, CN 娜斯提) is an Artificer Supporter. Her device is the selected skill's `overrideTokenKey`: the inspector `token_10059_nasti_nstdef` (S1), the supervisor `token_10060_nasti_nstchr` (S2) or the engineer `token_10061_nasti_nstbld` (S3), whose platform is the same token in its upgrade modes. Her art receipt is `source-reviews/nasti.json` in SD. Each device's model and card avatar come from the CN client (`data/arkpedia-nasti-{nstdef,nstchr,nstbld}-token-{art,avatar}*.json`), checked by hash against the review's `tokenArtwork`.

From data (tables, her own and the devices' prefabs and templates):
- **Talent 1.** `cnt` devices, at most the token's `maxDeployCount` on the field. Each device faces the operator on its front tile (its `1-1` range).
- **Talent 2** (`nasti_t2`).
  - Sanctuary `nasti_t2[res].damage_resistance`.
  - Once a ranged enemy has appeared, Sanctuary `nasti_t2[res_plus]` for her and for the operators on high ground, and she gains 1 SP every `nasti_t2[add_sp].interval` s.
- **S1** (40 s). ATK `atk`, DEF `def`, and she attacks every blocked enemy. One more device at the start.
  - The inspector's talent gives its front operator DEF `def`.
  - During S1 it instead gives block +`talent@block_cnt` and DEF `talent@def`, and loses `talent@hp_ratio` of its max HP a second (`sktok_nasti_nstdef`, `nasti_nstdef_t[self_damage]`).
- **S2** (4 s). She stops attacking and gains a barrier of `shield_each_hp_rate` × max HP every 0.5 s, up to `shield_max_hp_rate`.
  - Supervisors on the field are activated. Every `talent@interval` s each loses `talent@hp` HP and gives its front operator `talent@sp` SP (not while that operator's skill is active) and a barrier of `talent@shield_each_hp_rate` × her max HP, up to `talent@shield_max_hp_rate`.
  - Activated supervisors leave when S2 ends.
  - A supervisor has the fixed max HP `init_max_hp`, deploys with `init_hp`, and recovers `value` HP each time its own skill fills (`sktok_nasti_nstchr`).
  - One more device when S2 ends.
- **S3** (15 s). ATK `atk`, DEF `def`. One more device at the start.
  - **Platform.** An engineer spawns the platform (mode 3) on the deployable ground tile in front of it when none exists (`nasti_nstbld[create_m3]`). The platform counts toward the two-device cap.
  - **Engineers.** Each second an engineer gives the platform in front `m1_sp` SP (`m2_sp` while her skill is active). While the platform is hurt, the engineer heals it `hp_ratio` × its max HP at a cost of `hp_ratio` × `cnt` of its own.
  - **Upgrades.** At full SP the platform upgrades (modes 4-6).
    - From mode 4 it blocks one enemy and its tile takes one ranged operator, who gains the `m4`/`m5`/`m6_bonus` max HP and ATK (TileAuraBuff `0-1`).
    - Modes 5 and 6 add the `attribute_up` max HP, DEF and RES.
    - Mode 6 stays when she leaves.
  - **Fall.** When the platform falls, the operator on it leaves (ClearCharacterOnTileIfExists).

Declared mappings:
- **Targeting.** The inspector, supervisor and engineer are untargetable and take no damage; the platform can be attacked.
- **Drawing.** The platform's levels are drawn with a marker (its idle clip is empty), and the operator on it is drawn at tile height.
- **Fallen platform.** The operator on a fallen platform is retreated with its normal redeploy time and no refund.
- **Redeployment.** A redeployed Nasti can build a new platform while an orphaned level-6 one stands.
- **Ranged enemy.** A ranged enemy is one whose `applyWay` is `RANGED`.

Generic changes:
- **Host units.** A unit with `mem.regularHost` can carry one guest on its tile. The host keeps the tile in `_occ`; `_deploy` records the guest, and `_remove` and `relocate` detach it.
- **Tile build.** `battle.regularTileBuild(row, col)` lets an owner give a tile another build type for card placement.
- **App.** A legal placement onto an occupied tile beats inspecting the occupant.
- **Summon sweep.** Summoner removal keeps tokens marked `mem.regularKeepOnOwnerRemoved`.

Validation:
- `test/arkpedia-nasti.test.js` (41 cases) covers:
  - stats, cost and SP at every rank;
  - each skill's device, stock and extra devices;
  - talent 2 before and after a ranged enemy;
  - the S1 inspector and hits on every blocked enemy;
  - S2 supervisors and her shield;
  - the S3 platform from build to fall;
  - a guest relocated off the platform;
  - three 0-1 clears.
- `review-nasti-public.mjs` passes 6 cases on both the candidate and the normal build. It covers the device card with a facing swipe, S1, S2, and the S3 platform: refused before its first upgrade, hosting a ranged card dragged on after it, blocking, kept at level 6 after her retreat, and dropping its guest when it falls.
