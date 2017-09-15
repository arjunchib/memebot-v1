var Discord = require('discord.js')
var schedule = require('node-schedule')
var fs = require('fs')
var stringSimilarity = require('string-similarity')
var ArgumentParser = require('argparse').ArgumentParser
require('dotenv').config()
var lockFile = require('lockfile')
var onExit = require('signal-exit')

// ENVIRONMENT VARS
const DISCORD_LEECH_TOKEN = process.env.DISCORD_LEECH_TOKEN

// CONSTANTS
const client = new Discord.Client()

// GLOBALS
var memes = readJSON('memes.json')
var stats = {}
var isPlaying = {}
var debugMode = false

// ARGUMENT PARSER
var parser = new ArgumentParser({
  version: '0.1',
  addHelp: true,
  description: 'A Discord bot that only plays memes'
})
parser.addArgument(
  [ '-d', '--debug' ],
  {
    help: 'Enables logging to the console',
    action: 'storeTrue'
  }
)
var args = parser.parseArgs()
debugMode = args.debug

// CREATE DIRS
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs')
}

// EXIT
onExit(function (code, signal) {
  syncSync()
  console.log('Killing memebot')
})

// DISCORD SERVER
client.on('ready', () => {
  console.log('Memebot ready')
  schedule.scheduleJob('10 * * * *', sync)
})

client.on('message', message => {
  try {
    if (message == null || message.content.substring(0, 1) !== '!' || message.content.length <= 1) {
      return
    }
    message.content = trimWhitespace(message.content)
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
    debug('Memebot crashed')
    console.error(err)
  }
})

client.on('guildCreate', guild => {
  if (stats['guilds']) {
    stats['guilds'] += 1
  } else {
    stats['guilds'] = 1
  }
  debug('Added to new guild')
})

client.on('disconnect', (event) => {
  console.log('Memebot disconnect')
})

client.login(DISCORD_LEECH_TOKEN)

// SYNC
function sync () {
  var opts = {
    wait: 10000
  }
  lockFile.lock('stats.json.lock', opts, function (err) {
    if (err) {
      console.error(err)
      return
    }
    var savedStats = {}
    if (fs.existsSync('stats.json')) {
      savedStats = JSON.parse(fs.readFileSync('stats.json', 'utf8'))
    }
    savedStats = updateStats(savedStats)
    saveStats(savedStats)
    lockFile.unlock('stats.json.lock', function (err) {
      if (err) {
        fs.appendFile('logs/stats-crash.log', JSON.stringify(stats, null, 2), function (err) {
          if (err) console.error(err)
        })
        console.error(err)
      } else {
        stats = {}
      }
    })
  })
}

function syncSync () {
  lockFile.lockSync('stats.json.lock')
  var savedStats = {}
  if (fs.existsSync('stats.json')) {
    savedStats = JSON.parse(fs.readFileSync('stats.json', 'utf8'))
  }
  savedStats = updateStats(savedStats)
  fs.writeFileSync('stats.json', JSON.stringify(savedStats, null, 2))
  fs.writeFile('stats-backup.json', JSON.stringify(savedStats, null, 2))
  lockFile.unlockSync('stats.json.lock')
  stats = {}
}

function updateStats (savedStats) {
  Object.keys(stats).forEach(function (statName) {
    if (statName === 'guilds') {
      if (savedStats.hasOwnProperty('guilds')) {
        savedStats['guilds'] += stats['guilds']
      } else {
        savedStats['guilds'] = stats['guilds']
      }
    } else if (statName === 'counts') {
      if (!savedStats['counts']) {
        savedStats['counts'] = {}
      }
      Object.keys(stats['counts']).forEach(function (meme) {
        if (!savedStats['counts'][meme]) {
          savedStats['counts'][meme] = 0
        }
        savedStats['counts'][meme] += stats['counts'][meme]
      })
    }
  })
  return savedStats
}

// LIST
function list (message, words) {
  var names = ['```']
  var listIndex = 0
  var wordCount = 3

  memes.sort(compareMemes)

  for (let i = 0; i < memes.length; i++) {
    if (!memes[i]['archived']) {
      wordCount += memes[i]['name'].length
      if (wordCount > 1997) {
        names[listIndex] = names[listIndex].substring(0, names[listIndex].length - 2) + '```'
        listIndex += 1
        names[listIndex] = '```'
        wordCount = 3 + memes[i]['name'].length
      }
      names[listIndex] += memes[i]['name']
      names[listIndex] += ', '
      wordCount += 2
    }
  }

  names[listIndex] = names[listIndex].substring(0, names[listIndex].length - 2) + '```'

  for (let i = 0; i < names.length; i++) {
    message.channel.send(names[i])
  }
}

// HELP
function help (message) {
  const helpText =
  '```!mb [meme]  \nPlays an audio meme on your currently connected voice channel.\n\n!mb list\nA list of memes from newest to oldest.\n\n!mb random\nPlays a random meme.\n\n!mb help \nThis message.```'
  message.channel.send(helpText)
}

