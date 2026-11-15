// SPDX-License-Identifier: GPL-3.0-or-later
// Independent device additions use the same pinned-byte verifier and component publisher.
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mergeBodyArtwork,prepareBodyArtwork,publishBodyArtwork,bodyArtworkScope} from './body-artwork.mjs';
export const mergeDeviceArtwork=(models,registry,options={})=>mergeBodyArtwork(models,registry,{...options,kind:'device'});
export const prepareDeviceArtwork=options=>prepareBodyArtwork({...options,kind:'device'});
export const publishDeviceArtwork=(snapshot,registry,destination)=>publishBodyArtwork(snapshot,registry,destination,{kind:'device'});
const root=fileURLToPath(new URL('../../',import.meta.url)),scope=bodyArtworkScope('device');

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {values}=parseArgs({options:{commit:{type:'string'},ids:{type:'string'},'asset-root':{type:'string'},write:{type:'boolean'},'reuse-files':{type:'boolean'}}});
  const registryPath=resolve(root,'data/arkpedia-device-artwork.json'),snapshotPath=resolve(root,'data/arkpedia-mvp.json');
  let registry;try{registry=JSON.parse(await readFile(registryPath));}catch(e){if(e.code!=='ENOENT')throw e;}
  const next=await prepareDeviceArtwork({assetRoot:values['asset-root']??resolve(root,'../arkpedia-sd-assets'),
    commit:values.commit,ids:JSON.parse(await readFile(values.ids)),registry,reuseFiles:values['reuse-files']});
  const snapshot=JSON.parse(await readFile(snapshotPath));
  snapshot.sd.models=mergeDeviceArtwork(snapshot.sd.models,next,{reuseFiles:values['reuse-files']});
  if(values.write) await publishDeviceArtwork(snapshot,next,root);
  console.log(JSON.stringify({models:Object.keys(next.models).length,written:!!values.write,scope}));
}
