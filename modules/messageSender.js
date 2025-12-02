import textToSpeech from './textToSpeech.js';

const messageCharLimit = 2000;

export default async function sendMessage(interaction, response, useTextToSpeech = false) {
    // Split response into pieces of 2000 characters or less (Discord limit)
    const messages = splitResponse(response);
    for (const message of messages) {
        let msg = { content: message, files: [] };

        if (useTextToSpeech) {
            const speechFile = await textToSpeech(message);
            if (speechFile) {
                msg.files.push({
                    attachment: speechFile,
                    name: 'SyntheticSpeech.mp3',
                });
            }
        }

        interaction.channel.send(msg);
    }
}

function splitResponse(response) {
    const chunks = [];

    while (response.length) {
        const splitIndex = response.length <= messageCharLimit ? response.length : findSplitIndex(response);
        chunks.push(response.substring(0, splitIndex));
        response = response.substring(splitIndex).trim();
    }

    return chunks;
}

function findSplitIndex(response) {
    const lastNewLine = response.lastIndexOf('\n', messageCharLimit);
    const lastCodeBlock = response.lastIndexOf('```', messageCharLimit);

    const splitIndex = Math.min(
        lastNewLine > -1 ? lastNewLine : messageCharLimit,
        lastCodeBlock > -1 ? lastCodeBlock : messageCharLimit
    );

    return splitIndex;
}