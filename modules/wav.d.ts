declare module 'wav' {
	import { Writable } from 'stream';

	interface FileWriterOptions {
		channels?: number;
		sampleRate?: number;
		bitDepth?: number;
	}

	class FileWriter extends Writable {
		constructor(path: string, options?: FileWriterOptions);
	}

	export { FileWriter };
}
