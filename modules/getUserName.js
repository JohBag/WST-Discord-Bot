export async function getUserName(message) {
    try {
        let user = message.author;
        console.log("Message type: " + message.type);
        if (message.type == 3) { // Button interaction
            user = message.user;
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