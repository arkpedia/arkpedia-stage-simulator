// SPDX-License-Identifier: GPL-3.0-or-later
// Shared bounded ammunition accounting; source adapters own capacity and reload clocks.
export class HunterMagazine {
  constructor(capacity) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw Error('Invalid source hunter capacity');
    this.capacity = capacity; this.bullets = capacity; this.removed = false;
  }
  get ammoUi() { return { current: this.bullets, maximum: this.capacity }; }
  consume() {
    if (this.removed || this.bullets <= 0) return false;
    this.bullets--; return true;
  }
  refill() {
    if (this.removed || this.bullets >= this.capacity) return false;
    this.bullets++; return true;
  }
  remove() { this.removed = true; }
}
