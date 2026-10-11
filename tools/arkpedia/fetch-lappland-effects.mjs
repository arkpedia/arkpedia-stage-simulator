// SPDX-License-Identifier: GPL-3.0-or-later
// Recover the original effect bundle and shared rendering dependencies. This is
// source preparation; fetching a bundle does not enable the operator or renderer.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const cache=resolve('.cache/arkpedia'),version='26-09-23-17-49-43_b9cc4a';
const manifest=JSON.parse(await readFile(resolve(cache,'map-source/hot_update_list.json')));
if(manifest.versionId!==version)throw Error('Wrong pinned native resource version');
const names=['battle/prefabs/effects/whitw2.ab','[uc]shaders.ab',
  'arts/[pack]common.ab','battle/[pack]common.ab',
  ...manifest.abInfos.filter(r=>r.name.startsWith('refs/fx/')&&!r.name.includes('/overseas/')).map(r=>r.name)];
if(names.length!==23)throw Error('Shared native effect bundle inventory changed');
const sha=(algorithm,data)=>createHash(algorithm).update(data).digest('hex'),sources=[];
for(const name of names){
  const entry=manifest.abInfos.find(r=>r.name===name);
  if(!entry)throw Error(`Missing native rendering dependency: ${name}`);
  const local=resolve(cache,name==='battle/prefabs/effects/whitw2.ab'
    ?'lappland-alter-source/whitw2-effects.ab':`map-source/ab/${name}`);
  let data;
  try{data=await readFile(local);}catch(error){
    if(error.code!=='ENOENT')throw error;
    const filename=name.replaceAll('/','_').replaceAll('#','__').replace(/\.ab$/,'.dat');
    const archive=resolve(cache,'lappland-alter-source',filename);
    const url=`https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/${version}/${filename}`;
    const result=await fetch(url,{signal:AbortSignal.timeout(60000)});
    if(!result.ok)throw Error(`Native effect dependency unavailable (${result.status}): ${name}`);
    await mkdir(dirname(archive),{recursive:true});
    await writeFile(archive,Buffer.from(await result.arrayBuffer()));
    await mkdir(dirname(local),{recursive:true});
    execFileSync('python3',['-c',
      'import sys,zipfile,pathlib; pathlib.Path(sys.argv[3]).write_bytes(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
      archive,name,local]);
    data=await readFile(local);
  }
  if(data.length!==entry.abSize||sha('md5',data)!==entry.md5)
    throw Error(`Native effect dependency checksum mismatch: ${name}`);
  sources.push({path:name,bytes:data.length,md5:entry.md5,sha256:sha('sha256',data)});
  console.log(`Verified ${name}`);
}
await writeFile(resolve(cache,'lappland-alter-source/effect-bundles.json'),
  JSON.stringify({version,sources},null,2)+'\n');
