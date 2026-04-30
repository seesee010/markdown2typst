/**
 * Block node rendering functions
 * @module block-renderer
 */

import { tex2typst } from 'tex2typst';
import type {
	Content,
	Heading,
	Paragraph,
	List,
	ListItem,
	Code,
	Blockquote,
	Table,
	TableRow,
	TableCell,
	PhrasingContent
} from 'mdast';
import type { MathNode, RenderContext } from './types.js';
import { renderInlines } from './inline-renderer.js';
import { indentLines, isNonEmpty, plainTextFromPhrasing, maxBacktickRun } from './utils.js';
import { ErrorSeverity } from './types.js';

/**
 * Render a block-level MDAST node to Typst markup.
 * Dispatches to appropriate renderer based on node type.
 * 
 * @param node - Block-level content node
 * @param indentLevel - Current indentation level
 * @param context - Rendering context with definitions and footnotes
 * @returns Rendered Typst string or null if node should be skipped
 */
export function renderBlock(
	node: Content,
	indentLevel: number,
	context: RenderContext
): string | null {
	try {
		switch (node.type) {
			case 'yaml':
			case 'definition':
			case 'footnoteDefinition':
				return null;
			case 'heading':
				return renderHeading(node as Heading, indentLevel, context);
			case 'paragraph':
				return indentLines(
					renderParagraph(node as Paragraph, context),
					indentLevel
				);
			case 'list':
				return renderList(node as List, indentLevel, context);
			case 'code':
				return renderCodeBlock(node as Code, indentLevel, context);
			case 'blockquote':
				return renderBlockquote(node as Blockquote, indentLevel, context);
			case 'thematicBreak':
				return indentLines('#line(length: 100%, stroke: 0.6pt)', indentLevel);
			case 'table':
				return renderTable(node as Table, indentLevel, context);
			case 'math':
				return renderMathBlock(node as MathNode, indentLevel, context);
			default:
				if (context.onError) {
					context.onError({
						severity: ErrorSeverity.WARNING,
						message: `Unknown block node type: ${node.type}`,
						context: 'block rendering',
						details: { nodeType: node.type }
					});
				}
				return null;
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (context.onError) {
			context.onError({
				severity: ErrorSeverity.ERROR,
				message: `Error rendering block node: ${errorMessage}`,
				context: 'block rendering',
				originalError: error,
				details: { nodeType: node.type }
			});
		}
		// Return empty string to continue rendering
		return null;
	}
}

/**
 * Render a block-level math equation to Typst.
 * Converts LaTeX math syntax to Typst math using tex2typst.
 * 
 * @param node - Math node
 * @param indentLevel - Current indentation level
 * @param context - Rendering context for error handling
 * @returns Rendered Typst math block
 */
function renderMathBlock(node: MathNode, indentLevel: number, context: RenderContext): string {
	// Convert LaTeX to Typst math syntax
	const value = node.value.trim();
	try {
		const typstMath = tex2typst(value);
		return indentLines(`$ ${typstMath} $`, indentLevel);
	} catch (error) {
		// Fallback: use original LaTeX if conversion fails
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (context.onError) {
			context.onError({
				severity: ErrorSeverity.WARNING,
				message: `Failed to convert block math LaTeX to Typst: ${errorMessage}`,
				context: 'block math rendering',
				originalError: error,
				details: { latex: value }
			});
		}
		return indentLines(`$ ${value} $`, indentLevel);
	}
}

/**
 * Render a heading to Typst markup.
 * Converts Markdown heading syntax (# ## ###) to Typst (= == ===).
 * 
 * @param node - Heading node
 * @param indentLevel - Current indentation level
 * @param context - Rendering context with definitions and footnotes
 * @returns Rendered Typst heading
 */
function renderHeading(
	node: Heading,
	indentLevel: number,
	context: RenderContext
): string {
	const level = Math.min(Math.max(node.depth, 1), 6);
	return indentLines(
		`${'='.repeat(level)} ${renderInlines(node.children, context)}`,
		indentLevel
	);
}

/**
 * Render a paragraph to Typst.
 * Handles special cases like [toc] for table of contents.
 * 
 * @param node - Paragraph node
 * @param context - Rendering context with definitions and footnotes
 * @returns Rendered Typst paragraph
 */
function renderParagraph(
	node: Paragraph,
	context: RenderContext
): string {
	// Check for [toc]
	const text = plainTextFromPhrasing(node.children, context.definitions).trim().toLowerCase();
	if (text === '[toc]') {
		return `#outline(title: auto, indent: auto)`;
	}
	return renderInlines(node.children, context);
}

/**
 * Render a list to Typst markup.
 * 
 * @param node - List node
 * @param indentLevel - Current indentation level
 * @param context - Rendering context with definitions and footnotes
 * @returns Rendered Typst list
 */
function renderList(
	node: List,
	indentLevel: number,
	context: RenderContext
): string {
	const marker = node.ordered ? '+' : '-';
	return node.children
		.map((item) => renderListItem(item, marker, indentLevel, context))
		.filter(isNonEmpty)
		.join('\n');
}

/**
 * Render a list item to Typst markup.
 * 
 * @param node - ListItem node
 * @param marker - List marker ('+' for ordered, '-' for unordered)
 * @param indentLevel - Current indentation level
 * @param context - Rendering context with definitions and footnotes
 * @returns Rendered Typst list item
 */
function renderListItem(
	node: ListItem,
	marker: string,
	indentLevel: number,
	context: RenderContext
): string {
	const baseIndent = '  '.repeat(indentLevel);
	const nestedIndentLevel = indentLevel + 1;

	const first = node.children[0];
	const lines: string[] = [];

	if (first?.type === 'paragraph') {
		lines.push(
			`${baseIndent}${marker} ${renderParagraph(first as Paragraph, context)}`
		);
		for (const child of node.children.slice(1)) {
			if (child.type === 'list') {
				lines.push(renderList(child as List, nestedIndentLevel, context));
				continue;
			}
			const rendered = renderBlock(child as Content, nestedIndentLevel, context);
			if (rendered) lines.push(rendered);
		}
		return lines.join('\n');
	}

	lines.push(`${baseIndent}${marker}`);
	for (const child of node.children) {
		if (child.type === 'list') {
			lines.push(renderList(child as List, nestedIndentLevel, context));
			continue;
		}
		const rendered = renderBlock(child as Content, nestedIndentLevel, context);
		if (rendered) lines.push(rendered);
	}
	return lines.join('\n');
}

/**
 * Render a code block to Typst markup.
 * Detects mermaid diagrams and routes them to the mermaid renderer.
 *
 * @param node - Code node
 * @param indentLevel - Current indentation level
 * @param context - Rendering context for mermaid warning tracking
 * @returns Rendered Typst code block
 */
function renderCodeBlock(node: Code, indentLevel: number, context: RenderContext): string {
	const info = node.lang?.trim() ? node.lang.trim() : '';

	if (info.toLowerCase() === 'mermaid') {
		return renderMermaidDiagram(node, indentLevel, context);
	}

	const value = node.value.replace(/\n$/, '');
	const fence = '`'.repeat(Math.max(3, maxBacktickRun(value) + 1));
	const open = info ? `${fence}${info}` : fence;
	const indentedCode = indentLines(value, indentLevel);
	return [indentLines(open, indentLevel), indentedCode, indentLines(fence, indentLevel)].join('\n');
}

/**
 * Render a mermaid diagram code block to a Typst #mermaid-diagram() call.
 * The diagram source is preserved as a raw Typst block passed to the helper function.
 * Sets warnings.mermaidDiagrams so the output-builder emits the helper function definition.
 *
 * @param node - Code node with lang "mermaid"
 * @param indentLevel - Current indentation level
 * @param context - Rendering context (mutated: warnings.mermaidDiagrams = true)
 * @returns Rendered Typst mermaid-diagram call
 */
function renderMermaidDiagram(node: Code, indentLevel: number, context: RenderContext): string {
	context.warnings.mermaidDiagrams = true;

	if (context.onError) {
		context.onError({
			severity: ErrorSeverity.WARNING,
			message: 'Mermaid diagram detected. Native rendering is not available in Typst; the diagram source is preserved using the #mermaid-diagram() helper.',
			context: 'mermaid rendering',
			details: { diagramSource: node.value }
		});
	}

	const value = node.value.replace(/\n$/, '');
	const fence = '`'.repeat(Math.max(3, maxBacktickRun(value) + 1));
	const lines = [
		`#mermaid-diagram(${fence}mermaid`,
		value,
		`${fence})`
	];
	return indentLines(lines.join('\n'), indentLevel);
}

/**
 * Render a table to Typst markup.
 * 
 * @param node - Table node
 * @param indentLevel - Current indentation level
 * @param context - Rendering context with definitions and footnotes
 * @returns Rendered Typst table
 */
function renderTable(
	node: Table,
	indentLevel: number,
	context: RenderContext
): string {
	try {
		const rows = node.children as TableRow[];
		if (rows.length === 0) {
			if (context.onError) {
				context.onError({
					severity: ErrorSeverity.WARNING,
					message: 'Empty table found (no rows)',
					context: 'table rendering'
				});
			}
			return '';
		}

		// Get column count from first row
		const headerRow = rows[0];
		const colCount = headerRow.children.length;

		if (colCount === 0) {
			if (context.onError) {
				context.onError({
					severity: ErrorSeverity.WARNING,
					message: 'Table has no columns',
					context: 'table rendering'
				});
			}
			return '';
		}

		// Get alignment from node.align
		const alignMap: Record<string, string> = {
			left: 'left',
			right: 'right',
			center: 'center'
		};
		const aligns = (node.align ?? []).map((a) => alignMap[a ?? 'left'] ?? 'left');

		// Build column specification
		const columns = Array(colCount).fill('1fr').join(', ');

		// Build table content
		const headerCells: string[] = [];
		for (const cell of headerRow.children as TableCell[]) {
			const content = renderInlines(cell.children, context);
			headerCells.push(`[*${content}*]`);
		}

		const dataCells: string[] = [];
		for (let i = 1; i < rows.length; i++) {
			const row = rows[i];
			for (const cell of row.children as TableCell[]) {
				const content = renderInlines(cell.children, context);
				dataCells.push(`[${content}]`);
			}
		}

		// Build align argument
		const alignArgs = aligns.slice(0, colCount).map((a) => a).join(', ');

		const lines = [
			`#table(`,
			`  columns: (${columns}),`,
			`  align: (${alignArgs}),`,
			`  table.header(${headerCells.join(', ')}),`,
			`  ${dataCells.join(', ')}`,
			`)`
		];

		return indentLines(lines.join('\n'), indentLevel);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (context.onError) {
			context.onError({
				severity: ErrorSeverity.ERROR,
				message: `Error rendering table: ${errorMessage}`,
				context: 'table rendering',
				originalError: error
			});
		}
		return '';
	}
}

// ─── GitHub-style callout support ────────────────────────────────────────────

/** Visual configuration for each GitHub callout type */
const CALLOUT_CONFIGS = {
	NOTE:      { label: 'Note',      fill: '#ddf4ff', stroke: '#0969da' },
	TIP:       { label: 'Tip',       fill: '#dafbe1', stroke: '#1a7f37' },
	IMPORTANT: { label: 'Important', fill: '#fbefff', stroke: '#8250df' },
	WARNING:   { label: 'Warning',   fill: '#fff8c5', stroke: '#9a6700' },
	CAUTION:   { label: 'Caution',   fill: '#ffebe9', stroke: '#cf222e' },
} as const;

type CalloutType = keyof typeof CALLOUT_CONFIGS;

const CALLOUT_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;

/**
 * Detect whether a blockquote is a GitHub-style callout.
 * Returns the callout type if the first paragraph starts with [!TYPE], null otherwise.
 */
function detectCallout(node: Blockquote): CalloutType | null {
	if (node.children.length === 0) return null;
	const firstChild = node.children[0];
	if (firstChild.type !== 'paragraph') return null;

	// Use plain text so detection works regardless of internal AST structure
	const plainText = plainTextFromPhrasing(
		(firstChild as Paragraph).children,
		new Map()
	).trimStart();

	const match = CALLOUT_PATTERN.exec(plainText);
	if (!match) return null;
	return match[1].toUpperCase() as CalloutType;
}

/**
 * Render the inline content of the first callout paragraph, stripping the [!TYPE] marker.
 * Handles the case where the marker and the content share a single text node
 * (soft line break) or are split across the first text node and subsequent nodes.
 */
function renderCalloutFirstParagraphBody(
	children: PhrasingContent[],
	type: CalloutType,
	context: RenderContext
): string {
	if (children.length === 0) return '';

	const first = children[0];

	// The marker is always at the start of the first text node
	if (first.type === 'text') {
		const raw = (first as { type: 'text'; value: string }).value;
		const markerMatch = new RegExp(`^\\[!${type}\\]`, 'i').exec(raw);
		if (markerMatch) {
			const afterMarker = raw.slice(markerMatch[0].length).replace(/^[\n\r]+/, '');
			let rest: PhrasingContent[] = afterMarker
				? [{ ...first, type: 'text', value: afterMarker } as PhrasingContent, ...children.slice(1)]
				: children.slice(1);
			// Drop a leading hard-break node if present
			if (rest.length > 0 && rest[0].type === 'break') rest = rest.slice(1);
			return rest.length > 0 ? renderInlines(rest, context) : '';
		}
	}

	// Fallback: render all children (shouldn't happen in practice)
	return renderInlines(children, context);
}

/**
 * Render a GitHub-style callout as a styled Typst block.
 * Produces a coloured rect with a bold label and the callout body.
 */
function renderCallout(
	node: Blockquote,
	type: CalloutType,
	indentLevel: number,
	context: RenderContext
): string {
	const cfg = CALLOUT_CONFIGS[type];

	// Collect body parts: inline remainder of the first paragraph + remaining block children
	const bodyParts: string[] = [];

	const firstParagraphBody = renderCalloutFirstParagraphBody(
		(node.children[0] as Paragraph).children,
		type,
		context
	);
	if (firstParagraphBody.trim()) bodyParts.push(firstParagraphBody);

	for (const child of node.children.slice(1)) {
		const rendered = renderBlock(child as Content, 0, context);
		if (rendered) bodyParts.push(rendered);
	}

	const body = bodyParts.join('\n\n');

	const lines: string[] = [
		`#block(`,
		`  fill: rgb("${cfg.fill}"),`,
		`  stroke: (left: 2pt + rgb("${cfg.stroke}")),`,
		`  radius: 4pt,`,
		`  width: 100%,`,
		`  inset: (left: 12pt, right: 12pt, top: 10pt, bottom: 10pt),`,
		`)[`,
		`  #text(weight: "bold", fill: rgb("${cfg.stroke}"))[${cfg.label}]`,
	];

	if (body.trim()) {
		lines.push('');
		for (const bodyLine of body.split('\n')) {
			lines.push(`  ${bodyLine}`);
		}
	}

	lines.push(`]`);

	return indentLines(lines.join('\n'), indentLevel);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a blockquote to Typst markup.
 *
 * @param node - Blockquote node
 * @param indentLevel - Current indentation level
 * @param context - Rendering context with definitions and footnotes
 * @returns Rendered Typst blockquote
 */
function renderBlockquote(
	node: Blockquote,
	indentLevel: number,
	context: RenderContext
): string {
	// GitHub-style callout takes precedence over regular blockquote rendering
	const calloutType = detectCallout(node);
	if (calloutType) {
		return renderCallout(node, calloutType, indentLevel, context);
	}

	const body = node.children
		.map((child) => renderBlock(child, 0, context))
		.filter(isNonEmpty)
		.join('\n\n');

	const open = indentLines('#quote[', indentLevel);
	if (!body.trim()) return `${open}\n${indentLines(']', indentLevel)}`;

	return [open, indentLines(body, indentLevel + 1), indentLines(']', indentLevel)].join('\n');
}
