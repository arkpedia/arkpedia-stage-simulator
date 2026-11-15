# Mutant Giant Rock Spiders

Both `enemy_1133_harchn` variants use one `mutantSpider` controller. The registry
requires the retained native prefab, summon templates, projectile and original
animation clocks; it declares the Excrescence/Tumor child dependency. Changed
source contracts fail admission instead of receiving a generic approximation.

The five-second summon cooldown starts at spawn and resets when the cast starts.
Its one-second animation releases one child at frame 17/30. Stun and silence can
interrupt it. Death produces four children after the record's 0.2-second delay,
with a 0.2-tile scatter bound. Silence, leaks and pit deaths suppress that split.
Scheduled children retain the remaining route and participate in victory checks.
Physical ground-only attacks use the original 0.7/1.5-second attack clock and a
speed-12 projectile, whose released hit survives source death.

`arkpedia-enemy-summons.js` also owns the existing Wine-family scatter scheduler.
Ground-only families opt into passability checks and obstacle fallback; the
nearest passable tile uses deterministic row/column ties. This is a simulator
placement policy, not verified parity with Unity's obstacle tie-breaking.
Projectile origins and unit collision boundaries still use the shared simulator
geometry. The cosmetic death projectile has no damage or buff payload and is
not recreated as a separate gameplay projectile.

The generic extractor supports several skeletons in one verified bundle load:

```sh
ARKPEDIA_PYTHON=/workspace/.venvs/arkpedia/bin/python node tools/arkpedia/enemy-animation.mjs \
  --enemies enemy_1133_harchn=-5653250724798027552,enemy_1133_harchn_2=-7413974389538267067 \
  --bundle refs/arts/enm_art_7.ab --out data/arkpedia-spider-animations.json --check
```

Focused tests exercise release timing, silence/interruption, route ownership,
death scheduling, pits, obstacles, air targeting, projectile survival and negative
source mutations. Wine/caster regression tests cover the shared scheduler.
These checks do not certify client-frame or visual parity.
