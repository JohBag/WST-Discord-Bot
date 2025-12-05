import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { load, save } from '../modules/json.js';
import log from '../modules/log.js';
import getUsername from '../modules/get-username.js';

const maxOptions = 5; // Discord limit

import Message from './message.js';

export async function createVote(interaction, title, optionString, anonymity = false) {
	try {
		if (title === undefined || optionString === undefined || anonymity === undefined) {
			// Get arguments/default values
			title = interaction.options.getString('title');
			optionString = interaction.options.getString('options');
			anonymity = interaction.options.getBoolean('anonymity') || false;
		}

		const vote = {
			title: title,
			options: splitOptions(optionString, anonymity),
			voters: [],
			anonymity: anonymity,
		};

		const buttons = createVoteButtons(vote);
		const tally = getResult(vote);

		const message = new Message()
			.addEmbed(tally)
			.addComponents([buttons]);

		message.onSend = async (sentMessage) => {
			const id = sentMessage.id;
			let votes = await load('votes');
			votes[id] = vote;
			save('votes', votes);
		};

		return message;
	} catch (error) {
		log(error);
		return new Message().addText('Failed to create vote.');
	}
};

export function getResult(vote) {
	let options = Object.keys(vote.options);

	let fields = [];
	for (let i of options) {
		let result = '-';

		let data = vote.options[i];
		if (vote.anonymity) {
			result = data;
		} else {
			for (let ii in data) {
				result += `${data[ii]}\n`;
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
		.addFields(fields)

	if (vote.description) {
		embeddedMessage.setDescription(vote.description)
	}

	return embeddedMessage;
}

export async function registerVote(interaction) {
	let votes = await load('votes');

	// Check if vote exists
	const id = interaction.message.id;
	let vote = votes[id];
	if (!vote) {
		return interaction.reply({ content: 'Failed to register vote', ephemeral: true });
	}

	// Add vote
	const voteID = interaction.customId;
	const userID = interaction.user.id;
	if (vote.anonymity) {
		if (vote.voters.includes(userID)) {
			// Prevent change if anonymous
			return interaction.reply({ content: 'Anonymous votes can not be changed', ephemeral: true });
		}
		vote.voters.push(userID);
		vote.options[voteID] += 1;
	} else {
		// Remove previous vote
		console.log(vote.options)
		console.log("VoteID: " + voteID);
		let option = vote.options[voteID];
		if (userID in option) {
			delete option[userID];
		}
		else {
			// Allow multiple votes
			const name = await getUsername(interaction); // Get nickname or discord name
			vote.options[voteID][userID] = name;
		}
	}

	save('votes', votes);
	log(`[${vote.title}]: Vote registered for '${voteID}'`);

	let tally = getResult(vote);
	interaction.update({ embeds: [tally] });
}

function getEmoji(inputString) {
	const regex = /<:(.*?):\d+>/g;
	const matches = inputString.match(regex);
	return matches ? matches[0] : null;
}

function splitOptions(optionString, anonymity) {
	return optionString
		.split(',')
		.map(i => i.trim())
		.slice(0, maxOptions)
		.reduce((options, i) => {
			options[i] = anonymity ? 0 : {};
			return options;
		}, {});
}

function createVoteButtons(vote) {
	// Create buttons
	let buttons = new ActionRowBuilder()
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
