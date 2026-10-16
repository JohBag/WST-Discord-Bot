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
];
