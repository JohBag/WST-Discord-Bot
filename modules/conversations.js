import getUsername from './get-username.js';
import { config } from './data.js';

export default async function getConversation(interaction, messageLimit) {
	let messages = await getMessages(interaction, messageLimit);

	messages = filterByDate(messages);
	messages = filterByCutoff(messages);
	messages = filterEmpty(messages);

	if (messages.length === 0) {
		throw new Error('No messages remaining.');
	}

	return await formatConversation(messages);
}

async function getMessages(interaction, messageLimit) {
	const IdsToMessages = await interaction.channel.messages.fetch({ limit: messageLimit });
	return Array.from(IdsToMessages.values());
}

async function formatConversation(messages) {
	let conversation = await Promise.all(
		messages.map(async (message) => {
			const username = await getUsername(message);
			const role = username === config.name ? 'model' : 'user';
			return {
				role: role,
				parts: [{ text: `${username}: ${message.content}` }]
			};
		})
	);

	conversation.reverse();

	return conversation;
}

function filterByDate(messages) {
	const ageLimit = config.ageLimitDays * (1000 * 60 * 60 * 24);
	const currentDate = new Date();
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		const messageDate = new Date(message.createdTimestamp);
		const age = (currentDate - messageDate);

		if (age > ageLimit) {
			messages = messages.slice(0, i);
			break;
		}
	}

	return messages;
}

function filterByCutoff(messages) {
	const cutoffIndex = messages.findIndex((message) => message.content === config.cutoff);
	return cutoffIndex === -1 ? messages : messages.slice(0, cutoffIndex);
}

function filterEmpty(messages) {
	return messages.filter((message) => message !== '');
}