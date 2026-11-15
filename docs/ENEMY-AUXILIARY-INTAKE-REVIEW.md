# Automatic intake of native helper evidence

The native extractor now discovers a bounded class of candidate components:
enemies with no handbook abilities, talents or skills, one native mode, no
ability wrappers, and only original passive-buff components in the common and
general ability lists. It retains those exact components and their referenced
templates from the verified bundles. Discovery does not grant support.

The existing auxiliary classifier still requires its exact component shape,
no selector, empty attributes and blackboard, reviewed lifetime/control fields,
and either the empty template or a verified stateless kill-log action. Native
flags, immunities, attributes and unknown actions remain blockers. There is no
new no-op fallback and no relaxation of that classifier.

Six records now pass the existing contract without bespoke controllers:
Test Power Armor, Unicellular Predator, Allotropic Predator, High Priest
(April Fools), Veteran Junkman (April Fools), and Smashing Stones. Their ordinary
attacks, blocking where applicable, and kill accounting use the common engine.
Tests also verify that Dream Tiles, tombstones, the special hold marker,
Endspeaker variant and Chest Seaborn stay blocked despite empty handbook or
skill lists.

`automaticAuxiliaryCandidates` in the retained evidence names the original
component IDs selected by discovery. Re-running the extractor after an atomic
enemy-record addition discovers the same bounded class automatically. The
support builder verifies the original component digests and derives admission;
the stage-library build then discovers any newly compatible stages.

This is the existing basic-stats/ordinary-attacks support tier, not a native
animation, projectile, frame-order or visual-parity certificate. Candidate
research data is not a browser dependency. The two runtime consumers that once
loaded the entire native evidence file now share fourteen source-validated range
offsets with their admission predicates.
