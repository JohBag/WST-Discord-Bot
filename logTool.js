const https = require("https");
const jsdom = require('jsdom');
const { debug } = require('console');
const { JSDOM } = jsdom;


const { window } = new JSDOM();
const { document } = (new JSDOM('')).window;
global.document = document;
var $ = jQuery = require('jquery')(window);

const puppeteer = require('puppeteer');

const run_headless = false;

process.on('uncaughtException', function (err) {
	console.log('Caught exception: ' + err);
});

function debugMessage(str) {
	console.log(str);
}

exports.getLogMessage = function (id, callback) {
	getLog(id, function (msg) {
		callback(msg);
	});
}

async function fetchHTML(url, loadSelector, callback) {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto(url);
	if (loadSelector != '') {
		try {
			await page.waitForSelector(loadSelector, { timeout: 5000 });
		}
		catch (e) {
			if (e instanceof puppeteer.errors.TimeoutError) {
				debugMessage("Error (Timeout): Failed to fetch HTML");
				callback(-1);
				return;
			}
		}
	}
	callback(await page.evaluate(() => document.querySelector('*').outerHTML));
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
	var msg = '';
	var bossArr = doc.getElementsByClassName("report-overview-boss-box");
	var blacklist = new Array("Encounters and Trash Fights", "Encounters", "Trash Fights");
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

					//debugMessage(perc);
				}
			}
			if (bestPerc != -1) {
				msg += ' (' + bestPerc + '%)';
			}
		}
		msg += '\n';
	}
	return msg;
}

function getBestParse(table) {
	var rows = table.rows;
	var cells = rows[1].getElementsByTagName('td');

	var highestRank = 0;
	for (var i = 2; i < cells.length; ++i) {
		var rank = Number(cells[i].textContent);
		if (rank > highestRank) {
			highestRank = rank;
		}
	}
	var name = cells[0].textContent;
	var msg = name + ' (' + highestRank + '%) ';
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
			var msg = 'Highest Rankings\n';
			msg += '[Damage]\t' + getBestParse(tables[0]) + '\n'; // Damage
			msg += '[Healing]\t' + getBestParse(tables[4]) + '\n'; // Healing
			callback(msg);
		});
	});
}

async function getLog(id, callback) {
	var url = 'https://www.warcraftlogs.com/reports/' + id + '/';

	fetchHTML(url, '', function (content) {
		if (content == -1) {
			callback(-1);
			return;
		}

		const dom = new JSDOM(content);

		dom.window.addEventListener('load', (event) => {
			var doc = dom.window.document;

			var message = "WST - " + getRaidName(doc) + '\n\n';
			message += getBossData(doc) + '\n';

			findParse(url, function (msg) {
				if (msg != -1) {
					message += msg + '\n';
				}

				message += url;
				debugMessage("Data collection finished");
				callback(message);
			});
		});
	});
}

exports.fetchMostRecent = function (callback) {
	var url = 'https://www.warcraftlogs.com/user/reports-list/1751707/';

	fetchHTML(url, '#reports-table', function (content) {
		if (content == -1) {
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