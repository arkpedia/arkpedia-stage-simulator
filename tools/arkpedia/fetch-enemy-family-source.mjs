// SPDX-License-Identifier: GPL-3.0-or-later
// Fetch only retained family dependencies; no runtime/art or support admission.
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {parsePinnedCNManifest,verifyCNNativeBundle,CN_NATIVE_PIN} from './cn-native-source.mjs';
import {verifiedChapter16FamilyGraph} from './enemy-support.mjs';
import {verifiedFirewallEnvironmentSource} from './firewall-environment-source.mjs';
const root=new URL('../../',import.meta.url),cache=new URL('.cache/arkpedia/cn-native-source/',root);
const sha=b=>createHash('sha256').update(b).digest('hex');

export async function familySourcePlan(families,{read=readFile}={}){
  if(!families.length||families.some(f=>!/^[a-z][a-z0-9-]*$/.test(f)))throw Error('Plain retained family identifiers required');
  const [inventory,enemyInventory,index]=await Promise.all(['arkpedia-cn-native-source.json','arkpedia-cn-enemy-native-source.json','arkpedia-enemy-clock-source.json'].map(p=>read(new URL('data/'+p,root))));
  const bundles=new Map();
  const add=row=>{
    if(!/^(?:battle\/|config\/|refs\/arts\/)[a-z0-9_\[\]/.-]+\.ab$/.test(row.path)||row.path.includes('..'))throw Error('Unsafe retained bundle path');
    if(!Number.isInteger(row.bytes)||row.bytes<=0||!/^[a-f0-9]{32}$/.test(row.md5)||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('Incomplete retained bundle pin');
    const old=bundles.get(row.path);
    if(old&&['bytes','md5','sha256'].some(k=>old[k]!==row[k]))throw Error('Conflicting retained bundle pins');
    bundles.set(row.path,{path:row.path,bytes:row.bytes,md5:row.md5,sha256:row.sha256});
  };
  for(const family of [...new Set(families)]){
    const prefix='data/candidates/arkpedia-'+family;
    const [graphRaw,clockRaw]=await Promise.all([read(new URL(prefix+'-source.json',root)),read(new URL(prefix+'-animation-source.json',root))]);
    const graph=verifiedChapter16FamilyGraph(graphRaw,inventory,enemyInventory,JSON.parse(index)),clock=JSON.parse(clockRaw);
    if(clock.source.inventory.sha256!==sha(inventory)||clock.source.graph.sha256!==sha(graphRaw)
      ||clock.source.bundle.manifestSha256!==CN_NATIVE_PIN.manifestSha256)throw Error('Family clock and native graph pins disagree');
    for(const row of graph.source.bundles)add(row);
    add(clock.source.bundle);
    if(family==='ch17-firewall-boss'){
      const environment=verifiedFirewallEnvironmentSource(await read(new URL('data/candidates/arkpedia-ch17-firewall-environment-source.json',root)),inventory);
      add(environment.source.bundle);
    }
  }
  return [...bundles.values()].sort((a,b)=>a.path.localeCompare(b.path));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),fetching=args.includes('--fetch');
  if(args.some(a=>a.startsWith('--')&&a!=='--fetch'))throw Error('Usage: fetch-enemy-family-source.mjs [--fetch] family...');
  const plan=await familySourcePlan(args.filter(a=>a!=='--fetch'));
  const download=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Pinned source response '+r.status);return Buffer.from(await r.arrayBuffer());};
  const cached=async(file,url,check)=>{
    let raw;try{raw=await readFile(file);}catch(e){
      if(!fetching||e.code!=='ENOENT')throw e;
      raw=await download(url);check(raw);await mkdir(new URL('./',file),{recursive:true});await writeFile(file,raw);
    }
    check(raw);return raw;
  };
  const manifest=parsePinnedCNManifest(await cached(new URL('hot_update_list.json',cache),new URL('hot_update_list.json',CN_NATIVE_PIN.baseURL),parsePinnedCNManifest));
  for(const row of plan){
    const published=manifest.abInfos.find(p=>p.name===row.path);
    if(!published||published.abSize!==row.bytes||published.md5!==row.md5)throw Error('Retained bundle absent from frozen publisher manifest');
    const target=new URL('bundles/'+row.path,cache);let raw;
    try{raw=await readFile(target);}catch(e){
      if(!fetching||e.code!=='ENOENT')throw e;
      const archive=row.path.replaceAll('/','_').replace(/\.ab$/,'.dat'),zip=new URL('archives/'+archive+'.'+randomUUID(),cache),temp=new URL(target.href+'.'+randomUUID());
      await mkdir(new URL('archives/',cache),{recursive:true});await mkdir(new URL('./',target),{recursive:true});
      try{
        await writeFile(zip,await download(new URL(archive,CN_NATIVE_PIN.baseURL)));
        execFileSync(process.env.ARKPEDIA_SOURCE_PYTHON??'python3',['-c','import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1]); i=z.getinfo(sys.argv[2]); assert i.file_size==int(sys.argv[4]); pathlib.Path(sys.argv[3]).write_bytes(z.read(i))',fileURLToPath(zip),row.path,fileURLToPath(temp),String(row.bytes)]);
        raw=await readFile(temp);verifyCNNativeBundle(row,raw);if(sha(raw)!==row.sha256)throw Error('Retained bundle SHA256 differs');
        await rename(temp,target);
      }finally{await Promise.all([rm(zip,{force:true}),rm(temp,{force:true})]);}
    }
    verifyCNNativeBundle(row,raw);if(sha(raw)!==row.sha256)throw Error('Retained bundle SHA256 differs');
  }
  const mvp=JSON.parse(await readFile(new URL('data/arkpedia-mvp.json',root))),pin=mvp.behaviors.source;
  if(mvp.sources[pin.repository]!==pin.commit)throw Error('Named template source differs from retained snapshot');
  await cached(new URL('.cache/arkpedia/buff_template_data.json',root),`https://raw.githubusercontent.com/${pin.repository}/${pin.commit}/${pin.path}`,b=>{if(sha(b)!==pin.sha256)throw Error('Named template checksum mismatch');});
  console.log(`Verified ${plan.length} original family dependency bundles and pinned named templates`);
}
