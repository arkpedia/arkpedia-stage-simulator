// SPDX-License-Identifier: GPL-3.0-or-later
// Private review metadata only. No registry, public operator or asset mutation.
import {readFile} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile);
export async function lapplandStageReviewData(assetRoot){
 const data=JSON.parse(await readFile(new URL('../../data/arkpedia-mvp.json',import.meta.url),'utf8'));
 const source=JSON.parse(await readFile(new URL('../../data/arkpedia-lappland-alter-prefabs.json',import.meta.url),'utf8'));
 if(!/^[a-f0-9]{40}$/.test(data.sd.commit)||data.sd.repository!=='arkpedia/arkpedia-sd-assets')throw Error('Private review needs the immutable public SD snapshot');
 const manifest=JSON.parse((await run('git',['show',`${data.sd.commit}:manifest.json`],{cwd:assetRoot,maxBuffer:32e6})).stdout);
 for(const [side,facing]of [['front','Front'],['back','Back']]){
  const key=`operator/char_1038_whitw2/default/${side}`,model=manifest.models[key],record=source.models.char_1038_whitw2[facing];
  if(!model||model.skeleton.sha256!==record.sha256||model.skeleton.bytes!==record.bytes)throw Error('Original Lappland model does not match the source controller review');
  data.sd.models[key]=model;
 }
 data.review={privateOperator:'char_1038_whitw2',publicFactory:false,compiledFrameParity:false};return data;
}
