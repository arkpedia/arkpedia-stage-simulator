# Bombtail regular-stage admission

This change admits `enemy_1040_bombd` and `enemy_1040_bombd_2` through the regular
feature dispatcher. It reuses the existing, tested Bombtail cast implementation;
it does not enable the full-mode enemy kit registry.

## Evidence

- Enemy records: the pinned `data/arkpedia-enemy-records.json`, all database levels.
  Both variants have one `boomb` skill, 1 s initial/cooldown, zero SP cost and
  `move_speed: 2`. Damage and targeting range use the enemy's own attributes.
- Native enemy prefabs: CN resource `26-09-22-07-47-20_6c71fa`,
  `battle/enm_pfb_4.ab`. The exact `Boomb` components and referenced trigger are
  retained in `data/arkpedia-enemy-native-abilities.json` and verified against
  `data/arkpedia-enemy-clock-source.json`.
- Each wrapper allows one trigger, ignores silence and permits stun interruption.
  The target trigger requires at least one target. The cast waits for the Attack
  event, ends in `Idle_2`, uses physical damage at 1× ATK and a minimum 0.667 s
  post-release delay.
- The regular and elite casts name different projectiles. Their shared bundle
  `battle/prefabs/[uc]projectiles.ab` is pinned by
  `data/arkpedia-cn-native-source.json` (SHA-256
  `f7a1858f6e213251d56d2883e4dcf410f48951a1b0efc565427da182275a0db3`).
  Retained components verify speed 5, homing, impact-only collision, camouflage
  ignored for the blast, a 10 s lifetime, no repeated hits and persistence after
  the source dies. The two variants differ in visual keys, not these mechanics.
- The existing runtime documents the 8/30 s release frame and target-plus-eight-
  neighbours blast from original animation/PRTS review in `enemies.js`.

## Behavior and limits

The drone has no ordinary attack. It hovers while casting, releases one bomb,
hits on projectile arrival, then doubles its movement speed. A stun before release
cancels that attempt while retaining the bomb. A launched projectile survives its
source's death; a missing target leaves its last landing position for splash.

The admission predicate requires the reviewed skill signature, wrapper, trigger,
cast and projectile shapes. Missing evidence and changed repeat/silence semantics
are refused. Stage-specific override values still come from the level file.

Tests exercise both variants through regular feature dispatch, plus the existing
full-mode tests for target withdrawal, source death, release timing and splash.
The runtime's documented mappings for interruption, cached release ATK and
hover/cast timing remain mappings; this is not a client-frame or pixel-parity
certificate. Native visual assets and complete challenge-stage rules are separate.
