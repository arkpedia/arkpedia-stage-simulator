// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start the local preview');
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const dir = new URL(`../../${process.env.ARKPEDIA_REVIEW_OUT ?? '.cache/arkpedia/stage-predefined-review'}/`, import.meta.url);
const stageIds = process.env.ARKPEDIA_REVIEW_STAGES ? JSON.parse(process.env.ARKPEDIA_REVIEW_STAGES)
  : ['tr-4', 'tr-6', '1-11', 'cb-3', 'of-6', '11-3', 'tw-s-1'];
if (!Array.isArray(stageIds) || !stageIds.length || stageIds.some(id => typeof id !== 'string' || !/^[a-z0-9_-]+$/.test(id)))
  throw Error('Invalid predefined review stage list');
await mkdir(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args }), results = [];
try {
  for (const mobile of [false, true]) for (const id of stageIds) {
    console.error('Reviewing predefined', mobile ? 'touch' : 'desktop', id);
    const page = await browser.newPage(), errors = [];
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/arkpedia/?stage=${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js');
      const old = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return old.apply(this, args); };
      Element.prototype.requestFullscreen = async () => {};
    });
    await page.click('#start');
    await page.waitForFunction(() => window.reviewBattle && document.querySelector('#damage'), { timeout: 60000 });
    const initial = await page.evaluate(() => ({
      bench: Object.keys(window.reviewBattle.bench),
      hidden: Object.entries(window.reviewBattle.bench).filter(([, e]) => e.hidden).map(([id]) => id),
      actors: window.reviewBattle.allyUnits.filter(u => u.alive).map(u => u.defId),
      predefined: [...window.reviewBattle.stagePredefined.values()].map(e => ({ key: e.key, trust: e.build.trust, hidden: e.hidden,
        base: window.reviewBattle.bench[e.build.id].unit?.base })),
    }));
    const expectedTrust = { 'gt-1': 0, 'gt-3': 0, 'mn-tr-1': 2 }[id];
    if (expectedTrust !== undefined) {
      assert.ok(initial.predefined.length > 0);
      assert.ok(initial.predefined.every(e => e.trust === expectedTrust));
      assert.ok(initial.predefined.filter(e => !e.hidden).every(e => e.base && Number.isFinite(e.base.maxHp) && e.base.maxHp > 0));
    }
    if (id === 'tr-4') assert.equal(initial.hidden.length, 2);
    if (id === 'tr-6') assert.ok(initial.actors.includes('char_501_durin'));
    if (id === '1-11') assert.ok(initial.hidden.includes('char_211_adnach'));
    const expected = { 'cb-3': ['char_213_mostma', 'char_325_bison'], 'of-6': ['char_340_shwaz'], '11-3': ['char_4045_heidi'] }[id];
    if (expected) {
      assert.ok(expected.every(actor => initial.actors.includes(actor)));
      assert.equal(initial.bench.length, expected.length + 5, 'player squad is preserved beside the trial actors');
      assert.equal(initial.hidden.length, 0);
    }
    if (id === 'tw-s-1') { assert.equal(initial.bench.length, 5); assert.equal(initial.actors.length, 0); }
    const state = await page.evaluate(() => {
      const b = window.reviewBattle; b.life = 1e6;
      const actorIds = new Set([...b.stagePredefined.values()].filter(e => e.kind === 'actor').map(e => e.build.id));
      const actorStats = new Map();
      const capture = unit => { if (actorIds.has(unit.defId)) actorStats.set(unit.defId, { ...unit.base }); };
      for (const u of b.allyUnits) capture(u);
      const hook = b.on('deploy', ({ unit }) => capture(unit));
      let steps = 0;
      while (!b.finished && steps++ < 6000 && [...b.stagePredefined.values()].some(e => e.hidden && !e.activated)) b.step();
      b.off(hook);
      return { seconds: b.time, activated: [...b.stagePredefined.values()].filter(e => e.activated).map(e => e.key),
        hidden: Object.entries(b.bench).filter(([, e]) => e.hidden).map(([id]) => id),
        actors: b.allyUnits.filter(u => u.alive).map(u => u.defId), actorStats: Object.fromEntries(actorStats), errors: b.errors };
    });
    if (expectedTrust !== undefined) {
      assert.equal(Object.keys(state.actorStats).length, initial.predefined.length);
      assert.ok(Object.values(state.actorStats).every(base => Number.isFinite(base.maxHp) && base.maxHp > 0));
    }
    assert.deepEqual(errors, []); assert.deepEqual(state.errors, []); assert.deepEqual(state.hidden, []);
    if (id === '1-11') assert.ok(state.actors.includes('char_211_adnach'));
    await page.waitForFunction(() => [...document.querySelectorAll('#deployment button')].every(button => button.hidden === !!window.reviewBattle.bench[button.dataset.id]?.hidden));
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#deployment button')].some(button => window.reviewBattle.bench[button.dataset.id]?.noCard)), false);
    assert.equal(await page.evaluate(() => [...reviewBattle.stagePredefined.values()].filter(e => e.kind === 'actor').every(e => reviewBattle.bench[e.build.id].noCard === true)), true);
    if (id === 'tr-6') {
      const actor = await page.evaluate(() => {
        const u = reviewBattle.allyUnits.find(u => u.alive && u.defId === 'char_501_durin');
        return { row: u.tileR + 1, col: u.tileC + 1 };
      });
      await page.click(`.tile-hit[aria-label*="row ${actor.row}, column ${actor.col}"]`);
      await page.waitForSelector('#retreat', { visible: true });
      await page.click('#retreat');
      await page.waitForFunction(() => !reviewBattle.bench.char_501_durin.unit?.alive);
      assert.equal(await page.evaluate(() => !!document.querySelector('#deployment button[data-id="char_501_durin"]')), false);
      state.cardlessRetreat = true;
    }
    await page.screenshot({ path: new URL(`${id}-${mobile ? 'touch' : 'desktop'}.png`, dir).pathname });
    results.push({ id, mobile, initial, ...state }); await page.close();
  }
  await writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
