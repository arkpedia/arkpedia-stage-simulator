// SPDX-License-Identifier: GPL-3.0-or-later
// Materialize the verified canonical enemy tables into .cache/arkpedia, where
// enemy-records.mjs reads its pinned inputs.
import { fileURLToPath } from 'node:url';
import { loadCanonicalEnemyTables } from './canonical-data.mjs';
const { commit, files } = await loadCanonicalEnemyTables({ cacheDir: fileURLToPath(new URL('../../.cache/arkpedia/canonical/', import.meta.url)) });
console.log(`Canonical ${commit}: ${Object.keys(files).join(', ')}`);
