# Chapter 16 native candidate evidence

The existing pinned timing index already contains the chapter 16 prefabs below.
Their original bundles are present locally and match the SHA-256 hashes in
`data/arkpedia-cn-enemy-native-source.json`; no source refresh is required to
start their controller review.

| Prefab | Existing bundle | Retained components |
|---|---|---:|
| enemy_3010_mcreep | battle/enm_pfb_28.ab | 13 |
| enemy_10203_mumag | battle/enm_pfb_31.ab | 12 |
| enemy_10211_murad | battle/enm_pfb_31.ab | 23 |
| enemy_10206_muveg | battle/enm_pfb_31.ab | 9 |
| enemy_10208_mucow | battle/enm_pfb_31.ab | 8 |
| enemy_10210_muwiz | battle/enm_pfb_31.ab | 18 |

Index keys are `dyn/battle/prefabs/enemies/<prefab>.prefab`, rather than bare
enemy IDs. The default ability extractor intentionally retains only named
components needed by previously reviewed features. Absence from that selected
output does not mean the prefab or source bundle is absent.

`data/candidates/arkpedia-ch16-native-abilities.json` retains all indexed clock
components of these six prefabs and their transitive same-bundle MonoBehaviour
references: 83 components total. Each indexed component matches the timing
index's original-data hash; referenced components carry their own hashes.
Template data remains tied to its existing source pin. This is serialized source
evidence, not runtime behavior approval or public admission.

Reproduce from the existing cache (UnityPy/aklz4 environment required):

```sh
.cache/map-env/bin/python tools/arkpedia/extract-enemy-native-abilities.py \
  --prefab enemy_3010_mcreep --prefab enemy_10203_mumag \
  --prefab enemy_10211_murad --prefab enemy_10206_muveg \
  --prefab enemy_10208_mucow --prefab enemy_10210_muwiz \
  --output data/candidates/arkpedia-ch16-native-abilities.json
```

Add `--check` to verify the candidate without writing it. The original default
extraction and `--check` still target the original evidence file. Targeted
extraction requires a separate output and refuses to overwrite that default.

The original implementation handoff covered the civilian's GetHeal, FearLoseBlood and
TileEscapeShadowManager behaviors; ChargeRift; ReverseDamage/MuradPollut;
DeadSummon; shield/StealAtk/LockDamage; and Murad's visibility/beam lifecycle.
The current behavior/admission status is in `CH16-BEHAVIORS.md`. All six base controllers
now clear candidate support under exact native contracts; stage admission remains
restricted to test-only 16-2. Compile candidate support against the complete canonical enemy
candidate and verified merged evidence; do not overlay one enemy into the old
public catalogue. Implement and review behaviors before building/admitting
stages. No production pointer or public registry changes are part of this work.
