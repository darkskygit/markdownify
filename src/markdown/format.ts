import puppeteer, { HTTPResponse } from '@cloudflare/puppeteer';
import { Readability } from '@mozilla/readability';
import { AgentMarkdown } from 'agentmarkdown';
import { parseHTML } from 'linkedom';

class TextHandler {
	private content = '';

	text(text: Text) {
		this.content += text.text;
	}

	getContent() {
		return this.content;
	}
}

export async function htmlToMarkdown(url: URL, page: puppeteer.Page, response: HTTPResponse) {
	let title = '';
	const textHandler = new TextHandler();
	const rawHtml: string = await Promise.race([
		page.evaluate('giveSnapshot()').then((s: any) => {
			title = s?.parsed?.title || s?.title;
			return s?.parsed?.content || s?.html;
		}),
		response.text(),
	]);
	const html = await new HTMLRewriter()
		.on('title', {
			text(text) {
				if (!title) title = text.text;
			},
		})
		.onDocument(textHandler)
		.transform(new Response(rawHtml))
		.text();

	const markdown = await stringToMarkdown(html);
	if (markdown) return formattedMarkdown(title, url, markdown);

	const reader = new Readability(parseHTML(html).document, { charThreshold: 2000 });
	const article = reader.parse();
	if (article) {
		const parsed = await stringToMarkdown(reader.parse()?.content);
		if (parsed) return formattedMarkdown(title, url, parsed);
		return formattedMarkdown(title, url, article.textContent);
	}

	return tidyMarkdown(textHandler.getContent()).trim();
}

function formattedMarkdown(title: string, url: URL, content: string) {
	return {
		title: (title || '').trim(),
		url: url.href.trim(),
		content,
		toString() {
			return `Title: ${this.title}\nURL Source: ${this.url}\nMarkdown Content:\n${this.content}`;
		},
	};
}

async function stringToMarkdown(html?: string) {
	if (!html) return;
	const markdownOutput = await AgentMarkdown.render({ html });
	const markdown = markdownOutput.markdown.trim();
	if (markdown && !(markdown.startsWith('<') && markdown.endsWith('>'))) {
		return tidyMarkdown(markdown).trim();
	}
	return;
}

function tidyMarkdown(markdown: string): string {
	// Step 1: Handle complex broken links with text and optional images spread across multiple lines
	let normalizedMarkdown = markdown.replace(/\[\s*([^]+?)\s*\]\s*\(\s*([^)]+)\s*\)/g, (match, text, url) => {
		// Remove internal new lines and excessive spaces within the text
		text = text.replace(/\s+/g, ' ').trim();
		url = url.replace(/\s+/g, '').trim();
		return `[${text}](${url})`;
	});

	normalizedMarkdown = normalizedMarkdown.replace(
		/\[\s*([^!]*?)\s*\n*(?:!\[([^\]]*)\]\((.*?)\))?\s*\n*\]\s*\(\s*([^)]+)\s*\)/g,
		(match, text, alt, imgUrl, linkUrl) => {
			// Normalize by removing excessive spaces and new lines
			text = text.replace(/\s+/g, ' ').trim();
			alt = alt ? alt.replace(/\s+/g, ' ').trim() : '';
			imgUrl = imgUrl ? imgUrl.replace(/\s+/g, '').trim() : '';
			linkUrl = linkUrl.replace(/\s+/g, '').trim();
			if (imgUrl) {
				return `[${text} ![${alt}](${imgUrl})](${linkUrl})`;
			} else {
				return `[${text}](${linkUrl})`;
			}
		},
	);

	// Step 2: Normalize regular links that may be broken across lines
	normalizedMarkdown = normalizedMarkdown.replace(/\[\s*([^\]]+)\]\s*\(\s*([^)]+)\)/g, (match, text, url) => {
		text = text.replace(/\s+/g, ' ').trim();
		url = url.replace(/\s+/g, '').trim();
		return `[${text}](${url})`;
	});

	// Step 3: Replace more than two consecutive empty lines with exactly two empty lines
	normalizedMarkdown = normalizedMarkdown.replace(/\n{3,}/g, '\n\n');

	// Step 4: Remove leading spaces from each line
	normalizedMarkdown = normalizedMarkdown.replace(/^[ \t]+/gm, '');

	return normalizedMarkdown.trim();
}
