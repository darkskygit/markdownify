import puppeteer from '@cloudflare/puppeteer';

import { log } from '../utils';
import READABILITY_JS from './readability.bin';

const READABILITY_JS_TEXT = new TextDecoder().decode(READABILITY_JS as ArrayBuffer);
const GIVE_SNAPSHOT = `
function giveSnapshot() {
	const {title,location,documentElement,body} = document;
	return {
		title,href:location.href,html:documentElement.outerHTML,text:body.innerText,
		parsed: new Readability(document.cloneNode(true)).parse()
	};
}`;

export async function newPage(browser: puppeteer.Browser) {
	const page = await browser.newPage();
	const preparations = [];
	preparations.push(page.setBypassCSP(true));
	preparations.push(page.setViewport({ width: 1920, height: 1080 }));
	preparations.push(page.evaluateOnNewDocument(READABILITY_JS_TEXT));
	preparations.push(page.evaluateOnNewDocument(GIVE_SNAPSHOT));
	await Promise.all(preparations);

	return page;
}

export async function getBrowser(endpoint: puppeteer.BrowserWorker): Promise<puppeteer.Browser> {
	// Pick random session from open sessions
	const sessionId = await pickSession(endpoint);
	if (sessionId) {
		try {
			return await puppeteer.connect(endpoint, sessionId);
		} catch (e: any) {
			// another worker may have connected first
			log(`Failed to connect to ${sessionId}.`, 'ERROR', { message: e.message, stack: e.stack });
		}
	}

	log('No open sessions, launching new session', 'DEBUG');
	// No open sessions, launch new session
	return await puppeteer.launch(endpoint);
}

// Pick random free session
// Other custom logic could be used instead
async function pickSession(endpoint: puppeteer.BrowserWorker): Promise<string | undefined> {
	const sessions: puppeteer.ActiveSession[] = await puppeteer.sessions(endpoint);
	log(`Sessions: ${JSON.stringify(sessions)}`, 'DEBUG');

	const sessionsIds = sessions.filter((v) => !v.connectionId).map((v) => v.sessionId);
	if (sessionsIds.length === 0) return;

	return sessionsIds[Math.floor(Math.random() * sessionsIds.length)]!;
}
