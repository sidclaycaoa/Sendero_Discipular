import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const sha = data => createHash("sha256").update(data).digest("hex");

test("Full original files, literal text, exhaustive offsets and provenance survive batch indexing", async () => {
  const index = JSON.parse(await readFile(new URL("../lib/data/ad-book-index.json", import.meta.url), "utf8"));
  assert.equal(index.works.length, 7);
  assert.equal(index.passages.length, 828);
  for (const w of index.works) {
    const original = await readFile(new URL(`../public/ad-sources/${w.sourceFile}`, import.meta.url));
    assert.equal(sha(original), w.sourceHash);
    assert.equal(w.status, "INDEXED"); assert.equal(w.approved, true);
    const units = index.units.filter(u => u.workId === w.id);
    assert.equal(units.length, w.unitCount);
    assert.equal(units.reduce((n,u) => n+[...u.text].length, 0), w.characterCount);
    assert.equal(index.passages.filter(p => p.workId === w.id).length, w.passageCount);
    for (const u of units) {
      assert.equal(sha(u.text), u.textHash);
      const chunks = index.passages.filter(p => p.unitId === u.id).sort((a,b) => a.sequence-b.sequence);
      assert.equal(chunks.map(p => p.text).join(""), u.text);
      let offset = 0;
      for (const p of chunks) {
        assert.equal(p.startOffset, offset);
        assert.equal(p.text, [...u.text].slice(p.startOffset,p.endOffset).join(""));
        assert.equal(sha(p.text), p.textHash);
        assert.equal(p.location,u.location); assert.equal(p.revision,w.revision);
        if(w.sourceType === "pdf") assert.equal(p.page,u.number);
        else assert.ok(p.section);
        offset=p.endOffset;
      }
      assert.equal(offset,[...u.text].length);
    }
  }
});

test("A missing original requests a whole-book batch import, without fabricated passages", () => {
  const result = spawnSync("python3", ["-c", `
import importlib.util, json, tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('batch_index', 'scripts/index-books.py')
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
approved=json.loads(Path('lib/data/ad-approved-works.json').read_text())
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp); (root/'lib/data').mkdir(parents=True)
    (root/'lib/data/ad-approved-works.json').write_text(json.dumps(approved))
    module.ROOT=root; index=module.generate()
    assert len(index['works'])==7
    assert all(w['status']=='IMPORT_REQUIRED' and w['sourceHash']=='' for w in index['works'])
    assert index['passages']==[] and index['units']==[]
`], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
