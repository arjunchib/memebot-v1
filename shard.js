const { ShardingManager } = require('discord.js')
const LineByLineReader = require('line-by-line')
const fs = require('fs')
const schedule = require('node-schedule')

// Load environment variables
require('dotenv').config()

// Helpers
const logger = require('./helpers/logger.js')
const io = require('./helpers/io.js')

// Setup
if (!fs.existsSync('logs')) { fs.mkdirSync('logs') }
if (!fs.existsSync('data')) { fs.mkdirSync('data') }

// Config logger
logger.config('shard')

// Module variables
const DISCORD_LEECH_TOKEN = process.env.DISCORD_LEECH_TOKEN
const manager = new ShardingManager('leech.js', { token: DISCORD_LEECH_TOKEN })
var meta = io.readJSON('data/meta.json') || Object.create(null)
var counts = io.readJSON('data/counts.json') || Object.create(null)

// Sharding events
schedule.scheduleJob('0 * * * *', function () {
  logger.info('Starting sheduled hourly job')

  // Set meta data defaults
  if (meta.totalGuilds == null) { meta.totalGuilds = 0 }
  if (meta.firstUnreadCountByte == null) { meta.firstUnreadCountByte = 0 }
  if (meta.totalMemesPlayed == null) { meta.totalMemesPlayed = 0 }

  // Get total guilds
  manager.fetchClientValues('guilds.size')
  .then(results => {
    meta.totalGuilds = results.reduce((prev, val) => prev + val, 0)
    logger.info(`${meta.totalGuilds} total guilds`)
  })
  .catch(logger.error)

  let lr = new LineByLineReader('logs/play.log', {
    start: meta.firstUnreadCountByte
  })

  lr.on('error', function (err) {
    logger.error(err)
  })

  lr.on('line', function (line) {
    let play = JSON.parse(line)
    let name = play['meme_name']
    if (counts[name] == null) { counts[name] = 0 }
    counts[name] += 1
    meta.firstUnreadCountByte += Buffer.byteLength(line + '\n', 'utf8')
    meta.totalMemesPlayed++
  })

  lr.on('end', function () {
    // Set timestamp
    meta.lastCountedAt = new Date()

    // Save meta data and counts
    io.saveJSON(counts, 'data/counts.json')
    io.saveJSON(meta, 'data/meta.json')

    // log
    logger.info('Finished updating counts')
  })
})

// Launch shard event
manager.on('launch', function (shard) {
  logger.info('Successfully launched shard ' + shard.id)
})

// Start sharder
manager.spawn()
