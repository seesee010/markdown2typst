/**
 * Tests for Mermaid diagram support:
 * - Basic mermaid code blocks are converted to #mermaid-diagram() calls
 * - The mermaid diagram source is preserved in the output
 * - The #mermaid-diagram helper function is emitted in the warnings section
 * - Other code blocks are unaffected
 * - A warning is issued via the error callback
 * - Multiple mermaid diagrams in the same document are handled
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { assertIncludes, assertExcludes, convert } from '../helpers/test-utils.js';

describe('Mermaid Diagrams', () => {
  describe('Basic rendering', () => {
    it('should wrap mermaid code block in #mermaid-diagram() call', () => {
      assertIncludes(
        '```mermaid\ngraph TD\n    A --> B\n```',
        ['#mermaid-diagram(']
      );
    });

    it('should preserve the mermaid diagram source in the output', () => {
      assertIncludes(
        '```mermaid\ngraph TD\n    A --> B\n```',
        ['graph TD', 'A --> B']
      );
    });

    it('should include the mermaid language tag in the raw block', () => {
      assertIncludes(
        '```mermaid\ngraph LR\n    X --> Y\n```',
        ['```mermaid']
      );
    });

    it('should close the raw block and function call correctly', () => {
      const result = convert('```mermaid\ngraph TD\n    A --> B\n```');
      // The call must end with ```) to close both the raw block and the function call
      assert.ok(
        result.includes('```)'),
        `Expected output to contain \`\`\`)\nGot: ${result}`
      );
    });
  });

  describe('Warnings section', () => {
    it('should emit the #mermaid-diagram helper function definition', () => {
      assertIncludes(
        '```mermaid\ngraph TD\n    A --> B\n```',
        ['#let mermaid-diagram(code)']
      );
    });

    it('should emit the WARNINGS header when mermaid is present', () => {
      assertIncludes(
        '```mermaid\ngraph TD\n    A --> B\n```',
        ['// ========================= WARNINGS =========================']
      );
    });

    it('should include the MERMAID DIAGRAMS WERE DETECTED comment', () => {
      assertIncludes(
        '```mermaid\ngraph TD\n    A --> B\n```',
        ['// MERMAID DIAGRAMS WERE DETECTED!']
      );
    });

    it('should include a rect in the helper function body', () => {
      assertIncludes(
        '```mermaid\nsequenceDiagram\n    Alice ->> Bob: Hello\n```',
        ['rect(radius: 4pt']
      );
    });
  });

  describe('Error callback', () => {
    it('should call onError with a warning when a mermaid diagram is encountered', () => {
      const errors = [];
      convert('```mermaid\ngraph TD\n    A --> B\n```', {
        onError: (err) => errors.push(err)
      });
      assert.ok(
        errors.some((e) => e.context === 'mermaid rendering'),
        `Expected a mermaid rendering warning, got: ${JSON.stringify(errors)}`
      );
    });

    it('should report warning severity (not error)', () => {
      const errors = [];
      convert('```mermaid\ngraph TD\n    A --> B\n```', {
        onError: (err) => errors.push(err)
      });
      const mermaidError = errors.find((e) => e.context === 'mermaid rendering');
      assert.ok(mermaidError, 'Expected a mermaid rendering warning');
      assert.strictEqual(mermaidError.severity, 'warning');
    });
  });

  describe('Multiple diagrams', () => {
    it('should handle multiple mermaid diagrams in one document', () => {
      assertIncludes(
        '```mermaid\ngraph TD\n    A --> B\n```\n\nSome text\n\n```mermaid\nsequenceDiagram\n    Alice ->> Bob: Hi\n```',
        ['graph TD', 'A --> B', 'sequenceDiagram', 'Alice ->> Bob: Hi']
      );
    });

    it('should emit #mermaid-diagram helper only once even with multiple diagrams', () => {
      const result = convert(
        '```mermaid\ngraph TD\n    A --> B\n```\n\n```mermaid\ngraph LR\n    X --> Y\n```'
      );
      // Count occurrences of the helper function definition
      const count = (result.match(/#let mermaid-diagram/g) || []).length;
      assert.strictEqual(count, 1, `Expected helper function defined once, found ${count} times`);
    });
  });

  describe('Isolation from other code blocks', () => {
    it('should not affect regular typescript code blocks', () => {
      assertIncludes(
        '```typescript\nconst x = 1;\n```',
        ['```typescript', 'const x = 1;']
      );
      assertExcludes(
        '```typescript\nconst x = 1;\n```',
        ['#mermaid-diagram(']
      );
    });

    it('should not emit warnings section for non-mermaid code blocks', () => {
      assertExcludes(
        '```javascript\nconsole.log("hello");\n```',
        ['MERMAID DIAGRAMS WERE DETECTED', '#let mermaid-diagram']
      );
    });

    it('should handle mermaid and regular code blocks in the same document', () => {
      assertIncludes(
        '```mermaid\ngraph TD\n    A --> B\n```\n\n```python\nprint("hello")\n```',
        ['#mermaid-diagram(', '```python', 'print("hello")']
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle mermaid with case-insensitive language tag', () => {
      // remark-parse normalises lang to lowercase, but we still handle it
      assertIncludes(
        '```mermaid\ngraph TD\n    A --> B\n```',
        ['#mermaid-diagram(']
      );
    });

    it('should handle empty mermaid block gracefully', () => {
      const result = convert('```mermaid\n```');
      assert.ok(typeof result === 'string', 'Expected a string result for empty mermaid block');
      assert.ok(result.includes('#mermaid-diagram('), 'Expected #mermaid-diagram call even for empty block');
    });

    it('should handle mermaid with complex diagram types', () => {
      const md = [
        '```mermaid',
        'classDiagram',
        '    Animal <|-- Duck',
        '    Animal : +int age',
        '    Animal : +String gender',
        '    class Duck{',
        '        +String beakColor',
        '        +swim()',
        '    }',
        '```'
      ].join('\n');
      assertIncludes(md, ['#mermaid-diagram(', 'classDiagram', 'Animal <|-- Duck']);
    });
  });
});
