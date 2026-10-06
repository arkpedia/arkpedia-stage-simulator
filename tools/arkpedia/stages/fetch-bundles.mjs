// SPDX-License-Identifier: GPL-3.0-or-later
// Download only the original 0-1 scene and its referenced theme/lighting packs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const args=process.argv.slice(2);
const value=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const version=value('--version');
if (!/^[0-9]{2}(?:-[0-9]{2}){5}_[a-f0-9]+$/.test(version || ''))
  throw Error('Pass --version with a pinned Global Android resource version');
const out=resolve(value('--out','.cache/arkpedia/map-source'));
const base=`https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/${version}`;
await mkdir(out,{recursive:true});
const download=async url=> {
  const r=await fetch(url,{signal:AbortSignal.timeout(60000)});
  if (!r.ok) throw Error(`Asset unavailable: ${url} (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
};
const manifest=await download(`${base}/hot_update_list.json`);
await writeFile(resolve(out,'hot_update_list.json'),manifest);
const list=JSON.parse(manifest).abInfos;
for (const bundle of [
  'scenes/obt/main/level_main_00-01/level_main_00-01.ab',
  'arts/maps/map_chernobog_a/res.ab',
  'scenes/obt/main/level_main_00-01/level_main_00-01/lightingdata.ab',
]) {
  const entry=list.find(e=>e.name===bundle);
  if (!entry) throw Error(`Bundle absent from pinned manifest: ${bundle}`);
  const file=bundle.replaceAll('/','_').replaceAll('#','__').replace(/\.[^.]*$/,'.dat');
  const zip=resolve(out,file), target=resolve(out,'ab',bundle);
  await writeFile(zip,await download(`${base}/${file}`));
  await mkdir(dirname(target),{recursive:true});
  // Read only the named archive member; never extract arbitrary archive paths.
  execFileSync('python3',['-c',
    'import sys,zipfile,pathlib; pathlib.Path(sys.argv[3]).write_bytes(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
    zip,bundle,target]);
  const bytes=await readFile(target);
  if (bytes.length!==entry.abSize || createHash('md5').update(bytes).digest('hex')!==entry.md5)
    throw Error(`Bundle checksum mismatch: ${bundle}`);
  console.log(`Verified ${bundle}`);
}
console.log(`Ready to export from ${out}/ab`);
