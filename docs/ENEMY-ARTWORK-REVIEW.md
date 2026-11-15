# Shared enemy artwork review

The current addition supplies 405 original enemy model records in eight immutable
local SD releases. It does not imply complete enemy behavior or native visual
fidelity. These releases have not been pushed to the remote repository.

| Release | Added records |
|---|---:|
| `e9d3bde5cba6c6adfd0b366ecc3912de35dc2b8d` | 239 |
| `fd5bd4fc2ba6fac1c3cba938d997083edd4dce64` | 21 |
| `1a2b5bf35ab76cef3550618e349a05e48dce8d26` | 133 |
| `ba8140d9e6b6059f2796d826176d64a9a6d976c9` | 2 |
| `01a996313cbc7f68bacee52a44c998e94fceed7b` | 2 |
| `1af983ed9e78c673704ccf2037255409b21b81d2` | 4 |
| `d05dbf7a073989f616766d675dc56e774c48cb1f` | 2 |
| `fbd4635d1dace5b2ad6c1ca51519f61f6a1557aa` | 2 |

The shared manifest contains 3,678 models. Twenty-one new enemy records alias
byte-identical canonical skeleton, atlas and texture files. Aliases retain their
own provenance and animation roles. Runtime model resolution uses the canonical
body's revision and URL, including when the alias and body came from different
releases. Database variants also resolve their declared native prefab identity.

## Reproducible additions

`tools/arkpedia/extract-native-enemy-models.py` verifies the official CN manifest
and bundle checksums before extracting an explicit list of enemy IDs. Ambiguous
bodies require exact native prefab-to-SkeletonData bindings rather than name
guessing. The base artwork bundle is included. Source receipts retain native
pointer chains, texture/material declarations and original animation clocks.

The shared repository's batch importer verifies every input before publishing
one manifest. Existing records remain unchanged. Explicit aliases require equal
file hashes and compatible Spine/material declarations, and cannot form chains
or cycles. The simulator adopts verified immutable Git blobs through
`tools/arkpedia/enemy-artwork.mjs`; its persistent registry is merged by the
snapshot builder so future data rebuilds preserve these additions.

Texture extraction respects the native external-alpha switch and shader keyword.
Disabled, stale alpha pointers do not replace embedded alpha. Premultiplied
texture channels are bounded by alpha. Original source images are retained in
the shared asset repository rather than copied into simulator content records.

## Validation and limits

All 405 bodies passed desktop and touch-landscape browser decoding and
finite pose checks for all 2,453 clips per viewport, with rendered idle galleries
and no page/resource errors. These checks establish loadability, not visual
comparison with the native client. Importer, manifest, adoption, alias, alpha and
revision-routing tests cover the asset contracts. A delayed-transport browser
check also verifies that a deployed fallback upgrades to its Spine actor without
changing unit identity, deployment life, HP or simulation time on either viewport.
Browser receipts live under the simulator cache.

All supported enemies with identified native Spine bodies now resolve artwork.
Ten supported database IDs still use nine native non-Spine effect/mesh prefabs:
`enemy_10082_mpweak`, `enemy_1177_dufrbl`, `enemy_1177_dufrbl_2`,
`enemy_1245_ltseal`, `enemy_1380_dthmak`, `enemy_1420_lrmm`,
`enemy_1432_lrccon`, `enemy_1432_lrccon_2`, `enemy_1554_lrtsia_2`,
and `enemy_7085_xb2trn_2`. They require the appropriate native rendering path;
generic fallback shapes do not count as completed artwork. Original projectile,
environment and skill effects also remain separate work.

Use `npm run coverage:arkpedia-assets` for current stage exposure and
`npm run content:inventory -- --write` for current content counts and blockers.
