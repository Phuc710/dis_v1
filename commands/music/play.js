const { QueryType, useMainPlayer } = require('discord-player');
const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { Translate } = require('../../process_tools');

module.exports = {
    name: 'play',
    description: "Play a song!",
    voiceChannel: true,
    options: [
        {
            name: 'song',
            description: 'The song you want to play',
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],

    async execute(client, interaction, player) {
        // Kiểm tra trạng thái interaction trước khi defer
        if (interaction.deferred || interaction.replied) {
            console.log('⚠️ Interaction already acknowledged');
            return;
        }

        try {
            // Defer reply với timeout handling
            await Promise.race([
                interaction.deferReply({ ephemeral: false }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Defer timeout')), 3000)
                )
            ]);
            console.log(`▶️ Play command deferred by ${interaction.user.tag} in guild ${interaction.guild.name}`);
        } catch (deferError) {
            console.error('❌ Failed to defer reply:', deferError);
            // Nếu defer fail, thử reply trực tiếp
            try {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setAuthor({ name: 'Có lỗi khi xử lý lệnh, vui lòng thử lại!' });
                return interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (replyError) {
                console.error('❌ Failed to reply after defer error:', replyError);
                return;
            }
        }
        
        // Kiểm tra voice channel
        if (!interaction.member.voice.channel) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: await Translate("You need to be in a voice channel! ❌") });
            return safeEditReply(interaction, { embeds: [embed] });
        }

        // Kiểm tra bot permission
        const permissions = interaction.member.voice.channel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has(['Connect', 'Speak'])) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: await Translate("I don't have permission to join this voice channel! ❌") });
            return safeEditReply(interaction, { embeds: [embed] });
        }

        const song = interaction.options.getString('song');
        let defaultEmbed = new EmbedBuilder().setColor('#2f3136');

        try {
            console.log(`🔍 Searching for: ${song}`);
            
            // Search for the song với timeout
            const searchPromise = player.search(song, {
                requestedBy: interaction.member,
                searchEngine: QueryType.AUTO
            });

            const res = await Promise.race([
                searchPromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Search timeout')), 10000)
                )
            ]);

            if (!res?.tracks?.length) {
                defaultEmbed.setAuthor({ 
                    name: await Translate(`No results found for "${song}"... try again ? ❌`) 
                });
                return safeEditReply(interaction, { embeds: [defaultEmbed] });
            }

            console.log(`✅ Found ${res.tracks.length} tracks`);
            console.log(`🎵 First track: ${res.tracks[0].title} by ${res.tracks[0].author}`);

            // Play the song với timeout
            const playPromise = player.play(interaction.member.voice.channel, res, {
                nodeOptions: {
                    metadata: {
                        channel: interaction.channel,
                        requestedBy: interaction.user
                    },
                    volume: client.config.opt.volume,
                    leaveOnEmpty: client.config.opt.leaveOnEmpty,
                    leaveOnEmptyCooldown: client.config.opt.leaveOnEmptyCooldown,
                    leaveOnEnd: client.config.opt.leaveOnEnd,
                    leaveOnEndCooldown: client.config.opt.leaveOnEndCooldown,
                    bufferingTimeout: 15000,
                    connectionTimeout: 30000
                }
            });

            const { track } = await Promise.race([
                playPromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Play timeout')), 15000)
                )
            ]);

            console.log(`🎶 Successfully added to queue: ${track.title}`);

            defaultEmbed
                .setColor('#00ff00')
                .setAuthor({ 
                    name: await Translate(`Added to queue: ${track.title} ✅`) 
                })
                .addFields([
                    {
                        name: '🎵 Song',
                        value: `**${track.title}**`,
                        inline: true
                    },
                    {
                        name: '👤 Artist',
                        value: `${track.author}`,
                        inline: true
                    },
                    {
                        name: '⏱️ Duration',
                        value: `${track.duration}`,
                        inline: true
                    },
                    {
                        name: '🔗 Source',
                        value: `${track.source}`,
                        inline: true
                    }
                ])
                .setThumbnail(track.thumbnail)
                .setFooter({ 
                    text: `Requested by ${interaction.user.displayName}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            return safeEditReply(interaction, { embeds: [defaultEmbed] });

        } catch (error) {
            console.error(`❌ Play command error:`, error);
            console.error(`❌ Error stack:`, error.stack);
            
            // Xử lý các loại lỗi khác nhau
            let errorMessage = "Unknown error occurred";
            
            if (error.message.includes('Video unavailable')) {
                errorMessage = "Video is unavailable or region-blocked";
            } else if (error.message.includes('Sign in to confirm')) {
                errorMessage = "Age-restricted content";
            } else if (error.message.includes('No compatible encryption')) {
                errorMessage = "Voice connection issue - try again";
            } else if (error.message.includes('Cannot read properties')) {
                errorMessage = "Failed to load track data";
            } else if (error.message.includes('timeout')) {
                errorMessage = "Request timed out - try again";
            } else {
                errorMessage = error.message.slice(0, 100);
            }

            defaultEmbed
                .setColor('#ff0000')
                .setAuthor({ 
                    name: await Translate(`Cannot play this song: ${errorMessage} ❌`) 
                })
                .addFields({
                    name: '💡 Try:',
                    value: '• Different search terms\n• Another song\n• Check if the video is available in your region\n• Wait a moment and try again'
                });

            return safeEditReply(interaction, { embeds: [defaultEmbed] });
        }
    }
};

// Helper function để safely edit reply
async function safeEditReply(interaction, options) {
    try {
        if (interaction.deferred && !interaction.replied) {
            return await interaction.editReply(options);
        } else if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply(options);
        } else if (interaction.replied) {
            return await interaction.followUp(options);
        }
    } catch (error) {
        console.error('❌ Failed to send response:', error);
        // Thử gửi vào channel như fallback
        try {
            if (interaction.channel && interaction.channel.send) {
                return await interaction.channel.send(options);
            }
        } catch (channelError) {
            console.error('❌ Failed to send to channel:', channelError);
        }
    }
}