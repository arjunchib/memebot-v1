var Discord = require('discord.js')
var onExit = require('signal-exit')
var push = require('pushover-notifications')
var schedule = require('node-schedule')

// Environment variables
require('dotenv').config()
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const PUSHOVER_USER = process.env.PUSHOVER_USER
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN
const DEFAULT_CHANNEL_ID = process.env.DEFAULT_CHANNEL_ID

// Models
const Meme = require('./models/meme.js')

// Controllers
const add = require('./controllers/add.js')
const alias = require('./controllers/alias.js')
const help = require('./controllers/help.js')
const info = require('./controllers/info.js')
const list = require('./controllers/list.js')
const play = require('./controllers/play.js')
const random = require('./controllers/random.js')
const remove = require('./controllers/remove.js')
const stats = require('./controllers/stats.js')
const tag = require('./controllers/tag.js')
const volume = require('./controllers/volume.js')

// Helpers
const logger = require('./helpers/logger.js')
const io = require('./helpers/io.js')
const util = require('./helpers/util.js')

// Variables
const client = new Discord.Client()
const defaultChannel = client.channels.find('id', DEFAULT_CHANNEL_ID)
var meta = io.readJSON('data/meta.json') || Object.create(null)

// Push notifications
var pushover
if (PUSHOVER_USER && PUSHOVER_TOKEN) {
  pushover = new push({ // eslint-disable-line
    user: PUSHOVER_USER,
    token: PUSHOVER_TOKEN,
    onerror: function (err) {
      logger.error(err)
    }
  })
}

// Server events
schedule.scheduleJob('5 * * * *', function () {
  logger.info('Starting sheduled hourly job')

  // Data
  meta = io.readJSON('data/meta.json') || Object.create(null)
  let counts = io.readJSON('data/counts.json') || Object.create(null)

  // Update counts
  for (let name in counts) {
    if (counts.hasOwnProperty(name)) {
      let meme = Meme.findByName(name)
      let count = counts[name]
      logger.info(count)
      if (meme == null) {
        logger.warn(`Could not count plays of meme ${name} as it does not exist`)
        continue
      }
      meme.setPlayCount(count)
      meme.save()
    }
  }

  // Finish
  logger.info('Finished updating counts')
})

onExit(function (code, signal) {
  logger.info('Exiting')
})

client.on('ready', () => {
  logger.info('Server ready')
})

client.on('disconnect', (event) => {
  logger.warn('Server disconnected')
})

client.on('error', (err) => {
  logger.error(err)
})

client.on('message', message => {
  try {
    if (message == null || message.content.substring(0, 1) !== '!' || message.content.length <= 1) {
      return
    }
    message.content = util.trimWhitespace(message.content)
    let words = message.content.substring(1).split(' ')
    let command = words[0].toLowerCase()
    if (command === 'add') {
      add(message, words)
    } else if (command === 'delete') {
      remove(message, words)
    } else if (command === 'list') {
      list(message, words)
    } else if (command === 'help') {
      help(message)
    } else if (command === 'random') {
      random(message, words, defaultChannel)
    } else if (command === 'info') {
      info(message, words)
    } else if (command === 'volume') {
      volume(message, words)
    } else if (command === 'alias' || command === 'unalias') {
      alias(message, words)
    } else if (command === 'stats') {
      stats(message, meta)
    } else if (command === 'tag' || command === 'untag') {
      tag(message, words)
    } else if (command === 'airhorn' || command === 'mb') {
      return
    } else {
      play(message, words, defaultChannel)
    }
  } catch (err) {
    logger.error(err)
    if (pushover) {
      let msg = {
        message: 'Memebot has encountered a problem!',
        title: 'Memebot',
        sound: 'gamelan',
        device: 'iphone',
        priority: 1
      }
      pushover.send(msg, function (err, result) {
        if (err) {
          logger.error(err)
          return
        }
        logger.info(result)
      })
    }
  }
})

// Start server
client.login(DISCORD_TOKEN)
