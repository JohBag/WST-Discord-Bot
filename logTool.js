const { debug } = require('console');
const https = require("https");
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const puppeteer = require('puppeteer');
const run_headless = false;

const useIlvlParse = 0; // Set to 1 to receive rankings by bracket (ilvl)

var clientID = "97a1b9d9-7d4f-470d-b40d-4effbb8ebe48";
var clientSecret = "7Avt7DaqTM0lQguawh5w4S99Ozsp4QYG4oVb5v3z";

var tokenURI = "https://www.warcraftlogs.com/oauth/token";
var authURI = "https://www.warcraftlogs.com/oauth/authorize";

function getAccessToken() {
}

process.on('uncaughtException', function (err) {
	console.log('Caught exception: ' + err);
});

exports.getLogMessage = function (id, callback) {
	getLog(id, function (msg) {
		callback(msg);
	});
}

function debugMessage(str) {
	console.log(str);
}

async function fetchHTML(url, loadSelector, callback) {
	debugMessage("Fetching data...");

	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto(url, {
		waitUntil: 'networkidle0'
	});
	if (loadSelector != '') {
		try {
			await page.waitForSelector(loadSelector, { timeout: 5000 });
		}
		catch (e) {
			if (e instanceof puppeteer.errors.TimeoutError) {
				await browser.close();
				debugMessage("Error (Timeout): Failed to fetch HTML");
				callback(-1);
				return;
			}
		}
	}
	var msg = await page.evaluate(() => document.querySelector('*').outerHTML);
	await browser.close();

	debugMessage("Data received");
	callback(msg);
};

function clearNewLines(str) {
	return str.replace(/(\r\n|\n|\r)/gm, "");
}

function getRaidName(doc) {
	var msg = doc.getElementById("report-title-container").firstChild.textContent;
	msg = clearNewLines(msg);
	return msg;
}

function getDate(doc) {
	// Date submitted
	var str = doc.getElementById("report-title-container").innerHTML;
	var subStr = str.substring(
		str.indexOf("(") + 1,
		str.indexOf(")")
	);
	var date = new Date(Number(subStr));
	return date.toDateString();
}

function getBossData(doc) {
	debugMessage("Fetching boss data...");
	var msg = "";
	var bossArr = doc.getElementsByClassName("report-overview-boss-box");
	var blacklist = new Array("Encounters and Trash Fights", "Encounters", "Trash Fights");

	debugMessage("Bosses: " + bossArr.length);
	for (var i = 0; i < bossArr.length; ++i) {
		var elem = bossArr[i];

		// Name
		var name = elem.querySelector('.report-overview-boss-text').textContent;
		if (blacklist.includes(name)) {
			continue;
		}
		// Difficulty
		name = name.replace(' Normal', '');
		if (name.includes(' Heroic')) {
			name = name.replace(' Heroic', '');
			name = '[H] ' + name;
		}
		msg += name;

		// Best pull
		var wipeTable = elem.querySelector('.wipes-table');
		if (wipeTable != null) {
			var wipeArr = wipeTable.children;

			var bestPerc = -1;
			for (var ii = 0; ii < wipeArr.length; ++ii) {
				var child = wipeArr[ii].lastChild.querySelector('[class^="wipes-percent-fg"]');
				if (child != null) {
					var str = child.outerHTML;

					var perc = str.substring(
						str.indexOf(":") + 1,
						str.indexOf("%")
					);

					perc = 100 - perc;
					if (bestPerc == -1 || perc < bestPerc) {
						bestPerc = perc;
					}
				}
			}
			if (bestPerc != -1) {
				msg += ' (' + bestPerc + '%)';
			}
		}
		msg += '\n';
	}
	debugMessage("Boss data received");
	return msg;
}

function getBestParse(table) {
	var rows = table.rows;
	var cells = rows[1].getElementsByTagName('td');

	var highestRank = 0;
	for (var i = 2; i < cells.length; ++i) {
		var rank = Number(cells[i].textContent);
		if (!isNaN(rank) && rank > highestRank) {
			highestRank = rank;
		}
	}
	var name = cells[0].textContent;
	var msg = name + ' ' + highestRank + '%';
	msg = clearNewLines(msg);
	return msg;
}

function findParse(url, callback) {
	url += '#view=rankings&boss=-2&playermetric=dps';

	fetchHTML(url, '.report-rankings-tab-content', function (content) {
		if (content == -1) {
			callback(-1);
			return;
		}

		const dom = new JSDOM(content);
		dom.window.addEventListener('load', (event) => {
			var doc = dom.window.document;

			var tables = doc.querySelector('.report-rankings-tab-content').querySelectorAll('table');
			var msg = 'Top Parses\n';
			msg += '[D]' + getBestParse(tables[0 + useIlvlParse]) + '\n'; // Damage (1 for ilvl)
			msg += '[H]' + getBestParse(tables[4 + useIlvlParse]) + '\n'; // Healing (5 for ilvl)
			callback(msg);
		});
	});
}

function getLog(id, callback) {
	debugMessage("Preparing log...");

	var url = 'https://www.warcraftlogs.com/reports/' + id + '/';

	fetchHTML(url, '#report-fight-selection-area', function (content) {
		if (content == -1) {
			callback(-1);
			return;
		}

		const dom = new JSDOM(content);
		dom.window.addEventListener('load', (event) => {
			var doc = dom.window.document;
			var message = getRaidName(doc) + '\n\n';
			message += getBossData(doc) + '\n';

			findParse(url, function (msg) {
				if (msg != -1) {
					message += msg + '\n';
				}

				message += url;
				debugMessage("Log completed");
				callback(message);
			});
		});
	});
};

exports.fetchMostRecent = function (callback) {
	var url = 'https://www.warcraftlogs.com/user/reports-list/1751707/';

	debugMessage("Searching for reports...");

	fetchHTML(url, '#reports-table', function (content) {
		if (content == -1) {
			debugMessage("Error (Timeout): Search failed");
			callback(-1);
			return;
		}

		const dom = new JSDOM(content);
		dom.window.addEventListener('load', (event) => {
			var doc = dom.window.document;

			var rows = doc.querySelector('#reports-table').rows;
			var mostRecent = rows[1]; // Skip header
			var link = mostRecent.querySelector('a').getAttribute('href');

			var id = link.replace('/reports/', '');
			debugMessage("ID fetched: " + id);

			getLog(id, function (msg) {
				callback(msg);
			});
		});
	});
}