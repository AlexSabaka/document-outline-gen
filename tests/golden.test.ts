import * as fs from 'fs';
import * as path from 'path';
import DocumentOutlineGenerator from '../src/index';
import { OutlineNode } from '../src/types';

/**
 * Golden-file harness. Each `tests/fixtures/<name>/` holds an `input.<ext>` and
 * an `expected.json`. We run the generator for that extension and assert the
 * output equals the committed golden.
 *
 * The golden is projected down to the fields kg-gen actually consumes, so a
 * passing fixture doubles as a guard on the public `OutlineNode` contract.
 *
 * Regenerate goldens after a reviewed, intentional change:
 *   UPDATE_GOLDEN=1 npm test
 */
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

function project(nodes: OutlineNode[] = []): unknown[] {
  return nodes.map((n) => {
    const out: Record<string, unknown> = { title: n.title, type: n.type, depth: n.depth };
    if (n.line !== undefined) out.line = n.line;
    if (n.metadata && Object.keys(n.metadata).length > 0) out.metadata = n.metadata;
    if (n.children && n.children.length > 0) out.children = project(n.children);
    return out;
  });
}

function fixtureDirs(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

describe('golden-file outline fixtures', () => {
  const gen = new DocumentOutlineGenerator();
  const dirs = fixtureDirs();

  if (dirs.length === 0) {
    it('has fixtures', () => {
      throw new Error(`no fixtures found under ${FIXTURES_DIR}`);
    });
    return;
  }

  for (const dir of dirs) {
    it(`matches golden for ${dir}`, async () => {
      const fixturePath = path.join(FIXTURES_DIR, dir);
      const inputFile = fs.readdirSync(fixturePath).find((f) => f.startsWith('input.'));
      expect(inputFile).toBeDefined();

      const ext = inputFile!.split('.').pop()!;
      const content = fs.readFileSync(path.join(fixturePath, inputFile!), 'utf-8');
      const optionsPath = path.join(fixturePath, 'options.json');
      const options = fs.existsSync(optionsPath)
        ? JSON.parse(fs.readFileSync(optionsPath, 'utf-8'))
        : {};
      const actual = project(await gen.generateFromContent(content, ext, options));

      const goldenPath = path.join(fixturePath, 'expected.json');
      if (UPDATE || !fs.existsSync(goldenPath)) {
        fs.writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + '\n');
      }
      const expected = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
      expect(actual).toEqual(expected);
    });
  }
});
