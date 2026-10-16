import fs from 'fs';

export enum LogLevel {
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
}

function formatMessage(text: string, level: LogLevel): string {
	const timestamp = new Date().toISOString();
	return `[${timestamp}] [${level}] ${text}`;
}

function log(text: string, level: LogLevel = LogLevel.INFO): void {
	const message = formatMessage(text, level);
	console.log(message);
	fs.appendFileSync('log.txt', `${message}\n`);
}

log.warn = (text: string): void => log(text, LogLevel.WARN);
log.error = (text: string): void => log(text, LogLevel.ERROR);
log.clear = (): void => fs.writeFileSync('log.txt', '');

export default log;
