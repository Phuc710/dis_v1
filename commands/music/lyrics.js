const { EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');
const { Translate } = require('../../process_tools');

// Alternative lyrics search without external API
async function searchLyricsAlternative(title) {
    try {
        // Simple web scraping hoặc API call
        // Ví dụ với một API lyrics miễn phí
        const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(title)}`);
        if (response.ok) {
            const data = await response.json();
            return data.lyrics;
        }
    } catch (error) {
        console.log('Alternative lyrics search failed:', error.message);
    }
    return null;
}

module.exports = {
    name: 'lyrics',
    description: 'Hiển thị lời bài hát đang phát hoặc tìm kiếm',
    voiceChannel: true,

    async execute({ inter }) {
        try {
            const queue = useQueue(inter.guild);
            
            if (!queue?.isPlaying()) {
                return inter.editReply({ 
                    content: await Translate(`❌ | **Không có gì đang phát ngay bây giờ...**`) 
                });
            }

            const currentTrack = queue.currentTrack;
            const songTitle = currentTrack.title;
            const artistName = currentTrack.author || 'Unknown Artist';

            await inter.editReply({ content: '🔍 Đang tìm lời bài hát...' });

            let lyrics = null;

            // Method 1: Try with current track title
            lyrics = await searchLyricsAlternative(songTitle);

            // Method 2: Try with cleaned title
            if (!lyrics) {
                const cleanTitle = songTitle
                    .replace(/\[.*?\]/g, '')
                    .replace(/\(.*?ft\..*?\)/gi, '')
                    .replace(/\(.*?feat\..*?\)/gi, '')
                    .replace(/official/gi, '')
                    .replace(/mv/gi, '')
                    .replace(/video/gi, '')
                    .trim();
                
                lyrics = await searchLyricsAlternative(cleanTitle);
            }

            // Method 3: Try with artist + song
            if (!lyrics && artistName !== 'Unknown Artist') {
                const searchQuery = `${artistName} ${songTitle.split('-').pop() || songTitle}`;
                lyrics = await searchLyricsAlternative(searchQuery);
            }

            if (!lyrics) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('❌ Không tìm thấy lời bài hát')
                    .setAuthor({ 
                        name: `Lời bài hát cho: ${songTitle}`,
                        iconURL: inter.client.user.displayAvatarURL()
                    })
                    .setDescription(`**Không tìm thấy lời cho:** \`${songTitle}\``)
                    .addFields([
                        {
                            name: '🎵 Bài hát hiện tại',
                            value: `**${songTitle}**\nby ${artistName}`,
                            inline: false
                        },
                        {
                            name: '🔍 Tìm lời bài hát tại:',
                            value: '• [NhacCuaTui](https://nhaccuatui.com) (Việt Nam)\n• [Zing MP3](https://zingmp3.vn) (Việt Nam)\n• [Genius](https://genius.com) (Quốc tế)\n• [AZLyrics](https://azlyrics.com) (Quốc tế)',
                            inline: false
                        }
                    ])
                    .setThumbnail(currentTrack.thumbnail)
                    .setFooter({ 
                        text: await Translate('Music With Phucx <❤️>'), 
                        iconURL: inter.member.avatarURL({ dynamic: true }) 
                    })
                    .setTimestamp();

                return inter.editReply({ content: '', embeds: [embed] });
            }

            // Split lyrics into chunks for Discord embed limit
            const lyricsLines = lyrics.split('\n');
            const chunks = [];
            let currentChunk = [];
            let currentLength = 0;

            for (const line of lyricsLines) {
                if (currentLength + line.length > 1800) { // Leave room for formatting
                    chunks.push(currentChunk.join('\n'));
                    currentChunk = [line];
                    currentLength = line.length;
                } else {
                    currentChunk.push(line);
                    currentLength += line.length + 1;
                }
            }
            
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.join('\n'));
            }

            // Create embeds for each chunk
            const embeds = await Promise.all(
                chunks.map(async (chunk, index) => {
                    const translatedFooter = await Translate('Music With Phucx <❤️>');

                    const embed = new EmbedBuilder()
                        .setColor('#00ff88')
                        .setAuthor({ 
                            name: `Lời bài hát cho: ${songTitle}`,
                            iconURL: inter.client.user.displayAvatarURL()
                        })
                        .setDescription(chunk)
                        .setThumbnail(currentTrack.thumbnail)
                        .setFooter({ 
                            text: chunks.length > 1 
                                ? `Trang ${index + 1}/${chunks.length} • ${translatedFooter}`
                                : translatedFooter,
                            iconURL: inter.member.avatarURL({ dynamic: true })
                        })
                        .setTimestamp();

                    return embed;
                })
            );


            // Send first embed
            await inter.editReply({ content: '', embeds: [embeds[0]] });

            // If multiple pages, send others as follow-up
            if (embeds.length > 1) {
                for (let i = 1; i < embeds.length; i++) {
                    await inter.followUp({ embeds: [embeds[i]], ephemeral: true });
                }
            }

        } catch (error) {
            console.error('Lyrics command error:', error);
            return inter.editReply({
                content: await Translate(`❌ Lỗi khi tìm lời bài hát: ${error.message}`)
            });
        }
    }
}