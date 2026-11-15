# Delayed death spawns retain battle completion

Killing the final enemy could declare victory on the next tick, before its
pending death-spawn callback ran. The shared delayed-spawn adapter now marks
that callback as holding battle completion. Once it releases the children,
their normal live-body ownership takes over. Killing those children then
clears the battle normally. The callback remains independent of the dead
parent, using the already-captured route.

This fixes 13 admitted enemy definitions through one shared scheduler flag.
It changes no spawn parameters or source admission. Escapes and zero counts
do not create a waiting timer; immediate children still spawn immediately.
An earlier timeout ends the battle and prevents the callback from running.

Before the fix, 14 of the 16 new regression cases fail. Afterward all 468
focused and enemy/boss integration checks pass, along with all 969 available
stage smoke checks. Browser review loads/restarts OD-EX-1 and runs a controlled
last-parent fixture from its compiled graph: zero children at 0.1 seconds,
two by 0.333 seconds, then victory only after defeating them. This is not an
original-stage clear or a new native-fidelity certificate.
Evidence: `data/arkpedia-delayed-spawn-victory-review.json`.
