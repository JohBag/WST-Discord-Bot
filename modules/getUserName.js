export default async function getUsername(message) {
    try {
        let user = message.author;
        if (message.type == 3) { // Button interaction
            user = message.user;
        }

        try {
            return interaction.member.nickname
        } catch (error) {
            // Ignore
        }

        try {
            const member = await message.guild.members.fetch(user.id);
            const nickname = member.nickname;
            if (nickname) {
                return nickname;
            }
        } catch (error) {
            // Ignore
        }

        try {
            const globalName = user.globalName;
            if (globalName) {
                return globalName;
            }
        } catch (error) {
            // Ignore
        }

        try {
            return user.username;
        } catch (error) {
            // Ignore
        }

        try {
            message.member.displayName
        } catch (error) {
            // Ignore
        }
    } catch (error) {
        log(`Error: ${error}`);
        return "Unknown";
    }
}