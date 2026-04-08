import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import type { Message as DiscordMessage, ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { load, save } from '../modules/json.js';
import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';
import Message from './message.js';
import type { Vote } from '../types.js';

const maxOptions = 5; // Discord limit

export async function createVote(interaction: DiscordMessage | ChatInputCommandInteraction, title?: string, optionString?: string, anonymity: boolean = false): Promise<Message> {
	const message = new Message();

	if (title === undefined || optionString === undefined) {
		// Get arguments/default values from slash command
		const cmdInteraction = interaction as ChatInputCommandInteraction;
		title = cmdInteraction.options.getString('title')!;
		optionString = cmdInteraction.options.getString('options')!;
		anonymity = cmdInteraction.options.getBoolean('anonymity') || false;
	}

	const vote: Vote = {
		title: title,
		options: splitOptions(optionString, anonymity),
		voters: [],
		anonymity: anonymity,
	};

	const buttons = createVoteButtons(vote);
	const tally = getResult(vote);

	message.addEmbed(tally).addComponents([buttons]);

	message.onSend = async (sentMessage) => {
		try {
			const id = sentMessage.id;
			const votes = load<Record<string, Vote>>('votes');
			votes[id] = vote;
			save('votes', votes);
			log(`Vote '${vote.title}' saved with ID ${id}`);
		} catch (error) {
			log.error(`Failed to save vote: ${error}`);
		}
	};

	return message;
}

export function getResult(vote: Vote): EmbedBuilder {
	const options = Object.keys(vote.options);

	const fields: { name: string; value: string; inline: boolean }[] = [];
	for (const i of options) {
		let result = '-';

		const data = vote.options[i];
		if (vote.anonymity) {
			result = String(data);
		} else {
			const voters = data as Record<string, string>;
			for (const ii in voters) {
				result += `${voters[ii]}\n`;
			}
		}

		// Remove dash
		if (result.length > 1) {
			result = result.slice(1);
		}

		fields.push({ name: i, value: String(result), inline: true });
	}

	const embeddedMessage = new EmbedBuilder()
		.setColor(0x0099FF)
		.setTitle(vote.title)
		.addFields(fields);

	if (vote.description) {
		embeddedMessage.setDescription(vote.description);
	}

	return embeddedMessage;
}

export async function registerVote(interaction: ButtonInteraction): Promise<void> {
	try {
		const votes = load<Record<string, Vote>>('votes');

		// Check if vote exists
		const id = interaction.message.id;
		const vote = votes[id];
		if (!vote) {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			await interaction.editReply({ content: 'Failed to register vote' });
			return;
		}

		// Add vote
		const voteID = interaction.customId;
		const userID = interaction.user.id;
		if (vote.anonymity) {
			if (vote.voters.includes(userID)) {
				// Prevent change if anonymous
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				await interaction.editReply({ content: 'Anonymous votes can not be changed' });
				return;
			}
			vote.voters.push(userID);
			(vote.options[voteID] as number) += 1;
		} else {
			// Remove previous vote
			const option = vote.options[voteID] as Record<string, string>;
			if (userID in option) {
				delete option[userID];
			}
			else {
				// Allow multiple votes
				const name = await getUsername(interaction);
				option[userID] = name;
			}
		}

		save('votes', votes);
		log(`[${vote.title}]: Vote registered for '${voteID}'`);

		const tally = getResult(vote);
		await interaction.update({ embeds: [tally] });
	} catch (error) {
		log.error(`Error in registerVote: ${error}`);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: 'An error occurred while registering your vote.', flags: MessageFlags.Ephemeral });
		}
	}
}

function getEmoji(inputString: string): string | null {
	const regex = /<:(.*?):\d+>/g;
	const matches = inputString.match(regex);
	return matches ? matches[0] : null;
}

function splitOptions(optionString: string, anonymity: boolean): Record<string, number | Record<string, string>> {
	return optionString
		.split(',')
		.map(i => i.trim())
		.slice(0, maxOptions)
		.reduce((options: Record<string, number | Record<string, string>>, i) => {
			options[i] = anonymity ? 0 : {};
			return options;
		}, {});
}

function createVoteButtons(vote: Vote): ActionRowBuilder<ButtonBuilder> {
	const buttons = new ActionRowBuilder<ButtonBuilder>();
	for (let option in vote.options) {
		const button = new ButtonBuilder()
			.setCustomId(option)
			.setStyle(ButtonStyle.Primary);

		const emoji = getEmoji(option);
		if (emoji) {
			button.setEmoji(emoji);
			option = option.replace(emoji, '').trim() || ' ';
		}

		button.setLabel(option);

		buttons.addComponents(button);
	}
	return buttons;
}
