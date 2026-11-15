# Imprisonment Devices

Original trap_025_prison instances now use the shared manual-device controller.
The finite device store retains level and original facing. Its asymmetric 3-15
range rotates with that facing rather than becoming a symmetric radius. The
2,000-HP device is vulnerable, cannot be healed, is immune to Stun/Freeze and
carries the original prison selector tag. Its tile blocks walking and placement;
destruction restores the original tile and records the source result counters.

The device charges 25 SP at its own SP recovery rate. Recovery modifiers and
SP-recovery-stop are respected. Manual activation requires a live eligible
recipient, readiness and five DP, and failed requests consume neither resource.
The pulse immediately applies two seconds of Stun to eligible ground/flying
recipients and reconfines liberated prisoners. Target-free and stealth still
restrict selection; sleeping/disabled-combat recipients use the selected native
exception. The fixed 4.17-second cast holds SP recovery before charging again.

Both the native Sniper Prisoner controller and the existing shared prisoner
controller expose reconfinement. Already-confined attack counts are preserved.
Forced reconfinement cancels a liberated native cast and restarts its ordinary
attack interval even if that prisoner is immune to Stun. The result panel counts
actual state changes as Prisoners reconfined; this is a local outcome projection.
The source's ready/empty visual effects are represented by the existing device
state/SP interface. Original mesh/Animation body and particle rendering remain
pending, and the labelled fallback actor is used.

Source admission checks root/mode/passive references, flags, immunity, the tagged
selector, fixed cast, guarded mode switch, action payloads and original manual
skill values. Rounded-tile contact, the sleeping selector exception, stat/SP
buckets, restart timing and fixed-tick ordering are local mappings; original
compiled-client and frame/pixel parity are not certified.

Nine focused cases pass. Original MB-2, MB-3 and MB-4 retain their device facings,
accept manual reconfinement and resolve their full schedules under controlled
kills. The combined suite passes 298 tests; all 935 loadable stages pass ten-second
runtime smoke checks. Desktop and touch Chromium reviews select the original
MB-2 device on the map and use its Activate button, verifying DP payment, SP
reset, stun, reconfinement and no browser/runtime errors. The desktop view was
inspected. Public artwork in that headless review uses the pinned environment
proxy certificates; production asset URLs and server code are unchanged.

The shared device store remains thirteen families and now has 308 definitions
(111,080 bytes). This element unlocks eight additional stages. Enemy admission
remains 697 of 2,163; 935 of 3,892 combat stages are loadable.
