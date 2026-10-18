# Original CN source import

`extract-cn-operator.py` produces held source evidence, not a playable operator. It verifies the pinned native inventory and CN tables, walks the complete owner/default-art/skill/projectile hierarchies, resolves referenced tokens and transitive buff templates, and preserves original pointers and literal skill bindings. Run it with the source Python environment and Node 22 or 24 in `ARKPEDIA_SOURCE_NODE`:

```sh
python tools/arkpedia/extract-cn-operator.py --operator char_4224_turdus
python tools/arkpedia/verify-cn-operator.py --operator char_4224_turdus
python tools/arkpedia/audit-cn-operator.py --operator char_4224_turdus
```

Repeat verification and the independent mutation audit on both supported Node versions. The verifier reconstructs dependencies directly from the original bundles/tables, rather than trusting the claimed dependency list. Missing original assets, incomplete templates, unsupported token-art bindings and premature approval flags must fail. Keep unsuccessful imports out of the public roster.

Dependency discovery distinguishes numeric blackboard operands from asset references. A complete native formula binds `_sourceKey`, `_sourceKey2` and `_targetKey` as variable names. Native `_projectileIndexKey`, `_multiplyParamKey` and `_atkScaleKey` also read numeric parameters. These explicit fields do not identify projectile prefabs, even when their values begin with `projectile_`. Arbitrary `_targetKey` fields and actual `_projectileKey` dependencies still resolve normally; missing direct or transitive projectiles remain errors. There is no exemption based on the string prefix alone.

The standard Node suite runs `test-cn-reference-closure.py` when Python is available. Its seven cases exercise both actual walkers, including serialized/nested formulas, required transitive assets and missing-asset rejection. They need neither UnityPy nor network access.

At CN revision `a550f5e048bb94e7cdefc6eb97a4091f0c4c7add`, this distinction recovers complete held foundations for Leizi the Thunderbringer, SilverAsh the Reignfrost, Violet Mizutsune Orchid and Ch'en the Dawnstreak. Both Node versions independently verify all four. SilverAsh's audit reproduces nineteen original outputs and rejects 51 altered source/approval claims on each version. Existing Ukusik evidence remains unchanged and independently verifies on both versions. Angelina Alter still fails at a separate unsupported token-art binding, and Oblivion still fails at an unresolved original projectile; neither is admitted by relaxing these guards.

Source acceptance is followed by selected combat implementation, exact clock recovery, [original artwork review](ORIGINAL-OWNER-ART.md), public UI/original-wave tests, and full regression. These steps do not establish compiled-client, native shader/effect or game-frame parity. Arkpedia app dev and production remain held separately.
