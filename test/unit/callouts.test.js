/**
 * Tests for GitHub-style callout support.
 *
 * GitHub supports five callout types that render as coloured boxes:
 *   [!NOTE]      – blue
 *   [!TIP]       – green
 *   [!IMPORTANT] – purple
 *   [!WARNING]   – yellow
 *   [!CAUTION]   – red
 *
 * They are written as blockquotes whose first line is exactly [!TYPE].
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { assertIncludes, assertExcludes, convert } from '../helpers/test-utils.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a single-line callout markdown string */
const callout = (type, content) =>
  `> [!${type}]\n> ${content}`;

// ─── All five callout types ───────────────────────────────────────────────────

describe('GitHub Callouts', () => {
  describe('NOTE callout', () => {
    it('outputs a #block with the NOTE fill colour', () => {
      assertIncludes(callout('NOTE', 'Some info.'), ['fill: rgb("#ddf4ff")']);
    });

    it('outputs a #block with the NOTE stroke colour', () => {
      assertIncludes(callout('NOTE', 'Some info.'), ['stroke: (left: 2pt + rgb("#0969da"))']);
    });

    it('outputs bold NOTE label', () => {
      assertIncludes(callout('NOTE', 'Some info.'), [
        '#text(weight: "bold", fill: rgb("#0969da"))[Note]',
      ]);
    });

    it('preserves the callout body text', () => {
      assertIncludes(callout('NOTE', 'Some info.'), ['Some info.']);
    });

    it('does NOT use #quote for a callout', () => {
      assertExcludes(callout('NOTE', 'Some info.'), ['#quote[']);
    });
  });

  describe('TIP callout', () => {
    it('outputs a #block with TIP fill and stroke colours', () => {
      assertIncludes(callout('TIP', 'A helpful tip.'), [
        'fill: rgb("#dafbe1")',
        'stroke: (left: 2pt + rgb("#1a7f37"))',
      ]);
    });

    it('outputs bold TIP label', () => {
      assertIncludes(callout('TIP', 'A helpful tip.'), [
        '#text(weight: "bold", fill: rgb("#1a7f37"))[Tip]',
      ]);
    });

    it('preserves TIP body', () => {
      assertIncludes(callout('TIP', 'A helpful tip.'), ['A helpful tip.']);
    });
  });

  describe('IMPORTANT callout', () => {
    it('outputs a #block with IMPORTANT fill and stroke colours', () => {
      assertIncludes(callout('IMPORTANT', 'Very important!'), [
        'fill: rgb("#fbefff")',
        'stroke: (left: 2pt + rgb("#8250df"))',
      ]);
    });

    it('outputs bold IMPORTANT label', () => {
      assertIncludes(callout('IMPORTANT', 'Very important!'), [
        '#text(weight: "bold", fill: rgb("#8250df"))[Important]',
      ]);
    });

    it('preserves IMPORTANT body', () => {
      assertIncludes(callout('IMPORTANT', 'Very important!'), ['Very important!']);
    });
  });

  describe('WARNING callout', () => {
    it('outputs a #block with WARNING fill and stroke colours', () => {
      assertIncludes(callout('WARNING', 'Caution ahead.'), [
        'fill: rgb("#fff8c5")',
        'stroke: (left: 2pt + rgb("#9a6700"))',
      ]);
    });

    it('outputs bold WARNING label', () => {
      assertIncludes(callout('WARNING', 'Caution ahead.'), [
        '#text(weight: "bold", fill: rgb("#9a6700"))[Warning]',
      ]);
    });

    it('preserves WARNING body', () => {
      assertIncludes(callout('WARNING', 'Caution ahead.'), ['Caution ahead.']);
    });
  });

  describe('CAUTION callout', () => {
    it('outputs a #block with CAUTION fill and stroke colours', () => {
      assertIncludes(callout('CAUTION', 'Stop right there!'), [
        'fill: rgb("#ffebe9")',
        'stroke: (left: 2pt + rgb("#cf222e"))',
      ]);
    });

    it('outputs bold CAUTION label', () => {
      assertIncludes(callout('CAUTION', 'Stop right there!'), [
        '#text(weight: "bold", fill: rgb("#cf222e"))[Caution]',
      ]);
    });

    it('preserves CAUTION body', () => {
      assertIncludes(callout('CAUTION', 'Stop right there!'), ['Stop right there!']);
    });
  });

  // ─── Common block structure ──────────────────────────────────────────────────

  describe('Block structure', () => {
    it('wraps content in #block()', () => {
      assertIncludes(callout('NOTE', 'Hi'), ['#block(']);
    });

    it('includes radius: 4pt', () => {
      assertIncludes(callout('NOTE', 'Hi'), ['radius: 4pt']);
    });

    it('includes width: 100%', () => {
      assertIncludes(callout('NOTE', 'Hi'), ['width: 100%']);
    });

    it('includes inset with left/right/top/bottom', () => {
      assertIncludes(callout('NOTE', 'Hi'), [
        'inset: (left: 12pt, right: 12pt, top: 10pt, bottom: 10pt)',
      ]);
    });

    it('closes the block with ]', () => {
      const result = convert(callout('NOTE', 'Hi'));
      assert.ok(result.trimEnd().endsWith(']'), `Expected output to end with ]\nGot:\n${result}`);
    });
  });

  // ─── Case insensitivity ──────────────────────────────────────────────────────

  describe('Case-insensitive type matching', () => {
    it('recognises lowercase [!note]', () => {
      assertIncludes('> [!note]\n> body', ['#block(', 'fill: rgb("#ddf4ff")']);
    });

    it('recognises mixed case [!Warning]', () => {
      assertIncludes('> [!Warning]\n> body', ['#block(', 'fill: rgb("#fff8c5")']);
    });

    it('recognises [!TiP]', () => {
      assertIncludes('> [!TiP]\n> body', ['#block(', 'fill: rgb("#dafbe1")']);
    });
  });

  // ─── Body content ────────────────────────────────────────────────────────────

  describe('Body content rendering', () => {
    it('renders bold formatting inside callout body', () => {
      assertIncludes(callout('TIP', '**bold text**'), ['*bold text*']);
    });

    it('renders inline code inside callout body', () => {
      assertIncludes(callout('NOTE', 'Use `code` here'), ['`code`']);
    });

    it('renders italic formatting inside callout body', () => {
      assertIncludes(callout('IMPORTANT', '*italic text*'), ['_italic text_']);
    });

    it('handles multi-paragraph callout (blank line between paragraphs)', () => {
      const md = '> [!NOTE]\n> First line\n>\n> Second paragraph.';
      assertIncludes(md, ['First line', 'Second paragraph.']);
    });

    it('handles marker-only callout (no body text) without crashing', () => {
      const result = convert('> [!NOTE]');
      assert.ok(typeof result === 'string', 'Expected string output for marker-only callout');
      assert.ok(result.includes('#block('), 'Expected #block( in output');
      assert.ok(result.includes('[Note]'), 'Expected [Note] label in output');
    });
  });

  // ─── Regular blockquotes are unaffected ──────────────────────────────────────

  describe('Regular blockquotes still work', () => {
    it('renders a plain blockquote as #quote[...]', () => {
      assertIncludes('> This is a regular quote.', ['#quote[', 'This is a regular quote.']);
    });

    it('does NOT render a plain blockquote as #block()', () => {
      assertExcludes('> This is a regular quote.', ['#block(']);
    });

    it('renders a nested blockquote correctly', () => {
      assertIncludes('> Outer\n>> Inner', ['#quote[']);
    });

    it('unknown type like [!FOO] is treated as a plain blockquote', () => {
      assertIncludes('> [!FOO]\n> body', ['#quote[']);
      assertExcludes('> [!FOO]\n> body', ['#block(']);
    });
  });

  // ─── Callout + other elements in same document ───────────────────────────────

  describe('Callouts alongside other Markdown elements', () => {
    it('callout followed by a paragraph', () => {
      assertIncludes(
        `${callout('NOTE', 'Note body.')}\n\nRegular paragraph.`,
        ['#block(', 'Note body.', 'Regular paragraph.']
      );
    });

    it('callout preceded by a heading', () => {
      assertIncludes(
        `# Section\n\n${callout('WARNING', 'Watch out!')}`,
        ['= Section', '#block(', 'Watch out!']
      );
    });

    it('multiple different callouts in one document', () => {
      const md = [
        callout('NOTE', 'Note body.'),
        '',
        callout('WARNING', 'Warning body.'),
      ].join('\n');
      assertIncludes(md, [
        'fill: rgb("#ddf4ff")',   // NOTE blue
        'fill: rgb("#fff8c5")',   // WARNING yellow
        'Note body.',
        'Warning body.',
      ]);
    });

    it('regular quote and callout in same document', () => {
      const md = '> Regular quote.\n\n> [!TIP]\n> Tip body.';
      assertIncludes(md, ['#quote[', 'Regular quote.', '#block(', 'Tip body.']);
    });
  });
});
