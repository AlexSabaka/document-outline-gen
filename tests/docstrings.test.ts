import { parseDocComment } from '../src/docstrings';

describe('docstring parsers', () => {
  it('parses JSDoc (with and without {type})', () => {
    expect(
      parseDocComment(
        'jsdoc',
        'Adds two numbers.\n@param {number} a the first\n@param b the second\n@returns {number} the sum',
      ),
    ).toEqual({
      summary: 'Adds two numbers.',
      params: [
        { name: 'a', type: 'number', description: 'the first' },
        { name: 'b', description: 'the second' },
      ],
      returns: { type: 'number', description: 'the sum' },
    });
  });

  it('parses Javadoc and strips HTML / {@link}', () => {
    expect(
      parseDocComment('javadoc', 'Does the thing.\n@param name the name <b>bold</b>\n@return a {@link Result}'),
    ).toEqual({
      summary: 'Does the thing.',
      params: [{ name: 'name', description: 'the name bold' }],
      returns: { description: 'a Result' },
    });
  });

  it('parses C# XML doc', () => {
    expect(
      parseDocComment(
        'xmldoc',
        '<summary>Computes area.</summary>\n<param name="r">radius</param>\n<returns>the area</returns>',
      ),
    ).toEqual({
      summary: 'Computes area.',
      params: [{ name: 'r', description: 'radius' }],
      returns: { description: 'the area' },
    });
  });

  it('parses Python Google style', () => {
    expect(
      parseDocComment(
        'pydoc',
        'Greet someone.\n\nArgs:\n    name (str): who to greet\n    times (int): how many\n\nReturns:\n    str: the greeting',
      ),
    ).toEqual({
      summary: 'Greet someone.',
      params: [
        { name: 'name', type: 'str', description: 'who to greet' },
        { name: 'times', type: 'int', description: 'how many' },
      ],
      returns: { type: 'str', description: 'the greeting' },
    });
  });

  it('parses Python Sphinx style', () => {
    expect(
      parseDocComment('pydoc', 'Sphinx style.\n\n:param str name: who\n:returns: the greeting\n:rtype: str'),
    ).toEqual({
      summary: 'Sphinx style.',
      params: [{ name: 'name', type: 'str', description: 'who' }],
      returns: { description: 'the greeting', type: 'str' },
    });
  });

  it('parses Python NumPy style', () => {
    expect(
      parseDocComment(
        'pydoc',
        'NumPy style.\n\nParameters\n----------\nname : str\n    who to greet\n\nReturns\n-------\nstr\n    the greeting',
      ),
    ).toEqual({
      summary: 'NumPy style.',
      params: [{ name: 'name', type: 'str', description: 'who to greet' }],
      returns: { type: 'str', description: 'the greeting' },
    });
  });

  it('returns undefined for empty input', () => {
    expect(parseDocComment('jsdoc', '   ')).toBeUndefined();
  });
});
