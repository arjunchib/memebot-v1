const logger = require('../helpers/logger.js')
const Meme = require('../models/meme.js')

module.exports = function (message, meta) {
  logger.info(`${message.author.username} requested meme stats`)

  // Stats text
  let statsText =
`\`\`\`
Active guilds: ${meta.totalGuilds}
Number of memes played: ${meta.totalMemesPlayed}
Number of memes: ${Meme.count()}
Last Updated: ${meta.lastCountedAt}
\`\`\``

  // Send message
  message.channel.send(statsText)
}
