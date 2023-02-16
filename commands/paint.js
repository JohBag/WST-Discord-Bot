import { Configuration, OpenAIApi } from "openai";
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { load } from '../json_manager.js';
import fs from 'fs';

const secrets = load('secrets');
const configuration = new Configuration({
    apiKey: secrets.apiKey,
});
const openai = new OpenAIApi(configuration);

export default {
    data: new SlashCommandBuilder()
        .setName('paint')
        .setDescription('Generate an image')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('A description of the image')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer to avoid 3 second limit on response

        const prompt = interaction.options.getString('prompt');

        if (!await generateImage(prompt)) {
            return interaction.editReply({
                content: 'Error generating image',
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(prompt)
            .setImage('attachment://image.png');

        return interaction.editReply({
            embeds: [embed],
            files: ['./image.png']
        });
    },
};

async function generateImage(prompt) {
    const response = await openai.createImage({
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: 'b64_json'
    });
    if (!response.status == 200) { // 200 = OK
        console.log("Error: " + completion.status);
        return false;
    }
    const b64 = response.data.data[0].b64_json;

    await convertBase64ToImage(b64);
    return true;
}

async function convertBase64ToImage(data) {
    // Convert base64 to buffer
    const buffer = Buffer.from(data, "base64");
    // Create image from buffer
    fs.writeFileSync('image.png', buffer);
}