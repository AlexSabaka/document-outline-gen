# Tech debt

Tracked shortcuts and known gaps. See `ROADMAP.md` for the forward plan.

## Pre-existing parser gaps (surfaced 2026-06-12 when the jest harness was restored)

The test suite never actually ran before (no jest config). Standing it up revealed three
generators that produce wrong output for cases the legacy tests assert. These are **out of
scope** for the WASM-engine pass and are marked `it.skip` in
`tests/DocumentOutlineGenerator.test.ts` with back-references here.

| Generator | Symptom | Resolution path |
|---|---|---|
| `MarkdownGenerator` | gray-matter frontmatter is parsed away but not exposed as `metadata.frontmatter` | Markdown rework (ROADMAP Phase 6, optional) |
| `TypeScriptGenerator` (acorn) | returns 0 class members for a basic class | Fixed by the Phase 2 tree-sitter migration; un-skip the test then |
| `HtmlGenerator` (cheerio) | does not emit `id`'d `<section>` nodes | HTML rework (not currently scheduled) |

## WASM engine (Phase 1)

- **`web-tree-sitter` is pinned `<0.25` (`^0.24.7`).** The 0.25 release rewrote the WASM
  loader (new dylink format) and cannot load the prebuilt grammars shipped by
  `tree-sitter-wasms@0.1.x` (which tops out at 0.1.13). Upgrading the runtime requires a
  0.25-compatible grammar source (e.g. `@vscode/tree-sitter-wasm` or self-built wasm).
  Until then we stay on the 0.24.x API (`Parser.Language.load`, `lang.query`).
- **C++ metadata is structure-only.** `CppGenerator` emits namespaces/classes/structs/enums/
  functions/methods/fields with positions, but no parameters/visibility/return types yet.
  Deferred to ROADMAP Phase 3 (metadata depth). C++ is not a kg-gen near-term corpus.

## Notes

- `generateFromContent` rejects with `UnsupportedExtensionError` on unknown extensions.
  Heterogeneous-input callers (kg-gen) should switch to `generateFromContentSafe` /
  `generateFromFileSafe`, which return `[]` instead. kg-gen still calls the throwing variant
  in `src/shared/utils/documentOutline.ts` — switch it over to silence the per-chunk warnings.
