# Selected-stage device controllers

The client prepares thirteen existing controller groups through a fixed import
index before constructing a battle. Each battle creates controllers selected by
its own device records, supplied tokens and terrain. Previously cached modules
do not install controllers or hooks in subsequent stages. Initialization retains
the original order around environment and branch setup.

Selection includes hidden scheduled devices, zero-count supplied cards which
can receive later drops, and wooden stump terrain. Coils and demolition select
from both preplaced devices and supplied cards. Unselected controllers are null;
the existing optional controller references retain their empty behavior. The
route-blocking helper moved to a small shared module so crate placement does not
import the scenery controller.

Node tools retain eager module preparation for their synchronous constructor.
Concurrent browser requests coalesce; failed imports and missing exports can
retry. Required controllers are checked before battle construction. Adding a
controller means adding one index entry with its selection rule, fixed module
path and constructor mapping. There are no per-stage copies.

Validation: 94 device/combat/loading tests, followed by the focused loader suite
with the canonical demolition token, and ten-second runtime checks for all 959
available stage graphs. Browser checks cover 0-1, BB-1, MB-8 and TW-3 plus restart.
The basic stage loads no controller, MB-8 loads manual devices, and TW-3 loads
Gramophones. Desktop and touch activation of an Imprisonment Device both consume
five DP, reset SP, reconfine and stun the prisoner without runtime errors.

The basic-stage request count falls from 411 to 396 JavaScript requests, with
measured module response bytes falling from 937,739 to 910,137 in these browser
checks. This excludes data, artwork and other assets. The compiled device data
and existing common helper imports remain shared startup dependencies. Evidence
is recorded in `data/arkpedia-device-runtime-loading-review.json`.
