// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const dir = new URL('../../.cache/arkpedia/stage-reeds-review/', import.meta.url); await mkdir(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.ARKPEDIA_REVIEW_CHROME ?? '/usr/bin/chromium', headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 420 : 900, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${origin}/arkpedia/?stage=fc-1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), old = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return old.apply(this, args); };
      const { StageRenderer } = await import('/arkpedia/renderer.js'), draw = StageRenderer.prototype.drawSurface;
      StageRenderer.prototype.drawSurface = function (...args) {
        const result = draw.apply(this, args); window.reviewRenderer = this;
        window.reviewPaintedReeds = [...(this.currentBattle?.stageReeds?.tiles.values() ?? [])].map(t => t.mode); return result;
      };
      Element.prototype.requestFullscreen = async () => {};
    });
    await page.click('#start'); await page.waitForFunction(() => window.reviewBattle && document.querySelector('#damage'));
    const state = await page.evaluate(() => {
      const b = reviewBattle, reeds = b.stageReeds; if (!reeds || !b.stageMire) throw Error('Missing source terrain programs');
      b.addDp('arkpedia', 99); let selected;
      for (const id of Object.keys(b.bench)) for (const tile of reeds.tiles.values())
        if (!selected && !b.placementError(id, tile.row, tile.col)) selected = { id, tile };
      if (!selected) throw Error('No deployable Reeds tile');
      const { id, tile } = selected, u = b.deployOperator(id, tile.row, tile.col, 'RIGHT'); window.reviewUnitId = u.id;
      for (let i = 0; i < 10; i++) b.step();
      const camouflaged = !!u.s.flags.camou, entryStealthExpired = !u.s.flags.stealth, hp = u.hp;
      reeds.ignite(tile.row, tile.col); for (let i = 0; i < 32; i++) b.step();
      return { sourceStage: b.stage.id, camouflaged, entryStealthExpired, burning: tile.mode,
        camouflageRemoved: !u.s.flags.camou, hpLost: hp - u.hp, burnGauge: u.elem.burn,
        originalTimers: [tile.ignite_duration, tile.extinct_duration, tile.cooldown_duration],
        reedsTiles: reeds.tiles.size, mireTiles: b.stageMire.tiles.size, errors: b.errors };
    });
    assert.equal(state.camouflaged, true); assert.equal(state.entryStealthExpired, true); assert.equal(state.burning, 1);
    assert.equal(state.camouflageRemoved, true); assert.ok(state.hpLost > 0); assert.equal(state.burnGauge, 40);
    assert.deepEqual(state.originalTimers, [15, 20, 5]); assert.equal(state.reedsTiles, 13); assert.deepEqual(state.errors, []);
    await page.waitForFunction(() => window.reviewPaintedReeds?.includes(1)
      && window.reviewRenderer?.views.get(window.reviewUnitId)?.actor
      && window.reviewRenderer.views.get(window.reviewUnitId).actor.constructor.name !== 'FallbackActor');
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}-burning.png`, dir).pathname });
    const outcomes = await page.evaluate(() => { reviewBattle._finish('cleared'); return reviewBattle.result().stageOutcomes; });
    await page.waitForSelector('.result .stage-outcomes');
    const summary = await page.$eval('.result .stage-outcomes', e => e.textContent);
    assert.match(summary, /Reeds at battle end: 1 burning/); assert.equal(outcomes.tileStates.length, 13); assert.deepEqual(errors, []);
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}-result.png`, dir).pathname });
    results.push({ mobile, scope: 'Original FC-1 loading with diagnostic deployment/ignition and forced result; not a playable clear', ...state, summary, outcomes });
    await page.close();
  }
  await writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n'); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
