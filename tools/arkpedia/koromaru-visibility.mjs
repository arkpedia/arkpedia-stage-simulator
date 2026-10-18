// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {recoverOriginalVisibility} from './original-visibility.mjs';
const id='char_4220_kormr',output=new URL('../../data/arkpedia-koromaru-visibility.json',import.meta.url);
export const recoverVisibility=({read=readFile}={})=>recoverOriginalVisibility({id,read,receipt:new URL(`../../data/arkpedia-native-operators/${id}.json`,import.meta.url),sha256:'d1c567412953bbf4e6b71dbe289cc5b079eebb7bb581a660282e6fdc428e1d0b',clip:'Skill_Loop',sampleTimes:[.35,1.8],skeleton:face=>new URL(`../../.cache/arkpedia/cn-operators/${id}/${face.toLowerCase()}.skel`,import.meta.url)});
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const bytes=JSON.stringify(await recoverVisibility(),null,2)+'\n';if(process.argv.includes('--write'))await writeFile(output,bytes);else assert.equal(await readFile(output,'utf8'),bytes);console.log('Koromaru original hidden/visible attachment schedules verified; no gameplay or shader parity approval.');}
