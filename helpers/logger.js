var dateFormat = require('dateformat')
var fs = require('fs')

// Environment varaibles
const DEBUG_LEVEL = process.env.DEBUG_LEVEL

// Setup
if (!fs.existsSync('logs')) { fs.mkdirSync('logs') }

// Streams
var playStream = fs.createWriteStream('logs/play.log', {flags: 'a'})
var debugStream = fs.createWriteStream('logs/debug.log', {flags: 'a'})

// Log level enum
const level = Object.freeze({
  'ERROR': 1,
  'WARN': 2,
  'INFO': 3,
  properties: {
    1: {name: 'ERROR', value: 0},
    2: {name: 'WARN', value: 1},
    3: {name: 'INFO', value: 2}
  }
})

module.exports = {
  config: function (name) {
    if (name != null) {
      let filename = ['logs/debug-', name, '.log'].join('')
      debugStream = fs.createWriteStream(filename, {flags: 'a'})
    }
  },
  error: function (err) {
    writeConsole(err, level.ERROR)
    console.trace()
    writeDebug(err.message, level.ERROR)
  },
  warn: function (msg) {
    writeConsole(msg, level.WARN)
    writeDebug(msg, level.WARN)
  },
  info: function (msg) {
    writeConsole(msg, level.INFO)
    writeDebug(msg, level.INFO)
  },
  play: function (meme, message, isRandom) {
    writePlay(meme, message, isRandom)
  }
}

function writeConsole (msg, lvl) {
  let now = dateFormat(new Date(), 'isoDateTime')
  msg = [`[${now}]`, level.properties[lvl].name, msg].join(' ')
  switch (lvl) {
    case level.ERROR:
    case level.WARN:
      if (DEBUG_LEVEL >= level.properties[lvl].value) { console.error(msg) }
      break
    case level.INFO:
      if (DEBUG_LEVEL >= level.properties[lvl].value) { console.log(msg) }
      break
  }
}

function writeDebug (msg, lvl) {
  let now = dateFormat(new Date(), 'isoDateTime')
  msg = [`[${now}]`, level.properties[lvl].name, msg].join(' ')
  debugStream.write(msg + '\n')
}

function writePlay (meme, message, isRandom) {
  let channelName = message.channel.name
  if (channelName == null) { channelName = message.member.channel.type }
  let msg = {
    'played_at': dateFormat(message.createdAt, 'isoDateTime'),
    'is_random': isRandom,
    'meme_name': meme.get('name'),
    'author_username': message.author.username,
    'author_id': message.author.id,
    'guild_name': message.member.guild.name,
    'guild_id': message.member.guild.id,
    'channel_name': channelName,
    'channel_id:': message.channel.id,
    'member_name': message.member.displayName,
    'memeber_id': message.member.id,
    'message_content': message.cleanContent
  }
  playStream.write(JSON.stringify(msg) + '\n')
}
