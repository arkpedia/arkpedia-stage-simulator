// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const dir = new URL('../../.cache/arkpedia/stage-mire-review/', import.meta.url);
await mkdir(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.ARKPEDIA_REVIEW_CHROME ?? '/usr/bin/chromium', headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage(), errors = [];
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 420 : 900, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/arkpedia/?stage=0-2`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), old = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return old.apply(this, args); };
    });
    await page.click('#start'); await page.waitForFunction(() => window.reviewBattle && document.querySelector('#damage'));
    const state = await page.evaluate(async () => {
      const { StageMire } = await import('/sim/content/arkpedia-stage-mire.js');
      const b = window.reviewBattle; b.addDp('arkpedia', 99);
      let selected;
      for (const id of Object.keys(b.bench)) for (let r = b.rect.r0; r <= b.rect.r1 && !selected; r++)
        for (let c = b.rect.c0; c <= b.rect.c1 && !selected; c++) if (!b.placementError(id, r, c)) selected = { id, r, c };
      if (!selected) throw Error('No deployable review operator');
      const { id, r, c } = selected, ally = b.deployOperator(id, r, c, 'RIGHT'), baseline = ally.s.aspd;
      const spec = { kind: 'mire', tiles: [[r, c]], scanInterval: .1, interval: 1, max: 10, aspdPer: -5, movePer: -.05, heavyWeight: 3 };
      b.stageMire = new StageMire(b, spec);
      for (let i = 0; i < 7; i++) b.step();
      const contact = { aspdLoss: baseline - ally.s.aspd, stacks: ally.mem.mireState?.stacks,
        logs: b.stageOutcomes?.counters.locate_on_tile_mire, tile: [r, c] };
      b.stageMire.tiles.clear(); for (let i = 0; i < 7; i++) b.step();
      return { contact, restored: ally.s.aspd === baseline, staleBuff: !!ally.findBuff('terrain:mire'), errors: b.errors };
    });
    assert.equal(state.contact.aspdLoss, 5); assert.equal(state.contact.stacks, 1); assert.equal(state.contact.logs, 1);
    assert.equal(state.restored, true); assert.equal(state.staleBuff, false); assert.deepEqual(state.errors, []); assert.deepEqual(errors, []);
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}.png`, dir).pathname });
    results.push({ mobile, scope: 'Controlled Mire fixture in the public client, not an admission of FC-1', ...state }); await page.close();
  }
  await writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n'); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
