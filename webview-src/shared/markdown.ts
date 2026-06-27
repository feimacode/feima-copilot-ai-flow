/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FeimaCode. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

// ---------------------------------------------------------------------------
// Lightweight markdown → HTML (bold, italic, code, paragraphs)
// ---------------------------------------------------------------------------

export function markdownToHtml(text: string): string {
	let html = text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	// Bold: **text** or __text__
	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

	// Italic: *text* or _text_
	html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
	html = html.replace(/_(.+?)_/g, '<em>$1</em>');

	// Inline code: `text`
	html = html.replace(/`(.+?)`/g, '<code>$1</code>');

	// Paragraphs: double newline
	html = html.replace(/\n{2,}/g, '</p><p>');
	// Single newline → <br>
	html = html.replace(/\n/g, '<br/>');

	return '<p>' + html + '</p>';
}
