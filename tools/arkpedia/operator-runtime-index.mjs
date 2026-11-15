// SPDX-License-Identifier: GPL-3.0-or-later
// Conservatively split adapters only when every exported hook starts with the
// same literal identity guard. Anything else remains a shared eager dependency.
import { readFile, writeFile, mkdtemp, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const base = new URL('../../server/sim/content/', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');
export function guardedIdentity(source, names, imported = new Map()) {
  const values = new Map();
  for (const m of source.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|([A-Z][A-Z0-9_]*))\s*[,;\n]/g)) {
    if (values.has(m[1])) return null; // Ambiguous shadowing is never inferred.
    values.set(m[1], m[2] ?? m[3] ?? { ref: m[4] });
  }
  const resolve = (key, seen = new Set()) => {
    if (seen.has(key)) return null; seen.add(key);
    if (imported.has(key)) return imported.get(key);
    const value = values.get(key); return typeof value === 'string' ? value : value?.ref ? resolve(value.ref, seen) : imported.get(key) ?? null;
  };
  const ids = names.map(name => {
    const start = new RegExp(`export function ${name}\\s*\\([A-Za-z0-9_\\s,:{}]*\\)\\s*\\{\\s*if\\s*\\(\\s*(?:id|def\\.charId|def\\.id)\\s*!==\\s*(?:'([^']*)'|"([^"]*)"|([A-Z][A-Z0-9_]*))\\s*\\)\\s*return\\s*;`).exec(source);
    return start && (start[1] ?? start[2] ?? resolve(start[3]));
  });
  return ids.length && ids.every(id => /^char_[a-z0-9_]+$/.test(id ?? '') && id === ids[0]) ? ids[0] : null;
}
export function guardedFamily(source, names, registries) {
  const families = names.map(name => {
    const head = new RegExp(`export function ${name}\\s*\\([A-Za-z0-9_\\s,:{}]*\\)\\s*\\{`).exec(source);
    if (!head) return null;
    const body = source.slice(head.index + head[0].length)
      .replace(/^\s*const\s+id\s*=\s*def\.charId\s*;\s*/, '');
    return /^\s*if\s*\(\s*!([A-Z][A-Z0-9_]*)\[(?:id|def\.charId)\](?:\s*\|\|\s*!def\.skill)?\s*\)\s*return\s*;/.exec(body)?.[1] ?? null;
  });
  if (!families.length || !families.every(f => f && f === families[0])) return null;
  const ids = registries.get(families[0]);
  return ids?.length && ids.every(id => /^char_[a-z0-9_]+$/.test(id)) ? ids : null;
}
/** Follow only literal constant declarations and named relative imports. No
 * controller is executed to discover its owner, and unknown expressions stay
 * shared. Dependencies that change an owner also change the generated index. */
async function literalIdentity(source, url, name, seen = new Set()) {
  const key = `${url.href}#${name}`; if (seen.has(key)) return null; seen.add(key);
  const declarations = [...source.matchAll(new RegExp(`\\bconst\\s+${name}\\s*=\\s*(?:'([^']*)'|"([^"]*)"|([A-Z][A-Z0-9_]*))\\s*[,;\\n]`, 'g'))];
  if (declarations.length > 1) return null;
  if (declarations.length) {
    const m = declarations[0]; return m[1] ?? m[2] ?? literalIdentity(source, url, m[3], seen);
  }
  for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    if (!m[2].startsWith('.')) continue;
    for (const spec of m[1].split(',').map(s => s.trim().split(/\s+as\s+/))) {
      if ((spec[1] ?? spec[0]) !== name) continue;
      const next = new URL(m[2], url);
      return literalIdentity(await readFile(next, 'utf8'), next, spec[0], seen);
    }
  }
  return null;
}
export async function buildRuntimeIndex() {
  const source = await readFile(new URL('arkpedia-operator-runtime-eager.js', base), 'utf8'), imports = new Map();
  for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g))
    for (const name of m[1].split(',').map(s => s.trim())) imports.set(name, m[2]);
  const entries = [];
  for (const m of source.matchAll(/Object\.freeze\(\{ key: '([^']+)'([^}]+)\}\)/g)) {
    const hooks = Object.fromEntries([...m[2].matchAll(/(customize|install): (\w+)/g)].map(x => [x[1], x[2]]));
    const paths = [...new Set(Object.values(hooks).map(name => imports.get(name)))];
    if (!Object.keys(hooks).length || paths.length !== 1 || !paths[0]?.startsWith('./')) throw Error(`Ambiguous runtime adapter: ${m[1]}`);
    const url = new URL(paths[0], base), body = await readFile(url, 'utf8'), imported = new Map();
    for (const match of body.matchAll(/\b(?:id|def\.charId|def\.id)\s*!==\s*([A-Z][A-Z0-9_]*)/g)) {
      const id = await literalIdentity(body, url, match[1]);
      if (/^char_[a-z0-9_]+$/.test(id ?? '')) imported.set(match[1], id);
    }
    const id = guardedIdentity(body, Object.values(hooks), imported), registries = new Map();
    if (!id) for (const match of body.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+(?:-operators|\/summons)\.js)['"]/g)) {
      const metadata = await import(new URL(match[2], url).href);
      for (const name of match[1].split(',').map(s => s.trim()))
        if ((name.endsWith('_OPERATORS') || name === 'REGULAR_SUMMONS') && metadata[name]) registries.set(name, Object.keys(metadata[name]).sort());
    }
    const ids = id ? null : guardedFamily(body, Object.values(hooks), registries);
    entries.push({ key: m[1], module: paths[0], hooks, id, ...(ids ? { ids } : {}), sourceSha256: sha(body) });
  }
  if (!entries.length || new Set(entries.map(e => e.key)).size !== entries.length) throw Error('Invalid runtime adapter index');
  const output = '// SPDX-License-Identifier: GPL-3.0-or-later\n// Generated by tools/arkpedia/operator-runtime-index.mjs. Do not hand-edit.\n'
    + `// Ordered registration SHA-256: ${sha(source)}\nexport const OPERATOR_RUNTIME_INDEX = Object.freeze([\n`
    + entries.map(e => `  Object.freeze({ ...${JSON.stringify(e)}, load: () => import(${JSON.stringify(e.module)}) }),`).join('\n') + '\n]);\n';
  return { output, entries };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { output, entries } = await buildRuntimeIndex(), path = new URL('arkpedia-operator-runtime-index.js', base);
  if (process.argv.includes('--check')) {
    if (await readFile(path, 'utf8') !== output) throw Error('Operator runtime index is stale; regenerate it');
  } else {
    const directory = await mkdtemp(new URL('.runtime-index-', base));
    try {
      await writeFile(`${directory}/index.js`, output);
      await rename(`${directory}/index.js`, path);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  console.log(JSON.stringify({ adapters: entries.length, guarded: entries.filter(e => e.id || e.ids).length, shared: entries.filter(e => !e.id && !e.ids).length,
    path: fileURLToPath(path) }));
}