// RANDOM
function random (message, words) {
  if (message.member == null || message.member.voiceChannel == null) {
    message.channel.send('You must join a voice channel to play the dank memes')
    return
  }
  let randomIndex = Math.floor(Math.random() * memes.length)
  if (memes[randomIndex]['archived']) {
    random(message, words)
  } else {
    if (!isPlaying) {
      message.channel.send('Playing ' + memes[randomIndex]['name'])
    }
    playMeme(memes[randomIndex], message.member.voiceChannel, true)
  }
}

// PLAY
function play (message, words) {
  if (message.member == null || message.member.voiceChannel == null) {
    message.channel.send('You must join a voice channel to play the dank memes')
    return
  }
  let memeInput = words[0]
  if (words[0].length === 0 && words.length > 1) {
    memeInput = words[1]
  }
  if (memeInput == null) {
    displayErrorText(message)
    return
  }
  let index = findIndexByCommand(memeInput)
  if (index === -1 || memes[index]['archived']) {
    var commands = []
    for (let i = 0; i < memes.length; i++) {
      commands = commands.concat(memes[i]['commands'])
    }
    var matches = stringSimilarity.findBestMatch(memeInput, commands)
    message.channel.send('Could not find meme by name: `' + words[0] + '`\nDid you mean: `' + matches['bestMatch']['target'] + '`?')
    return
  }
  let meme = memes[index]
  playMeme(meme, message.member.voiceChannel, false)
  if (!stats['counts']) {
    stats['counts'] = {}
  }
  if (stats['counts'][meme['name']]) {
    stats['counts'][meme['name']] += 1
  } else {
    stats['counts'][meme['name']] = 1
  }
}

function playMeme (meme, voiceChannel, isRandom) {
  let file = meme['file']
  let audioMod = meme['audioModifier']
  if (!isPlaying.hasOwnProperty(voiceChannel.id) ||
      !isPlaying[voiceChannel.id]) {
    isPlaying[voiceChannel.id] = true
    voiceChannel.join()
      .then(connection => {
        if (isRandom) {
          debug('Randomly playing ' + file)
        } else {
          debug('Playing ' + file)
        }
        const dispatcher = connection.playFile('audio/' + file, {
          volume: 0.50 * audioMod
        })
        dispatcher.on('end', () => {
          debug('Stopped playing ' + file)
          voiceChannel.leave()
          isPlaying[voiceChannel.id] = false
        })
      })
      .catch(function (e) {
        if (isRandom) {
          debug('Failed to randomly play ' + file)
        } else {
          debug('Failed to play ' + file)
        }
        voiceChannel.leave()
        console.error(e)
      })
  }
}

// HELPERS
function displayErrorText (message) {
  let errorText =
  'You did something wrong.\nType **!help** my adult son.'
  message.channel.send(errorText)
}

function trimWhitespace (str) {
  return str.replace(/\s+/g, ' ').trim()
}

function findIndexByCommand (inputCommand) {
  if (!inputCommand) {
    return -1
  }
  for (let i = 0; i < memes.length; i++) {
    let meme = memes[i]
    for (let j = 0; j < meme['commands'].length; j++) {
      let command = meme['commands'][j]
      if (inputCommand.toLowerCase() === command.toLowerCase()) {
        return i
      }
    }
  }
  return -1
}

function compareMemes (a, b) {
  return a['name'].toLowerCase().localeCompare(b['name'].toLowerCase())
}

// function compareMemesNewest (a, b) {
//   return new Date(b['dateAdded']) - new Date(a['dateAdded'])
// }

// function compareMemesOldest (a, b) {
//   return new Date(a['dateAdded']) - new Date(b['dateAdded'])
// }

function saveStats (totalStats) {
  fs.writeFile('stats.json', JSON.stringify(totalStats, null, 2), (err) => {
    if (err) throw err
    debug('Saved stats.json')
  })
  fs.writeFile('stats-backup.json', JSON.stringify(totalStats, null, 2), (err) => {
    if (err) throw err
  })
}

function readJSON (file) {
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } else {
    return []
  }
}

// DEBUG
function debug (msg) {
  if (debugMode) {
    console.log(msg)
  }
  let d = new Date()
  let timeString = d.getFullYear() + '-' + formatTime(d.getMonth() + 1) + '-' + formatTime(d.getDate()) + ' ' + formatTime(d.getHours()) + ':' + formatTime(d.getMinutes()) + ':' + formatTime(d.getSeconds())
  msg = '[' + timeString + '] ' + msg + '\n'
  fs.appendFile('logs/debug-leech.log', msg, function (err) {
    if (err) {
      return console.log(err)
    }
  })
}

function formatTime (time) {
  if (time <= 9) {
    time = '0' + time
  }
  return time
}
