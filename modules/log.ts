import fs from 'fs';

export enum LogLevel {
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
}

// Tools can redirect their output so they don't clobber a running bot's log
const logFile = process.env.LOG_FILE || 'log.txt';

// Clear log file
fs.writeFileSync(logFile, '');

function formatMessage(text: string, level: LogLevel): string {
	const timestamp = new Date().toISOString();
	return `[${timestamp}] [${level}] ${text}`;
}

function log(text: string, level: LogLevel = LogLevel.INFO): void {
	const message = formatMessage(text, level);
	console.log(message);
	fs.appendFileSync(logFile, `${message}\n`);
}

log.warn = (text: string): void => log(text, LogLevel.WARN);
log.error = (text: string): void => log(text, LogLevel.ERROR);

export default log;
