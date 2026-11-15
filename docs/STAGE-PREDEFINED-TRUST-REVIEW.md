# Predefined operator trust thresholds

Predefined operators now accept every valid integer favor-point value in the
pinned source table. Previously the compiler rejected a value between two
frames when their battle phases differed. That treated a discrete threshold
table as a potentially continuous stat curve and blocked ordinary source builds.

The loader selects the last favor frame whose point threshold has been reached
and retains its integer `battlePhase`. A build stores twice that phase so the
existing operator-stat builder evaluates the separate `favorKeyFrames` at the
same phase. This is combat-equivalent trust, not a claim that the source's
displayed percentage is always even. Source level evidence retains the original
points. Ordinary player-selected build settings are unchanged.

The numerical source is the checksum-pinned `arkpedia-favor-source.json`, from
Kengxxiao/ArknightsGameData commit
`a550f5e048bb94e7cdefc6eb97a4091f0c4c7add`, blob
`bfad1ea682d10a3eea5bd7254362c825f33dd22e`. The
[PRTS trust reference](https://prts.wiki/w/%E4%BF%A1%E8%B5%96%E5%80%BC)
describes point thresholds for displayed trust. Native declarations separately
identify the integer combat phase in
[FavorData](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/Torappu/FavorData.md)
and its lookup in
[FavorDB](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/Torappu/FavorDB.md).
This is a table-threshold simulation contract; those declarations do not
provide an executable client method body.

Tests cover both sides of a phase threshold, the full-stat threshold, endpoints
and invalid inputs. GT-1, GT-3 and MN-TR-1 exercise original level compilation
and ordinary battle construction, without stage-specific behavior branches.

Validation at this checkpoint: 37 loader, squad and component-library tests pass;
all 863 available stages pass a ten-second engine smoke check. Desktop and touch
browser checks pass for GT-1, GT-3 and MN-TR-1, including scheduled actor
activation and finite stats. MN-TR-1's touch layout was visually inspected in
the simplified-map renderer; this is not original artwork verification.

The shared threshold fix unlocks GT-1, GT-3, MN-TR-1, OF-1, TR-17, TR-S-1,
TW-4 and TW-TR-1. The library now has 863 available stages out of 3,892;
unsupported mechanics continue to block other stages. The reproducible evidence
receipt is `data/arkpedia-stage-predefined-trust-review.json`.
