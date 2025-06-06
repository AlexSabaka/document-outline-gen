import DocumentOutlineGenerator from '../src/index';
import { OutlineNode } from '../src/types';

describe('DocumentOutlineGenerator', () => {
  let generator: DocumentOutlineGenerator;

  beforeEach(() => {
    generator = new DocumentOutlineGenerator();
  });

  describe('Markdown Generation', () => {
    it('should generate outline from markdown headings', async () => {
      const content = `# Main Title
Some content here.

## Section 1
Content for section 1.

### Subsection 1.1
More content.

## Section 2
Content for section 2.`;

      const result = await generator.generateFromContent(content, 'md');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'Main Title',
        type: 'heading',
        depth: 1
      });
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children![0]).toMatchObject({
        title: 'Section 1',
        type: 'heading',
        depth: 2
      });
      expect(result[0].children![0].children).toHaveLength(1);
      expect(result[0].children![0].children![0]).toMatchObject({
        title: 'Subsection 1.1',
        type: 'heading',
        depth: 3
      });
    });

    it('should handle frontmatter', async () => {
      const content = `---
title: Test Document
author: John Doe
---

# Introduction
Content here.`;

      const result = await generator.generateFromContent(content, 'md');
      
      expect(result[0].metadata?.frontmatter).toEqual({
        title: 'Test Document',
        author: 'John Doe'
      });
    });
  });

  describe('JSON Generation', () => {
    it('should generate schema from JSON object', async () => {
      const content = `{
  "name": "John",
  "age": 30,
  "address": {
    "street": "123 Main St",
    "city": "Anytown"
  },
  "hobbies": ["reading", "swimming"]
}`;

      const result = await generator.generateFromContent(content, 'json');
      
      expect(result).toHaveLength(4); // name, age, address, hobbies
      
      const addressNode = result.find(node => node.title === 'address');
      expect(addressNode).toBeDefined();
      expect(addressNode!.children).toHaveLength(2); // street, city
      
      const hobbiesNode = result.find(node => node.title === 'hobbies');
      expect(hobbiesNode).toBeDefined();
      expect(hobbiesNode!.metadata?.dataType).toBe('array');
    });
  });

  describe('TypeScript Generation', () => {
    it('should extract classes and methods', async () => {
      const content = `
class Calculator {
  private value: number = 0;
  
  constructor(initialValue: number = 0) {
    this.value = initialValue;
  }
  
  add(x: number): number {
    this.value += x;
    return this.value;
  }
  
  static create(): Calculator {
    return new Calculator();
  }
}

function helper(x: number): void {
  console.log(x);
}`;

      const result = await generator.generateFromContent(content, 'ts');
      
      const calculatorClass = result.find(node => node.title === 'Calculator');
      expect(calculatorClass).toBeDefined();
      expect(calculatorClass!.type).toBe('class');
      expect(calculatorClass!.children).toHaveLength(3); // constructor, add, create (static methods are included)
      
      const helperFunction = result.find(node => node.title === 'helper');
      expect(helperFunction).toBeDefined();
      expect(helperFunction!.type).toBe('function');
    });
  });

  describe('HTML Generation', () => {
    it('should extract headings and semantic elements', async () => {
      const content = `<!DOCTYPE html>
<html>
<body>
  <header>
    <h1>Main Title</h1>
  </header>
  <main>
    <section id="intro">
      <h2>Introduction</h2>
      <p>Some content</p>
    </section>
    <article>
      <h2>Article Title</h2>
      <h3>Subsection</h3>
    </article>
  </main>
</body>
</html>`;

      const result = await generator.generateFromContent(content, 'html');
      
      const mainTitle = result.find(node => node.title === 'Main Title');
      expect(mainTitle).toBeDefined();
      expect(mainTitle!.type).toBe('heading');
      
      const introSection = result.find(node => node.title === 'intro');
      expect(introSection).toBeDefined();
      expect(introSection!.type).toBe('section');
    });
  });

  describe('Python Generation', () => {
    it('should extract classes, methods, and functions', async () => {
      const content = `
class Person:
    """A simple person class."""
    
    def __init__(self, name: str, age: int):
        self.name = name
        self._age = age
    
    def get_name(self) -> str:
        """Get the person's name."""
        return self.name
    
    def _get_age(self) -> int:
        return self._age

def greet(person: Person) -> None:
    """Greet a person."""
    print(f"Hello, {person.get_name()}!")`;

      const result = await generator.generateFromContent(content, 'py');
      
      const personClass = result.find(node => node.title === 'Person');
      expect(personClass).toBeDefined();
      expect(personClass!.type).toBe('class');
      expect(personClass!.children).toHaveLength(3); // __init__, get_name, _get_age
      
      const greetFunction = result.find(node => node.title === 'greet');
      expect(greetFunction).toBeDefined();
      expect(greetFunction!.type).toBe('function');
    });
  });

  describe('Options', () => {
    it('should respect maxDepth option', async () => {
      const content = `# Level 1
## Level 2
### Level 3
#### Level 4`;

      const result = await generator.generateFromContent(content, 'md', { maxDepth: 2 });
      
      // Should only include levels 1 and 2
      expect(result[0].children![0].children).toBeUndefined();
    });

    it('should include line numbers when requested', async () => {
      const content = `# Heading 1
## Heading 2`;

      const result = await generator.generateFromContent(content, 'md', { includeLineNumbers: true });
      
      expect(result[0].line).toBe(1);
      expect(result[0].children![0].line).toBe(2);
    });
  });

  describe('Custom Generators', () => {
    it('should allow registering custom generators', async () => {
      const customGenerator = {
        generate: jest.fn().mockResolvedValue([
          { title: 'Custom', type: 'custom', depth: 1, children: [] }
        ]),
        getSupportedExtensions: () => ['custom']
      };

      generator.registerGenerator('custom', customGenerator as any);
      
      const result = await generator.generateFromContent('test', 'custom');
      
      expect(customGenerator.generate).toHaveBeenCalledWith('test', {});
      expect(result[0].title).toBe('Custom');
    });
  });

  describe('Utility Methods', () => {
    it('should return supported extensions', () => {
      const extensions = generator.getSupportedExtensions();
      expect(extensions).toContain('md');
      expect(extensions).toContain('json');
      expect(extensions).toContain('ts');
      expect(extensions).toContain('py');
    });

    it('should check if extension is supported', () => {
      expect(generator.isSupported('md')).toBe(true);
      expect(generator.isSupported('unknown')).toBe(false);
    });

    it('should throw error for unsupported extensions', async () => {
      await expect(
        generator.generateFromContent('content', 'unsupported')
      ).rejects.toThrow('No generator found for file extension: unsupported');
    });
  });
});

