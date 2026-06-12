import { TreeSitterGenerator } from './TreeSitterGenerator';

/**
 * C++ outline generator.
 *
 * Structure comes entirely from `queries/cpp/outline.scm` run over the
 * tree-sitter-cpp grammar. Methods are functions captured inside a class/struct;
 * the base class reclassifies them. Richer per-member metadata (parameters,
 * visibility, return types) is deferred to the metadata-depth phase.
 */
export class CppGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'cpp';

  getSupportedExtensions(): string[] {
    return ['cpp'];
  }
}
