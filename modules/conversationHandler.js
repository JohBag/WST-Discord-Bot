import getUsername from './getUsername.js';
import { load } from './jsonHandler.js';

const config = load('config');

export default async function getConversation(interaction, messageLimit) {
    // Get channel conversation
    const messages = await interaction.channel.messages.fetch({ limit: messageLimit });
    const arr = Array.from(messages.values());
    const cutoffIndex = arr.findIndex(message => message.content === config.cutoff);
    const messagesUntilCutoff = cutoffIndex !== -1 ? arr.slice(0, cutoffIndex) : arr;

    return await formatConversation(messagesUntilCutoff);
}

async function formatConversation(messagesUntilCutoff) {
    let conversation = await Promise.all(
        messagesUntilCutoff
            .map((message) => {
                // Remove asterisk content and trim the message
                const modifiedMessage = removeAsteriskContent(message.content);

                // Add a modifiedContent property to each message object with the new message
                message.modifiedContent = modifiedMessage;
                return message;
            })
            .filter((message) => message.modifiedContent !== '') // Filter out empty messages
            .map(async (message) => {
                const username = await getUsername(message);
                const role = username === config.name ? 'assistant' : 'user';

                return { role: role, content: `${username}: ${message.modifiedContent}` };
            })
    );

    return conversation.reverse();
}

function removeAsteriskContent(message) {
    return message.replace(/\s*\*\w*\*\s*/g, ' ').trim();
}