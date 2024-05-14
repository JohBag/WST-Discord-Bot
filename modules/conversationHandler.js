import getUsername from './getUsername.js';
import { config } from './data.js';

export default async function getConversation(interaction, messageLimit) {
    let messages = await getMessages(interaction, messageLimit);

    // Filter messages
    messages = filterDate(messages);
    messages = filterCutoff(messages);
    //messages = filterItalics(messages);
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

function filterDate(messages) {
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

function filterCutoff(messages) {
    // Remove messages after the cutoff message, including the cutoff message
    const cutoffIndex = messages.findIndex((message) => message.content === config.cutoff);
    return cutoffIndex === -1 ? messages : messages.slice(0, cutoffIndex);
}

function filterItalics(messages) {
    // Remove substring between asterisks
    return messages.map((message) => message.replace(/\s*\*\w*\*\s*/g, ' ').trim());
}

function filterEmpty(messages) {
    // Remove empty messages
    return messages.filter((message) => message !== '');
}

async function formatConversation(messages) {
    let conversation = await Promise.all(
        messages.map(async (message) => {
            const username = await getUsername(message);
            const role = username === config.name ? 'assistant' : 'user';

            return { role: role, content: `${username}: ${message.content}` };
        })
    );

    conversation.reverse();

    return conversation;
}