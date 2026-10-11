// SPDX-License-Identifier: GPL-3.0-or-later
const PARTS = {
  startDown: ["start", "additive"], startUp: ["start", "additive"], startBack: ["start", "additive"],
  endDown: ["end", "additive"], endUp: ["end", "alpha"],
};

export function gateTiles(geometry, heightAt) {
  return geometry.tileGrid.flatMap((row, r) => row.flatMap((type, c) => {
    const key = geometry.tileLegend[type].key;
    return key === "tile_start" || key === "tile_end"
      ? [{ row: r, col: c, kind: key === "tile_start" ? "start" : "end", height: heightAt(r, c) }]
      : [];
  }));
}

export function validateGatePack(pack) {
  if (pack.schemaVersion !== 1 || pack.coordinates !== "column,row,height" ||
      pack.source?.bundle !== "arts/effects/[pack]map.ab" || pack.parts?.length !== 5 ||
      new Set(pack.parts.map(p => p.key)).size !== 5)
    throw Error("Invalid standard gate pack");
  for (const part of pack.parts) {
    const expected = PARTS[part.key];
    if (!expected || part.kind !== expected[0] || part.blend !== expected[1] ||
        part.tint?.length !== 3 || part.tint.some(v => !Number.isFinite(v) || v < 0))
      throw Error("Invalid gate part");
    for (const [name, size, type] of [["position",3,"Float32"],["uv",2,"Float32"],["index",1,"Uint32"]]) {
      const a = part.attributes?.[name];
      if (!a || a.type !== type || a.itemSize !== size || !Number.isSafeInteger(a.byteOffset) ||
          a.byteOffset < 0 || a.byteOffset % 4 || !Number.isSafeInteger(a.count) || a.count < 1 ||
          a.byteOffset + a.count * size * 4 > pack.buffer.bytes)
        throw Error("Invalid gate geometry range");
    }
    if (part.attributes.uv.count !== part.attributes.position.count || part.attributes.index.count % 3)
      throw Error("Invalid gate attributes");
  }
}
