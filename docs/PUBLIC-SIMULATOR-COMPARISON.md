# Public simulator references checked 2026-11-14

The checked repositories did not provide a broader, ready-to-import independent
operator/enemy/stage implementation. This is a bounded comparison of the sources
below, not a claim that no other project exists.

- [wfrfred/ArkBattle](https://github.com/wfrfred/ArkBattle), inspected at
  `c011da5a4d178312f95eae1ee2f294b760d2425b`: substantial original-runtime research
  and shared engine architecture. Its `src/content/operators` contains Melantha
  and Mudrock; `src/content/enemies` contains Hound and Crossbowman plus the shared
  ground implementation. Its implemented content is much smaller than this
  simulator's catalogue, while its timing, targeting and buff lifecycle research
  is useful for checking specific semantics. The `EXTEND_TIME` enum/contract was
  used as corroboration for Cheering Sponsor Drone duration accumulation. No
  source code or duplicated assets were imported.
- [Wirowo/ArknightsBattleSimulator](https://github.com/Wirowo/ArknightsBattleSimulator):
  the README describes running the original game through an emulator/proxy with
  edited battle inputs. It relies on the game client's content and battle engine;
  it does not supply equivalent independent browser battle implementations.
- [insomnyawolf/ArknightsBattleSimulator](https://github.com/insomnyawolf/ArknightsBattleSimulator/tree/rewrite-is2):
  the inspected `rewrite-is2` README similarly requires the original client and
  proxy and describes additional mode configuration. It is not a replacement
  content library for this engine.
- [Tim23333/Arknights_timer](https://github.com/Tim23333/Arknights_timer), inspected
  at `5734c30bf54780056ff758505380322c0cf519fe`: contains an extensive historical
  Python emulator and native-field research. Its current README marks V1 as
  historical and describes V2 validation as 332 tests plus a 0-1 Yato/Kroos clear;
  it explicitly leaves client timing calibration open. This does not establish
  broader validated combat coverage than ours. Its wave audit usefully separates
  original field declarations from unproven runtime semantics. Neither its code
  nor assets were copied.
- [WardTrapXFog/Arknights-Simulator](https://github.com/WardTrapXFog/Arknights-Simulator):
  README blob `a88739695019d8cfabff7ef185031af8c57000c5` and architecture blob
  `e10bcc7cd6e89f3d6519cda026141cfd16f7e037` describe a Stronghold/AUE-derived
  sandbox with custom JSON stages. The documented roster has 464 slots
  (202 original, three custom, 259 AUE) and 259 integrated enemy entries.
  Those are integration counts, not certification of all skills or stages.
- [ArknightsDevs/Arknights-Universal-Engine](https://github.com/ArknightsDevs/Arknights-Universal-Engine),
  inspected at `84a501a221720aecbd719caaa3d9bf9a22630787`: its README reports
  461 selectable operators, with 72 six-stars using Stronghold scripts and
  generic implementations for other entries; it explicitly acknowledges partial
  skills and talents. Its deterministic 30 Hz engine and detailed movement
  specifications are useful references. A larger selectable roster does not
  establish broader complete mechanics or original-stage coverage. The
  displacement specification and implementation were inspected for push/pull
  physics, including their marked assumptions; no artwork was imported.

The 2026-11-14 scheduler follow-up checked ArkBattle's research at
`196426f20a6ec53b168e6dae1b308136e8fa426c`. Its documented native callback chain
clarifies that `blockFragment` waits for action completion, not enemy death,
and that wave post-delay follows the managed-wave gate. See
[`STAGE-WAVES-REVIEW.md`](STAGE-WAVES-REVIEW.md) for the implementation and limits.

Continue implementing shared mechanics here, retaining original game definitions
and behavior tests. Revisit ArkBattle's focused research for uncertain native
semantics; do not equate a reference implementation or a registered record with
verified client behavior.
