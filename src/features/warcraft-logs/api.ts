import { secrets } from '../../core/config.js';
import log from '../../core/log.js';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
	if (cachedToken && Date.now() < tokenExpiry) {
		return cachedToken;
	}

	const response = await fetch('https://www.warcraftlogs.com/oauth/token', {
		method: 'POST',
		headers: {
			'Authorization': 'Basic ' + btoa(secrets.keys.warcraftLogs!)
		},
		body: new URLSearchParams({
			'grant_type': 'client_credentials'
		})
	});

	if (!response.ok) {
		throw new Error(`Warcraft Logs token request failed (${response.status}): ${await response.text()}`);
	}

	const data = await response.json() as { access_token: string; expires_in: number };
	cachedToken = data.access_token;
	tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
	return cachedToken;
}

export async function sendQuery(query: string, variables: Record<string, any> = {}, retry = true): Promise<any> {
	const accessToken = await getAccessToken();

	const response = await fetch('https://www.warcraftlogs.com/api/v2/client', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + accessToken
		},
		body: JSON.stringify({ query, variables })
	});

	// The cached token can be revoked before it expires; fetch a new one and try again
	if (response.status === 401 && retry) {
		log('Warcraft Logs rejected the access token, requesting a new one');
		cachedToken = null;
		return sendQuery(query, variables, false);
	}

	const body = await response.text();
	if (!response.ok) {
		throw new Error(`Warcraft Logs query failed (${response.status}): ${body}`);
	}

	const data = JSON.parse(body);
	if (data.errors) {
		log('Warcraft Logs query returned errors: ' + JSON.stringify(data.errors));
	}
	if (!data.data) {
		throw new Error('Warcraft Logs query returned no data: ' + body);
	}
	return data;
}
