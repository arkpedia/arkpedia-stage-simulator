// SPDX-License-Identifier: GPL-3.0-or-later
// Reviewed per-file revisions let new art arrive without repinning unrelated art.
const repositories=new Set(['arkpedia/arkpedia-image-assets','arkpedia/arkpedia-skin-assets']);
export function interfaceAssetUrl(data,repository,path){
 if(!repositories.has(repository)||typeof path!=='string'||!path||path.split('/').some(p=>!p||p==='.'||p==='..'||/[\\?#%\u0000-\u001f]/.test(p)))
  throw Error('Invalid interface asset identity');
 const bindings=data.interfaceAssets?.[repository],declared=bindings!=null&&Object.hasOwn(bindings,path),override=declared?bindings[path]:null,
  commit=declared?override?.commit:data.sources?.[repository];
 if(!/^[a-f0-9]{40}$/.test(commit??'')||declared&&(!/^[a-f0-9]{64}$/.test(override?.sha256??'')||!Number.isSafeInteger(override?.bytes)||override.bytes<=0))
  throw Error('Missing immutable reviewed interface asset');
 return `https://raw.githubusercontent.com/${repository}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
