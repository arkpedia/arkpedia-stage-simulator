# Faust (`enemy_1508_faust`)

The Reunion crossbow boss, at two database levels:

| Level | HP | ATK | Invulnerable | CriticalHit | SummonBallis |
|---|---|---|---|---|---|
| 0 | 37,000 | 1,000 | 150 s | 2× ATK, every 17 s (first at 17 s) | every 30 s (first at 15 s) |
| 1 | 50,000 | 1,200 | 120 s | 2.5× ATK, every 30 s (first at 30 s) | every 45 s (first at 1 s) |

Both levels: 350 DEF, 35 RES, range 20; immune to stun, silence and freeze.

This main-story batch published **6-7 "Broken Strings"** and **H5-4**. 5-10 still waits on Mephisto. 6-7's other blockers were the stage's `invincible.duration` and SummonBallis timing overrides, which are now declared.

`shared/arkpedia/enemy-faust-features.js` holds the contract. It pins:
- both records;
- every component reachable from `Attack`, `Trigger`, `Invincible`, `CriticalHit`, `SummonBallis` and `BlockFree`;
- the `empty` template;
- `projectile_faust` and `projectile_faust_s1`;
- the Attack, Skill_1 and Skill_2 clips from `refs/arts/enm_art_16.ab`.

The runtime is the shared Faust kit, `rusthammerWarrior` (`server/sim/content/arkpedia-enemy-rusthammer.js`). `talent:invincible` and `skill:CriticalHit` belong to the Rusthammer contract, which dispatches them to Faust; `skill:SummonBallis` is Faust's own.

## The kit

1. **Shared with Rusthammer** (see `docs/ENEMY-RUSTHAMMER-REVIEW.md`):
   - INVINCIBLE for `invincible.duration`;
   - BLOCK_FREE and sleep-immune for life;
   - Physical bolts (speed 10, lifetime 5);
   - CriticalHit taking the next attack once ready.
2. **One difference: the bolt type.** Faust's CriticalHit is Physical (`_damageType` 1, "a special bolt dealing double damage"), where Rusthammer's is Arts. The runtime takes the bolt type as a parameter.
3. **SummonBallis.**
   - The cast plays Skill_2 (1.667 s); its wrapper ignores silence and keeps the cast going through stun.
   - At the event (0.9 s), `MoveNextLevelBranch` runs with an empty `_branchId`, so the skill's own `branch_id` is used. The CN database gives `faust_ballis` at both levels, and some levels restate it.
   - It advances that level branch one phase per cast, without looping. Each phase activates hidden predefined Turrets (`trap_007_ballis`).

## Stage support

- **Activation branches** (`turretActivationBranches`, `tools/arkpedia/stage-branch-noops.mjs`):
  - A level branch whose phases only ACTIVATE_PREDEFINED unique hidden `trap_007_ballis` instances compiles to `{ phases: [[aliases]] }`.
  - Each such instance is validated like a static Turret: skill 0, level 1, phase 0, no overrides. It becomes a hidden `branchActivated` device with its original direction.
  - Branches of any other shape keep their old handling.
- **Accepting hidden Turrets.** Both `stageDeviceSpec` copies (`stage-devices.js`, `device-runtime.js`) accept a hidden Turret only with that flag and an alias.
- **Runtime.**
  - `StageBranchScheduler.advance(key)` runs the next phase.
  - `activateStagePredefined` routes Turret aliases to `StageTurrets.activate`, which spawns the Turret as a static one.
  - An activation onto an occupied tile finishes without a body, as for reward devices.
- **Stage overrides.** `talent:invincible` accepts the stage's `invincible.duration`. SummonBallis and CriticalHit accept stage cooldown and initial-cooldown overrides; 6-7 casts SummonBallis once, at 90 s.

## Verification

`test/arkpedia-faust.test.js`:
- **Admission.** Both levels are admitted and Rusthammer keeps its Arts bolt. The parameters are checked, and another bolt speed is refused.
- **Compiled 6-7.** Five hidden branch-activated Turrets. Faust is invulnerable for the overridden 60 s. One SummonBallis at 90 s raises all five.
- **Compiled H5-4.** Level-1 Faust: no Turret before his first cast event (1 s + 0.9 s), then one phase per 45 s cast (phases 1, 2 and 3 by 93 s).

The Turret, branch, reward-device, Power Armor, Twigs and Rusthammer suites pass unchanged (48 tests). The library rebuild published 6-7 and H5-4 (1,052 available). Rusthammer's stage bundle changed only by the new `criticalType` parameter; no other bundle changed. `check-stage-library.mjs` smoked all 1,052 graphs with no failures. Browser review: 6-7 runs with no console errors, and Faust's original art loads from asset commit `4858c9db`.

## Boundaries

- **Watching the Turrets.** In an undefended 6-7 the battle ends (168 s) before the 90 s cast after Faust's 127 s entry, so the Turrets were checked in tests, not watched.
- **Faust's other stages** (FA-7, the IG stages, TN-2, VI-5/7 and others) keep their other blockers.
