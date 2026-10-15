// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated original-art compatibility review, not a playable-battle approval.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start the port-3182 preview.');
const origin = 'http://127.0.0.1:3182', route = '/arkpedia/branch-art-review.html';
const out = '.cache/arkpedia/cn-operators/char_4207_branch/art-browser/';
const manifest = JSON.parse(await readFile('../arkpedia-sd-assets/manifest.json', 'utf8'));
const rows = ['char_4207_branch'].flatMap(id => ['front', 'back'].map(face => {
  const r = manifest.models[`operator/${id}/default/${face}`];
  assert.ok(r && typeof r.premultipliedAlpha === 'boolean' && r.animations && r.animationRoles);
  return { id, face, pma: r.premultipliedAlpha, durations: r.animations,
    roles: r.animationRoles, files: Object.fromEntries([r.skeleton, r.atlas, ...r.textures]
      .map(f => [f.path.split('/').at(-1), '../arkpedia-sd-assets/' + f.path])),
    hashes: [r.skeleton, r.atlas, ...r.textures].map(({ path, sha256 }) => ({ path, sha256 })) };
}));
await mkdir(out, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vetochki original artwork review</title><script src="/vendor/pixi.min.js"></script><script src="/vendor/pixi-spine.js"></script>
<style>body{margin:0;background:#10191d;color:#dae9ed;font:14px sans-serif}header{padding:12px}#scene{height:calc(100dvh - 52px)}canvas{display:block}</style>
<header>CONTROLLED ART REVIEW · Vetochki · Front / Back · original clips, scaled for inspection · not a battle</header><div id="scene"></div>
<script>(async()=>{
 const P=PIXI, rows=${JSON.stringify(rows.map(({ files, ...r }) => ({ ...r, names: Object.keys(files) })))}, host=document.querySelector('#scene');
 const app=new P.Application({width:innerWidth,height:host.clientHeight,backgroundColor:0x10191d,autoStart:false,antialias:true});host.append(app.view);
 const actors=[];
 for(const [i,a] of rows.entries()){
  const skel=a.names.find(k=>k.endsWith('.skel')),atlas=a.names.find(k=>k.endsWith('.atlas')),prefix='/branch-review-assets/'+i+'/';
  const loaded=await P.Assets.load({src:prefix+skel,data:{spineAtlasFile:prefix+atlas,imageMetadata:{alphaMode:a.pma?P.ALPHA_MODES.PMA:P.ALPHA_MODES.UNPACK}}});
  const s=new P.spine.Spine(loaded.spineData);s.autoUpdate=false;app.stage.addChild(s);
  const label=new P.Text('',{fontFamily:'sans-serif',fontSize:14,fill:0xdbeaed});label.anchor.set(.5);app.stage.addChild(label);actors.push({...a,s,label});
 }
 function draw(phase='Idle',age=.35){
  app.renderer.resize(innerWidth,host.clientHeight);const columns=innerWidth<1000?2:actors.length,w=innerWidth/columns,h=host.clientHeight/Math.ceil(actors.length/columns);
  return actors.map((a,i)=>{
   const cx=(i%columns+.5)*w,top=Math.floor(i/columns)*h,clip=Object.hasOwn(a.durations,phase)?phase:null;
   a.s.visible=clip!=null;a.label.text=('Vetochki')+' · '+a.face+' · '+(clip??'absent '+phase);a.label.position.set(cx,top+h-18);
   if(clip==null)return {id:a.id,face:a.face,clip,age,absent:true};
   a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,clip,phase==='Idle');a.s.scale.set(1);a.s.position.set(0);a.s.update(age);
   const b=a.s.getLocalBounds();if(!(b.width>0&&b.height>0))throw Error('Unexpected empty original clip '+a.id+'/'+a.face+'/'+clip);
   const scale=Math.min((w-40)/b.width,(h-44)/b.height);a.s.scale.set(scale);a.s.position.set(cx-(b.x+b.width/2)*scale,top+(h-24)/2-(b.y+b.height/2)*scale);
   return {id:a.id,face:a.face,clip,age,width:b.width,height:b.height,scale};
  });
 }
 window.branchArtReview={actors,app,draw,ready:true};draw();app.renderer.render(app.stage);
})().catch(e=>{window.reviewError=e.stack;console.error(e)});</script>`;
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], failed = [], report = { artworkOnly: true, publicBattleTest: false,
  sources: rows.map(({ id, face, pma, hashes }) => ({ id, face, pma, hashes })), clips: [], captures: [] };
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
  await page.setRequestInterception(true);
  page.on('request', async r => {
    const url = new URL(r.url());
    if (url.pathname === route) return r.respond({ status: 200, contentType: 'text/html', body: html });
    if (url.pathname === '/favicon.ico') return r.respond({ status: 204 });
    const match = /^\/branch-review-assets\/(\d+)\/([^/]+)$/.exec(url.pathname);
    const file = match && rows[Number(match[1])]?.files[match[2]];
    if (file) return r.respond({ status: 200, contentType: file.endsWith('.png') ? 'image/png' : file.endsWith('.atlas') ? 'text/plain' : 'application/octet-stream', body: await readFile(file) });
    return r.continue();
  });
  for (const [name, width, height, touch] of [['desktop', 1280, 720, false], ['landscape-phone', 844, 390, true]]) {
    await page.setViewport({ width, height, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.branchArtReview?.ready || window.reviewError, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.reviewError), undefined);
    const clips = await page.evaluate(() => branchArtReview.actors.flatMap(a => a.s.spineData.animations.filter(c => c.name !== 'Default').map(c => {
      a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,c.name,false);a.s.update(Math.min(.5,c.duration/2));
      const b=a.s.getLocalBounds();return {id:a.id,face:a.face,clip:c.name,duration:c.duration,width:b.width,height:b.height};
    })));
    assert.equal(clips.length, rows.reduce((n, r) => n + Object.keys(r.durations).filter(c => c !== 'Default').length, 0));
    assert.ok(clips.every(c => Number.isFinite(c.width + c.height) && c.width > 0 && c.height > 0));
    report.clips.push(...clips.map(c => ({ viewport: name, ...c })));
    for (const phase of ['Start','Idle','Die','Attack','Skill_2_Begin','Skill_2_Loop','Skill_2_Idle','Skill_2_End']) {
      const states = await page.evaluate(phase => { const r = branchArtReview.draw(phase);branchArtReview.app.renderer.render(branchArtReview.app.stage);return r; }, phase);
      assert.ok(states.every(s => s.absent || s.scale > 0 && Number.isFinite(s.scale)));
      if (phase === 'Die') assert.ok(states.filter(s => s.face === 'back').every(s => s.absent));
      const file = out + name + '-' + phase.toLowerCase() + '.png'; await page.screenshot({ path: file });
      report.captures.push({ name, width, height, touch, phase, file, states });
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  await writeFile(out + 'report.json', JSON.stringify({ ...report, errors, failed }, null, 2) + '\n');
  console.log(JSON.stringify({ clipsPerViewport: report.clips.length / 2, captures: report.captures.length, errors, failed }));
} finally { await browser.close(); }
