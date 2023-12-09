export default async function getUsername(interaction) {
    let name = "Unknown user";
    try {
        let user = interaction.author || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);
        name = member.displayName || user.displayName || name;
    } catch (error) {
        log(`Error: ${error}`);
    } finally {
        return name;
    }
}