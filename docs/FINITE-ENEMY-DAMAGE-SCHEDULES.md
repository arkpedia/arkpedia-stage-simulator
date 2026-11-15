# Finite enemy damage scheduling

The regular Flamerazer adapter expands each damage window into delayed hits.
Each delay previously registered a repeating timer. A four-hit window therefore
kept firing after its duration, and repeated windows accumulated permanent timers.
The callbacks now use the shared one-shot scheduler.

The regression fixture produced 18 hits instead of four before this correction.
A repeated-window fixture accumulated 48 timers; the corrected fixture holds at
most four. After a single window completes, its queue is empty. This fixes both
unintended damage and growing scheduling work.

The same registration mistake affected the Bombardier explosion, Royal Court
Caster channel/end burst, Infused Soul Husk orbit and Focused Soul Remnant line.
Their individual-activation fixtures produced 7/14/33/27 hits instead of
1/4/5/3. Each now schedules its finite callbacks once and empties its queue.

All 188 combined feature, plan and timer tests pass. The existing adapter's
window parameters, targeting, elemental scaling and death blast are outside this
small correction; this is not a native fidelity certificate. Companion Guards'
unrelated dormant Flame rows were removed from execution in the earlier fix.
