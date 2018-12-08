var Discord = require('discord.js')
var onExit = require('signal-exit')
const schedule = require('node-schedule')

// Environment variables
require('dotenv').config()
const DISCORD_LEECH_TOKEN = process.env.DISCORD_LEECH_TOKEN

// Models
const Meme = require('./models/meme.js')

// Controllers
const list = require('./controllers/list.js')
const random = require('./controllers/random.js')
const play = require('./controllers/play.js')

// Helpers
const logger = require('./helpers/logger.js')
const util = require('./helpers/util.js')

// Variables
const client = new Discord.Client()

// Configure logger
logger.config('leech-' + client.shard.id)

// Server events
onExit(function (code, signal) {
  logger.info('Shuting down server')
})

client.on('ready', () => {
  logger.info('Server ready')
})

client.on('guildCreate', guild => {
  logger.info('Added to new guild')
})

client.on('disconnect', (event) => {
  logger.warn('Server disconnected')
})

client.on('error', (error) => {
  logger.error(error)
})

client.on('message', message => {
  try {
    if (message == null || message.content.substring(0, 1) !== '!' || message.content.length <= 1) {
      return
    }
    message.content = util.trimWhitespace(message.content)
    let words = message.content.substring(1).split(' ')
    if (words[0] === 'mb') {
      words.splice(0, 1)
      if (words.length <= 0) {
        help(message)
        return
      }
    } else {
      return
    }
    let command = words[0].toLowerCase()
    if (command === 'list') {
      list(message, words)
    } else if (command === 'help') {
      help(message)
    } else if (command === 'random') {
      random(message, words)
    } else if (command === 'airhorn') {
      return
    } else {
      play(message, words)
    }
  } catch (err) {
    logger.error(err)
  }
})

// Start server
client.login(DISCORD_LEECH_TOKEN)

// Repopulate meme cache every 10 minutes
schedule.scheduleJob('*/10 * * * *', function () {
  logger.info('Repopulating meme cache')
  Meme.repopulate()
})

// Display help message
function help (message) {
  const helpText = `\`\`\`
!mb [meme]
Plays an audio meme on your currently connected voice channel.

!mb list
A list of memes from newest to oldest.

!mb random
Plays a random meme.

!mb help
This message.
\`\`\``
  message.channel.send(helpText)
}
