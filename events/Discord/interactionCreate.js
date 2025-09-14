// File: interactionCreate.js
const { EmbedBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

module.exports = async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.log(`❌ Command ${interaction.commandName} not found`);
        return;
    }

    const player = useMainPlayer();

    try {
        console.log(`🔄 Processing command: ${interaction.commandName}`);

        // KHÔNG defer ở đây - để command tự xử lý
        await command.execute(client, interaction, player);
        
    } catch (error) {
        console.error(`❌ Error executing command ${interaction.commandName}:`, error);
        
        try {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Đã xảy ra lỗi!')
                .setDescription(`Có lỗi khi thực hiện lệnh: \`${interaction.commandName}\``)
                .addFields({
                    name: 'Chi tiết lỗi:',
                    value: `\`\`\`${error.message.slice(0, 1000)}\`\`\``
                })
                .setTimestamp();

            // Kiểm tra trạng thái interaction một cách an toàn
            if (interaction.deferred && !interaction.replied) {
                // Nếu đã defer nhưng chưa reply
                await interaction.editReply({ embeds: [errorEmbed] });
            } else if (!interaction.replied && !interaction.deferred) {
                // Nếu chưa reply và chưa defer
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            } else if (interaction.replied) {
                // Nếu đã reply rồi, thì followUp
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }
            // Nếu không thể gửi theo cách nào, bỏ qua
            
        } catch (replyError) {
            console.error('❌ Failed to send error message:', replyError);
            // Thử gửi message đơn giản vào channel
            try {
                if (interaction.channel && interaction.channel.send) {
                    await interaction.channel.send({ embeds: [errorEmbed] });
                }
            } catch (channelError) {
                console.error('❌ Failed to send error to channel:', channelError);
            }
        }
    }
};