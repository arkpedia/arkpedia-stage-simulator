// SPDX-License-Identifier: GPL-3.0-or-later
// Shared public controls only. Each owner supplies its own combat scenario and assertions.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import {createPublicReviewServer} from './public-review-server.mjs';
export async function publicReviewDriver({ origin, out, data, hook }) {
  const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
  if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start the requested local preview');
  const app = await readFile(new URL('../../public/arkpedia/app.js', import.meta.url), 'utf8');
  await mkdir(out, { recursive: true });
  const browser = await puppeteer.launch({ executablePath, headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  let fixture;
  try { fixture = await createPublicReviewServer({origin, app, data, hook}); } catch (error) { await browser.close(); throw error; }
  const errors = [], failedResources = []; let captures = 0;
  return { errors, failedResources, browserVersion: await browser.version(), cacheDisabled: true, sourceOrigin: origin, fixtureOrigin: fixture.origin, get captures() { return captures; },
    close: async () => { try { await browser.close(); } finally { await fixture.close(); } },
    async open({ label, mobile, operators, skillId }) {
      const page = await browser.newPage(), network = new Map(), messages = [];
      page.on('console', m => { if (['error', 'warn'].includes(m.type())) messages.push(m.text().slice(0, 400)); });
      page.on('request', r => { if (/\.(skel|atlas|png)(?:\?|$)/.test(new URL(r.url()).pathname)) network.set(r.url(), { start: Date.now(), phase: 'request' }); });
      page.on('response', r => { const n = network.get(r.url()); if (n) { n.status = r.status(); n.cached = r.fromCache(); } });
      page.on('requestfinished', r => { const n = network.get(r.url()); if (n) { n.phase = 'complete'; n.elapsed = Date.now() - n.start; } });
      page.on('pageerror', e => errors.push({ label, error: String(e) }));
      page.on('requestfailed', r => failedResources.push({ label, url: r.url(), error: r.failure()?.errorText }));
      page.on('response', r => { if (r.status() >= 400) failedResources.push({ label, url: r.url(), status: r.status() }); });
      await page.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true } : { width: 1280, height: 800 });
      await page.bringToFront();
      // Live external assets use the normal browser transport; fixture overrides
      // are served only by the loopback app/data server. TLS checks stay enabled.
      await page.setCacheEnabled(false);
      await page.goto(fixture.origin + '/arkpedia/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.roster-item.chosen');
      for (const id of await page.$$eval('.roster-item.chosen', es => es.map(e => e.dataset.id))) {
        await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
      }
      for (const id of operators) {
        await page.$eval('#roster-search', (e, name) => { e.value = name; e.dispatchEvent(new Event('input', { bubbles: true })); }, data.operators[id].name);
        await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
        if (skillId && data.operators[id].skills.some(s => s.id === skillId)) await page.select('#skillId', skillId);
      }
      await page.click('#start');
      try {
        await page.waitForFunction(() => window.cnReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
      } catch (error) {
        const state = await page.evaluate(() => document.body.innerText.slice(-1200));
        console.error(JSON.stringify({ label, browserVersion: await browser.version(), state,
          errors, messages: messages.slice(-8), network: [...network].map(([url, n]) => ({ url, ...n, elapsed: n.elapsed ?? Date.now() - n.start })), failedResources: failedResources.slice(0, 4), failedCount: failedResources.length }));
        throw error;
      }
      const capture = async suffix => { await page.screenshot({ path: out + label + '-' + suffix + '.png' }); captures++; };
      const drag = async (from, to) => {
        if (mobile) { await page.touchscreen.touchStart(from.x, from.y); await page.touchscreen.touchMove(to.x, to.y); await page.touchscreen.touchEnd(); }
        else { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up(); }
      };
      const tile = async (row, col) => page.evaluate((r, c) => {
        const a = cnReview.renderer, p = a.projection.project(c, r, a.heightAt(r, c));
        const box = document.querySelector('#battle-board').getBoundingClientRect(); return { x: p.x + box.x, y: p.y + box.y };
      }, row, col);
      const deploy = async (id, row, col, facing) => {
        const card = await page.$('#deployment [data-id="' + id + '"]'), box = await card.boundingBox(); assert.ok(box);
        await drag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, await tile(row, col));
        await page.waitForSelector('.facing-picker:not([hidden])');
        assert.equal(await page.evaluate(id => !!cnReview.battle.bench[id].unit?.alive, id), false);
        const handle = await (await page.$('.facing-handle')).boundingBox();
        const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
        const delta = { UP: [0, -65], DOWN: [0, 65], LEFT: [-65, 0], RIGHT: [65, 0] }[facing]; assert.ok(delta);
        if (mobile) { await page.touchscreen.touchStart(from.x, from.y); await page.touchscreen.touchMove(from.x + delta[0], from.y + delta[1]); }
        else { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + delta[0], from.y + delta[1], { steps: 8 }); }
        assert.equal(await page.evaluate(id => !!cnReview.battle.bench[id].unit?.alive, id), false);
        if (mobile) await page.touchscreen.touchEnd(); else await page.mouse.up();
        await page.waitForFunction(id => cnReview.battle.bench[id].unit?.alive, {}, id);
      };
      return { page, capture, deploy, tile, drag };
    },
  };
}
