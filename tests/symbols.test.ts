import DocumentOutlineGenerator, {
  hashContent,
  SYMBOL_SCHEMA_VERSION,
  SYMBOL_KINDS,
  emptySymbolTable,
} from '../src';

const gen = new DocumentOutlineGenerator();

describe('extractSymbols — definitions', () => {
  it('captures exported top-level symbols with signatures (the gate)', async () => {
    const ts = [
      "import { helper } from './u';",
      'export function countTerms(text: string): number { return helper(text); }',
      'function internal() {}',
      "export class Svc { run() { return countTerms('a'); } }",
    ].join('\n');

    const { symbols } = await gen.extractSymbols(ts, 'ts', { fileName: 'svc.ts' });

    const countTerms = symbols.find((s) => s.name === 'countTerms')!;
    expect(countTerms).toMatchObject({ kind: 'function', exported: true });
    expect(countTerms.signature).toContain('text: string');
    expect(countTerms.signature).toContain(': number');

    expect(symbols.find((s) => s.name === 'internal')!.exported).toBe(false);
    expect(symbols.find((s) => s.name === 'run')).toMatchObject({
      kind: 'method',
      qualifiedName: 'Svc.run',
    });
  });

  it('python uses the underscore convention for export', async () => {
    const py = 'def count_terms(t):\n    return t\ndef _hidden():\n    pass\n';
    const { symbols } = await gen.extractSymbols(py, 'py');
    expect(symbols.find((s) => s.name === 'count_terms')!.exported).toBe(true);
    expect(symbols.find((s) => s.name === '_hidden')!.exported).toBe(false);
  });

  it('every emitted kind is a member of the SymbolKind set', async () => {
    const ts = 'export class C { x = 1; m() {} }\nexport enum E { A }\n';
    const { symbols } = await gen.extractSymbols(ts, 'ts');
    expect(symbols.length).toBeGreaterThan(0);
    for (const s of symbols) {
      expect(SYMBOL_KINDS).toContain(s.kind);
    }
  });

  it('returns an empty table for non-code extensions', async () => {
    expect(await gen.extractSymbols('# hi', 'md')).toEqual(emptySymbolTable());
  });
});

describe('extractSymbols — reference edges', () => {
  it('emits within-file calls and import edges (TS)', async () => {
    const ts = [
      "import lib from 'lib';",
      'export function a() { return b(); }',
      'function b() { return lib(); }',
    ].join('\n');
    const { references } = await gen.extractSymbols(ts, 'ts', { fileName: 'm.ts' });

    expect(references).toContainEqual({ from: 'm.ts', to: 'lib', kind: 'imports', line: 1 });
    expect(references).toContainEqual(
      expect.objectContaining({ from: 'a', to: 'b', kind: 'calls' }),
    );
  });

  it('emits python import / from-import / call edges', async () => {
    const py = 'import os\nfrom pkg.sub import thing\ndef f():\n    g()\n';
    const { references } = await gen.extractSymbols(py, 'py', { fileName: 'm.py' });

    const imports = references.filter((r) => r.kind === 'imports').map((r) => r.to);
    expect(imports).toEqual(expect.arrayContaining(['os', 'pkg.sub']));
    expect(references).toContainEqual(
      expect.objectContaining({ from: 'f', to: 'g', kind: 'calls' }),
    );
  });

  it('languages without a references query yield symbols but no edges', async () => {
    const go = 'package main\nfunc Foo() { Bar() }\nfunc Bar() {}\n';
    const { symbols, references } = await gen.extractSymbols(go, 'go');
    expect(symbols.length).toBeGreaterThan(0);
    expect(references).toEqual([]);
  });
});

describe('content hash + schema', () => {
  it('hashes deterministically and is content-sensitive', () => {
    expect(hashContent('abc')).toBe(hashContent('abc'));
    expect(hashContent('abc')).not.toBe(hashContent('abc '));
  });

  it('tables carry the current schema version', async () => {
    const table = await gen.extractSymbols('export function f(){}', 'ts');
    expect(table.schemaVersion).toBe(SYMBOL_SCHEMA_VERSION);
  });
});
