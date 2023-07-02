export async function getUsername(message) {
    let user = null;
    switch (message.type) {
        case 0: // Message
            user = message.author;
            break;
        case 3: // Button interaction
            user = message.user;
            break;
    }
    if (!user) {
        return "Unknown";
    }

    const member = await message.guild.members.fetch(user.id);
    const nickname = member.nickname;
    if (nickname) {
        return nickname;
    }

    const globalName = user.globalName;
    if (globalName) {
        return globalName;
    }

    return user.username;
}