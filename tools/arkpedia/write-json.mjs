// SPDX-License-Identifier: GPL-3.0-or-later
// Readers keep seeing a complete snapshot while a rebuild prepares its replacement.
import { writeFile, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
// Windows readers/antivirus can briefly deny replacement. Keep the old file
// intact and retry rename; deleting the target would break atomic visibility.
export async function renameWithRetry(source,target,{renameFile=rename,wait=pause,platform=process.platform}={}) {
  for(let attempt=0;;attempt++) {
    try{return await renameFile(source,target);}
    catch(error){
      if(platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=7)throw error;
      await wait(10*2**attempt);
    }
  }
}
export async function writeJSONAtomic(path, value) {
  const target = path instanceof URL ? fileURLToPath(path) : path;
  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    await renameWithRetry(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
