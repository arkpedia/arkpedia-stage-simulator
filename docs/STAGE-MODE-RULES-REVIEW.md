# Individual-stage mode rules

Integrated Strategies stages use the ordinary stage compiler, component graph,
wave scheduler and battle engine. Source budgets are checked against the original
level before admission. A mode tag enables seven shared preparation controls:
life, initial DP, deployment limit, DP recovery, enemy HP, ATK and DEF multipliers.
The defaults retain the original level's budgets. The user supplies values for
their run; collectibles, squad bonuses and progression are not applied automatically.

Validation rejects unknown fields, non-finite values, invalid integer budgets and
initial DP above the stage cap. Applying settings clones the affected records, so
cached components and subsequent battles retain their original values. Restart
keeps the selected settings. Unsupported environments, enemies, devices and
branches remain admission blockers, including in Integrated Strategies.

The first checkpoint contains four Integrated Strategies stages and 776 loadable
combat stages overall. All 776 graphs passed the ten-second runtime smoke. The
34 focused mode, rule, content-addition and library tests passed. Desktop and
touch browser checks exercised all seven controls, a real enemy spawn and restart;
the 13-case general library browser regression also passed. These are runtime
and interaction checks, not full stage clears or native frame-parity evidence.
See `data/arkpedia-mode-review.json` for the checkpoint hashes and results.

To add another individual-stage mode, implement its original option and modifier
contract in `tools/arkpedia/stage-mode-rules.mjs`, extend the shared validator and
preparation controls only when necessary, and rebuild the library. Do not add a
special battle implementation or a manual list of allowed stage IDs. Full runs,
carried state and automatic collectible effects remain outside the agreed scope.
