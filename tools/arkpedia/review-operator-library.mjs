// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME');
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const index = JSON.parse(await readFile(new URL('../../data/arkpedia-operators.json', import.meta.url)));
const directory = new URL('../../.cache/arkpedia/operator-library-review/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args }), results = [];
try {
  for (const mobile of (process.argv.includes('--touch') ? [true] : [false, true])) {
    const page = await browser.newPage(), errors = [], requested = [];
    await page.evaluateOnNewDocument(() => performance.setResourceTimingBufferSize(10000));
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => errors.push(e.message));
    const ids = Object.keys(index.roster), slowId = ids[7], nextId = ids[8], failedId = ids[9];
    let fail = true, delayed = null;
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url()), path = url.pathname; requested.push(path);
      if (path.endsWith(`${index.operators[failedId]}.json`) && fail) { fail = false; void request.respond({ status: 503, body: 'retry' }); }
      else if (path.endsWith(`${index.operators[slowId]}.json`)) delayed = request;
      else void request.continue();
    });
    console.error('Reviewing on-demand', mobile ? 'touch' : 'desktop');
    await page.goto(`${origin}/arkpedia/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    assert.equal(await page.$$eval('.roster-item', rows => rows.length), Object.keys(index.roster).length);
    const operatorHashes = new Set(Object.values(index.operators));
    const modelHashes = new Set(Object.values(index.models));
    const requestedHashes = () => requested.map(path => path.split('/').at(-1).replace('.json', ''));
    assert.equal(requestedHashes().filter(hash => operatorHashes.has(hash)).length, 1);
    assert.equal(requestedHashes().filter(hash => modelHashes.has(hash)).length, 0);
    assert.equal(requested.includes('/data/arkpedia-mvp.json'), false);
    assert.equal(requested.includes('/sim/arkpedia.js'), false, 'combat runtime is deferred until battle');
    assert.deepEqual([...new Set(requested.filter(path => path.startsWith('/data/') && !path.includes('/objects/')))].sort(),
      ['/data/arkpedia-library.json', '/data/arkpedia-operators.json']);
    const edit = id => page.$eval(`.roster-item[data-id="${id}"]`, element => element.click());
    await edit(failedId);
    await page.waitForSelector('#retry-operator');
    await page.evaluate(() => { document.addEventListener('click', e => window.reviewLastClick = e.target.id, true); });
    if (mobile) await page.tap('#retry-operator'); else await page.locator('#retry-operator').click();
    await page.waitForFunction(name => document.querySelector('#build h3')?.textContent === name, {}, index.roster[failedId].name).catch(async e => { await page.screenshot({path: new URL('retry-failure.png', directory).pathname}); console.error(requestedHashes().filter(h=>h===index.operators[failedId]).length, await page.evaluate(() => ({lastClick: window.reviewLastClick, build: document.querySelector('#build').innerHTML, error: document.querySelector('#prep-error').textContent})), errors); throw e; });
    await edit(slowId);
    await page.waitForFunction(() => document.querySelector('#build')?.textContent === 'Loading operator…');
    await edit(nextId);
    await page.waitForFunction(name => document.querySelector('#build h3')?.textContent === name, {}, index.roster[nextId].name);
    assert.ok(delayed, 'earlier request held until the next selection renders');
    const completed = page.waitForResponse(response => response.url().endsWith(`${index.operators[slowId]}.json`));
    await delayed.continue(); await completed;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.$eval('#build h3', el => el.textContent), index.roster[nextId].name);
    const minimalRuntime = await page.evaluate(async () => {
      const { createOperatorRuntime } = await import('/sim/content/arkpedia-operator-runtime.js');
      await import('/sim/arkpedia.js');
      const runtime = createOperatorRuntime();
      await runtime.prepare(['char_123_fang', 'char_124_kroos']);
      return runtime.stats();
    });
    assert.deepEqual(minimalRuntime, { loaded: [], pending: 0 });
    for (const path of ['/sim/content/arkpedia-summons.js', '/data/arkpedia-summon-prefabs.json',
      '/data/arkpedia-guard-six-star-third-prefabs.json', '/data/arkpedia-five-star-defender-second-prefabs.json'])
      assert.equal(requested.includes(path), false, `minimal squad must not load ${path}`);
    await page.select('#support', 'char_2023_ling');
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), old = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewViewportCalls = (window.reviewViewportCalls ?? 0) + 1; window.reviewBattle = this; return old.apply(this, args); };
      window.reviewFullscreenWaiters = [];
      Element.prototype.requestFullscreen = function () {
        return new Promise(resolve => window.reviewFullscreenWaiters.push(resolve));
      };
    });
    await page.locator('#start').click();
    await page.waitForFunction(() => window.reviewBattle && document.querySelector('#damage'), { timeout: 60000 });
    const state = await page.evaluate(() => {
      const battle = window.reviewBattle;
      for (let n = 0; n < 30; n++) battle.step();
      return { bench: Object.keys(battle.bench), tokens: Object.keys(battle.data.raw.tokens), errors: battle.errors,
        runtime: battle.operatorRuntime.stats(),
        resources: performance.getEntriesByType('resource').filter(e => /\/(sim|shared|data)\//.test(new URL(e.name).pathname))
          .map(e => ({ path: new URL(e.name).pathname, bytes: e.decodedBodySize })) };
    });
    assert.ok(state.bench.includes('char_2023_ling'));
    assert.ok(state.tokens.some(id => id.includes('ling')));
    assert.deepEqual(errors, []); assert.deepEqual(state.errors, []);
    assert.equal(requested.includes('/data/arkpedia-mvp.json'), false);
    assert.equal(requested.includes('/sim/content/arkpedia-operator-runtime-eager.js'), false);
    assert.equal(requested.includes('/data/arkpedia-enemy-native-abilities.json'), false, 'native enemy research evidence is not a browser runtime dependency');
    assert.equal(requested.includes('/data/arkpedia-native-operators/char_4182_oblvns.json'), false);
    for (const file of ['arkpedia-marcil-prefabs.json', 'arkpedia-muelsyse-prefabs.json', 'arkpedia-native-operators/char_4228_closur.json'])
      assert.equal(requested.includes('/data/' + file), false, `unselected squad controller: ${file}`);
    assert.ok(requestedHashes().filter(hash => operatorHashes.has(hash)).length < 15);
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}.png`, directory).pathname });
    // A later squad must load a previously absent controller and its evidence,
    // then reuse the same prepared runtime on restart.
    await page.click('#settings'); await page.click('#exit');
    await page.waitForSelector('#start:not(:disabled)').catch(async error => {
      console.error('Returning to squad', errors, await page.evaluate(() => ({ error: document.querySelector('#prep-error')?.textContent,
        build: document.querySelector('#build')?.textContent, disabled: document.querySelector('#start')?.disabled,
        appHidden: document.querySelector('#app').hidden, workspace: !!document.querySelector('.workspace'),
        fullscreen: document.fullscreenElement?.className, chosen: document.querySelectorAll('.roster-item.chosen').length })));
      throw error;
    });
    await edit('char_4182_oblvns');
    await page.waitForFunction(name => document.querySelector('#build h3')?.textContent === name, {}, index.roster.char_4182_oblvns.name);
    await page.$eval('#toggle', button => button.click());
    await page.waitForSelector('#start:not(:disabled)'); await page.$eval('#start', button => button.click());
    await page.waitForFunction(() => window.reviewBattle?.bench.char_4182_oblvns, { timeout: 60000 });
    const selectedRuntime = await page.evaluate(() => {
      const b = reviewBattle; b.autoFinish = false; b.addDp('arkpedia', 99);
      let tile;
      for (let r = b.rect.r0; r <= b.rect.r1; r++) for (let c = b.rect.c0; c <= b.rect.c1; c++)
        if (!tile && !b.placementError('char_4182_oblvns', r, c)) tile = [r, c];
      if (!tile) throw Error('No selected-operator deployment tile');
      const u = b.deployOperator('char_4182_oblvns', ...tile, 'RIGHT');
      for (let i = 0; i < 30; i++) b.step();
      return { loaded: b.operatorRuntime.stats().loaded, controller: !!u.mem.oblvnsOwner, errors: b.errors };
    });
    assert.ok(selectedRuntime.loaded.includes('arkpedia-oblvns')); assert.equal(selectedRuntime.controller, true);
    assert.deepEqual(selectedRuntime.errors, []);
    assert.ok(requested.includes('/data/arkpedia-native-operators/char_4182_oblvns.json'));
    assert.equal(requested.includes('/data/arkpedia-native-operators/char_4212_nasti.json'), false);
    await page.click('#settings'); await page.click('#restart');
    assert.equal(await page.evaluate(() => !!reviewBattle.bench.char_4182_oblvns && reviewBattle.operatorRuntime.stats().pending === 0), true);
    const staleFullscreen = await page.evaluate(async () => {
      const battle = reviewBattle, before = reviewViewportCalls, waiters = reviewFullscreenWaiters.splice(0);
      for (const resolve of waiters) resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
      return { requests: waiters.length, currentBattlePreserved: reviewBattle === battle, viewportCalls: reviewViewportCalls - before };
    });
    assert.equal(staleFullscreen.requests, 2); assert.equal(staleFullscreen.currentBattlePreserved, true);
    assert.equal(staleFullscreen.viewportCalls, 0, 'late fullscreen results cannot mutate old or restarted battles');
    assert.deepEqual(errors, []);
    results.push({ mobile, initialOperatorRecords: 1, initialModelRecords: 0, fullSnapshotRequested: false,
      failedDownloadRetried: true, staleSelectionIgnored: true, minimalRuntime, ...state, selectedRuntime, staleFullscreen });
    await page.close();
  }
  await writeFile(new URL('results.json', directory), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