// Example test data
export const testData = {
  markdown: `# Main Title

## Section 1
Content here.

### Subsection 1.1
More content.

## Section 2
Another section.`,

  json: `{
  "users": [
    {
      "id": 1,
      "name": "John",
      "profile": {
        "email": "john@example.com",
        "settings": {
          "theme": "dark",
          "notifications": true
        }
      }
    }
  ],
  "config": {
    "version": "1.0.0",
    "features": ["auth", "api"]
  }
}`,

  typescript: `interface User {
  id: number;
  name: string;
}

class UserService {
  private users: User[] = [];
  
  constructor() {}
  
  async getUser(id: number): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }
  
  static getInstance(): UserService {
    return new UserService();
  }
}

export function createUser(name: string): User {
  return {
    id: Math.random(),
    name
  };
}`,

  python: `from typing import List, Optional

class DatabaseConnection:
    """Database connection manager."""
    
    def __init__(self, host: str, port: int = 5432):
        self.host = host
        self.port = port
        self._connection = None
    
    def connect(self) -> bool:
        """Establish database connection."""
        # Implementation here
        return True
    
    def disconnect(self) -> None:
        """Close database connection."""
        pass
    
    @property
    def is_connected(self) -> bool:
        return self._connection is not None

def get_user_by_id(user_id: int) -> Optional[dict]:
    """Retrieve user by ID."""
    # Implementation here
    return None`
};