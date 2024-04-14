import puppeteer, { HTTPResponse } from '@cloudflare/puppeteer'
import { Readability } from '@mozilla/readability'
import { AgentMarkdown } from 'agentmarkdown'
import type { IRequest } from 'itty-router'
import { parseHTML } from 'linkedom'

import type { Env } from './types'
import { fixUrl, log } from './utils'

function pruneQuery(query: string[] | string | undefined) {
	return Array.isArray(query) ? query[0] : query || ''
}

export async function handlePageMarkdown(request: IRequest, env: Env) {
	const url = fixUrl(pruneQuery(request.query.url))
	if (!url) return new Response('Invalid URL', { status: 400 })
	url.hash = ''

	const browser = await getBrowser(env.BROWSER)

	// Do your work here
	let markdown
	try {
		console.log(`Navigating to ${url}`)
		const page = await browser.newPage()
		page.setViewport({ width: 1920, height: 1080 })
		console.log(`Navigating to ${url.toString().toLowerCase()}`)
		const response = await page.goto(url.toString().toLowerCase(), { timeout: 10_000 })
		console.log(`Response status: ${response?.status()}`)
		markdown = await htmlToMarkdown(url, response!)
	} finally {
		// All work done, so free connection (IMPORTANT!)
		await browser.disconnect()
	}

	return new Response(markdown.toString(), {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
		},
	})
}

class TextHandler {
	private content = ''

	text(text: Text) {
		this.content += text.text
	}

	getContent() {
		return this.content
	}
}

async function htmlToMarkdown(url: URL, response: HTTPResponse) {
	let title = ''
	const textHandler = new TextHandler()
	const html = await new HTMLRewriter()
		.on('title', {
			text(text) {
				if (!title) title = text.text
			},
		})
		.onDocument(textHandler)
		.transform(new Response(await response.buffer()))
		.text()

	const markdown = await stringToMarkdown(html)
	if (markdown) return formattedMarkdown(title, url, markdown)

	const reader = new Readability(parseHTML(html).document, { charThreshold: 2000 })
	const article = reader.parse()
	if (article) {
		const parsed = await stringToMarkdown(reader.parse()?.content)
		if (parsed) return formattedMarkdown(title, url, parsed)
		return formattedMarkdown(title, url, article.textContent)
	}

	return tidyMarkdown(textHandler.getContent()).trim()
}

function formattedMarkdown(title: string, url: URL, content: string) {
	return {
		title: (title || '').trim(),
		url: url.href.trim(),
		content,
		toString() {
			return `Title: ${this.title}\nURL Source: ${this.url}\nMarkdown Content:\n${this.content}`
		},
	}
}

async function stringToMarkdown(html?: string) {
	if (!html) return
	const markdownOutput = await AgentMarkdown.render({ html })
	const markdown = markdownOutput.markdown.trim()
	if (markdown && !(markdown.startsWith('<') && markdown.endsWith('>'))) {
		return tidyMarkdown(markdown).trim()
	}
	return
}

function tidyMarkdown(markdown: string): string {
	// Step 1: Handle complex broken links with text and optional images spread across multiple lines
	let normalizedMarkdown = markdown.replace(/\[\s*([^]+?)\s*\]\s*\(\s*([^)]+)\s*\)/g, (match, text, url) => {
		// Remove internal new lines and excessive spaces within the text
		text = text.replace(/\s+/g, ' ').trim()
		url = url.replace(/\s+/g, '').trim()
		return `[${text}](${url})`
	})

	normalizedMarkdown = normalizedMarkdown.replace(
		/\[\s*([^!]*?)\s*\n*(?:!\[([^\]]*)\]\((.*?)\))?\s*\n*\]\s*\(\s*([^)]+)\s*\)/g,
		(match, text, alt, imgUrl, linkUrl) => {
			// Normalize by removing excessive spaces and new lines
			text = text.replace(/\s+/g, ' ').trim()
			alt = alt ? alt.replace(/\s+/g, ' ').trim() : ''
			imgUrl = imgUrl ? imgUrl.replace(/\s+/g, '').trim() : ''
			linkUrl = linkUrl.replace(/\s+/g, '').trim()
			if (imgUrl) {
				return `[${text} ![${alt}](${imgUrl})](${linkUrl})`
			} else {
				return `[${text}](${linkUrl})`
			}
		}
	)

	// Step 2: Normalize regular links that may be broken across lines
	normalizedMarkdown = normalizedMarkdown.replace(/\[\s*([^\]]+)\]\s*\(\s*([^)]+)\)/g, (match, text, url) => {
		text = text.replace(/\s+/g, ' ').trim()
		url = url.replace(/\s+/g, '').trim()
		return `[${text}](${url})`
	})

	// Step 3: Replace more than two consecutive empty lines with exactly two empty lines
	normalizedMarkdown = normalizedMarkdown.replace(/\n{3,}/g, '\n\n')

	// Step 4: Remove leading spaces from each line
	normalizedMarkdown = normalizedMarkdown.replace(/^[ \t]+/gm, '')

	return normalizedMarkdown.trim()
}

async function getBrowser(endpoint: puppeteer.BrowserWorker): Promise<puppeteer.Browser> {
	// Pick random session from open sessions
	const sessionId = await pickSession(endpoint)
	if (sessionId) {
		try {
			console.log(`Connecting to ${sessionId}`)
			return await puppeteer.connect(endpoint, sessionId)
		} catch (e) {
			// another worker may have connected first
			console.log(`Failed to connect to ${sessionId}. Error ${e}`)
		}
	}

	console.log('No open sessions, launching new session')
	// No open sessions, launch new session
	return await puppeteer.launch(endpoint)
}

// Pick random free session
// Other custom logic could be used instead
async function pickSession(endpoint: puppeteer.BrowserWorker): Promise<string | undefined> {
	const sessions: puppeteer.ActiveSession[] = await puppeteer.sessions(endpoint)
	log(`Sessions: ${JSON.stringify(sessions)}`, 'DEBUG')

	const sessionsIds = sessions.filter((v) => !v.connectionId).map((v) => v.sessionId)
	if (sessionsIds.length === 0) return

	return sessionsIds[Math.floor(Math.random() * sessionsIds.length)]!
}