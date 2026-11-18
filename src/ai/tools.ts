// What the model can ask the bot to do. Raid logs are not here: they are posted automatically., as JSON Schema that both Gemini and Claude accept

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
}

// All tools, none, or the named ones
export function selectTools(allowed: boolean | string[]): ToolDefinition[] {
	return allowed === true ? tools : allowed === false ? [] : tools.filter(tool => allowed.includes(tool.name));
}

export const reminderTools = ['set_reminder', 'list_reminders', 'cancel_reminder'];

// Who asked, for the reminder tools: several people may have pinged Botty in the messages one reply answers
const asker = {
	type: 'string',
	description: 'The name of the person asking, exactly as written before their message.',
};

export const tools: ToolDefinition[] = [
	{
		name: 'generate_picture',
		description: 'Generates a picture based on the given prompt.',
		parameters: {
			type: 'object',
			properties: {
				prompt: {
					type: 'string',
					description: 'The prompt to generate the picture.',
				},
			},
			required: ['prompt'],
		},
	},
	{
		name: 'create_vote',
		description: 'Starts a vote based on the given title and options.',
		parameters: {
			type: 'object',
			properties: {
				title: {
					type: 'string',
					description: 'The title of the vote.',
				},
				options: {
					type: 'string',
					description: 'Comma-separated list of options (max 25).',
				},
				anonymity: {
					type: 'boolean',
					description: 'Whether to hide voter names and use a score system instead (default: false).',
				},
			},
			required: ['title', 'options'],
		},
	},
	{
		name: 'set_reminder',
		description: 'Sets a reminder that you post in this channel when it is due. Use it when someone asks to be reminded of something later.',
		parameters: {
			type: 'object',
			properties: {
				asker,
				when: {
					type: 'string',
					description: 'When it is due. A duration from now for relative times ("in 2 hours" is 2h, "in a day and a half" is 1d 12h), otherwise an ISO 8601 date and time with offset, such as 2026-11-20T19:30:00+01:00.',
				},
				text: {
					type: 'string',
					description: 'What to remind about, short and in the asker\'s terms, such as "bring flasks for raid".',
				},
				for: {
					type: 'string',
					enum: ['asker', 'channel', 'role'],
					description: 'Who it is for: the asker (default), everyone in the channel (pings @here), or a role. Only officers can set channel and role reminders.',
				},
				role: {
					type: 'string',
					description: 'The role\'s name, when it is for a role.',
				},
			},
			required: ['asker', 'when', 'text'],
		},
	},
	{
		name: 'list_reminders',
		description: 'Lists the asker\'s reminders and the ones set for this channel, each with its number.',
		parameters: { type: 'object', properties: { asker }, required: ['asker'] },
	},
	{
		name: 'cancel_reminder',
		description: 'Cancels a reminder by its number, shown as #12 when it was set or listed. For "cancel that" or "never mind", take the number from your latest reminder message in the chat instead of listing them first.',
		parameters: {
			type: 'object',
			properties: {
				asker,
				number: {
					type: 'number',
					description: 'The reminder\'s number.',
				},
			},
			required: ['asker', 'number'],
		},
	},
];
