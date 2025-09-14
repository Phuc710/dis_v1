const { readdirSync } = require("fs");
const { Collection } = require("discord.js");
const { useMainPlayer } = require("discord-player");
client.commands = new Collection();
const commandsArray = [];
const player = useMainPlayer();

const { Translate, GetTranslationModule } = require("./process_tools");

const discordEvents = readdirSync("./events/Discord/").filter((file) =>
  file.endsWith(".js")
);
const playerEvents = readdirSync("./events/Player/").filter((file) =>
  file.endsWith(".js")
);

GetTranslationModule().then(() => {
  console.log("| Translation Module Loaded |");

  for (const file of discordEvents) {
    const DiscordEvent = require(`./events/Discord/${file}`);
    const txtEvent = `< -> > [Loaded Discord Event] <${file.split(".")[0]}>`;
    parseLog(txtEvent);
    const eventName = file.split(".")[0] === 'ready' ? 'clientReady' : file.split(".")[0];
    client.on(eventName, (...args) => DiscordEvent(client, ...args));
    delete require.cache[require.resolve(`./events/Discord/${file}`)];
  }

  for (const file of playerEvents) {
    const PlayerEvent = require(`./events/Player/${file}`);
    const txtEvent = `< -> > [Loaded Player Event] <${file.split(".")[0]}>`;
    parseLog(txtEvent);
    player.events.on(file.split(".")[0], (...args) => PlayerEvent(...args));
    delete require.cache[require.resolve(`./events/Player/${file}`)];
  }

  readdirSync("./commands/").forEach((dirs) => {
    const commands = readdirSync(`./commands/${dirs}`).filter((files) =>
      files.endsWith(".js")
    );

    for (const file of commands) {
      try {
        const command = require(`./commands/${dirs}/${file}`);
        
        // Kiểm tra xem command có tồn tại và có thuộc tính name, description không
        if (command && command.name && command.description) {
          commandsArray.push(command);
          const txtEvent = `< -> > [Loaded Command] <${command.name.toLowerCase()}>`;
          parseLog(txtEvent);
          client.commands.set(command.name.toLowerCase(), command);
          delete require.cache[require.resolve(`./commands/${dirs}/${file}`)];
        } else {
          // Xử lý trường hợp command không hợp lệ
          const txtEvent = `< -> > [Failed Command] <${file}> - Missing name or description`;
          parseLog(txtEvent);
        }
      } catch (error) {
        // Xử lý lỗi khi require file
        const txtEvent = `< -> > [Error Loading Command] <${file}> - ${error.message}`;
        parseLog(txtEvent);
      }
    }
  });

  client.on("clientReady", (client) => {
    if (client.config.app.global)
      client.application.commands.set(commandsArray);
    else
      client.guilds.cache
        .get(client.config.app.guild)
        .commands.set(commandsArray);
  });

  async function parseLog(txtEvent) {
    console.log(await Translate(txtEvent, null));
  }
});