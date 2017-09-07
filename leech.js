var Discord = require('discord.js')
var request = require('request')
var schedule = require('node-schedule')
var fs = require('fs')
var stringSimilarity = require('string-similarity')
var ArgumentParser = require('argparse').ArgumentParser
require('dotenv').config()

// ENVIRONMENT VARS
const DISCORD_LEECH_TOKEN = process.env.DISCORD_LEECH_TOKEN

// CONSTANTS
const client = new Discord.Client()
const baseURL = 'https://memebot.solutions:3000/api'

// GLOBALS
var memes = readJSON('memes-leech.json')
var isPlaying = false
var blockedFile = null
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
if (!fs.existsSync('audio-leech')) {
  fs.mkdirSync('audio-leech')
}
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs')
}

// DISCORD SERVER
client.on('ready', () => {
  console.log('Memebot ready')
  syncMemes()
  schedule.scheduleJob('* * * * *', syncMemes)
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
  debug('Added to new guild')
})

client.on('disconnect', (event) => {
  console.log('Memebot disconnect')
})

client.login(DISCORD_LEECH_TOKEN)

// SYNC MEMES
function syncMemes () {
  syncStats()
  request
    .get({url: baseURL + '/memes/', json: true},
    function (err, res, body) {
      if (err) {
        debug('Failed to sync memes')
        console.error(err)
        return
      }
      if (res && (res.statusCode === 200 || res.statusCode === 201)) {
        var newMemes = body
        var memesDownloaded = 0
        for (var i = 0; i < memes.length; i++) {
          var found = false
          for (var j = 0; j < newMemes.length; j++) {
            if (memes[i]['name'] === newMemes[j]['name']) {
              found = true
              if (memes[i]['file'] !== newMemes[j]['file'] ||
                  memes[i]['dateAdded'] !== newMemes[j]['dateAdded']) {
                downloadMeme(memes[i])
                memesDownloaded += 1
              }
              memes[i] = newMemes[j]
              break
            }
          }
          if (!found) {
            deleteMemeByIndex(i)
          }
        }
        for (i = 0; i < newMemes.length; i++) {
          found = false
          for (j = 0; j < memes.length; j++) {
            if (newMemes[i]['name'] === memes[j]['name']) {
              found = true
              break
            }
          }
          if (!found) {
            memes.push(newMemes[i])
            downloadMeme(newMemes[i])
            memesDownloaded += 1
          }
        }
        if (memesDownloaded > 0) {
          debug('Downloaded ' + memesDownloaded + ' memes')
        }
        saveMemes()
      }
    })
}

function downloadMeme (meme) {
  request
    .get(baseURL + '/meme/' + meme['name'] + '/audio')
    .on('error', function (err) {
      console.error(err)
      debug('Download failed for meme: ' + meme['name'])
    })
    .pipe(fs.createWriteStream('audio-leech/' + meme['file']))
}

function syncStats () {
  var counts = []
  for (let i = 0; i < memes.length; i++) {
    if (memes[i]['playCount'] > 0) {
      counts.push({
        name: memes[i]['name'],
        playCount: memes[i]['playCount']
      })
    }
  }

  var options = {
    uri: baseURL + '/memes/playCount',
    method: 'POST',
    json: counts
  }

  request
    .patch(options)
    .on('error', function (err) {
      console.error(err)
      debug('Syncing stats failed')
    })
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
}

function playMeme (meme, voiceChannel, isRandom) {
  let file = meme['file']
  let audioMod = meme['audioModifier']
  if (!isPlaying && file !== blockedFile) {
    isPlaying = true
    voiceChannel.join()
      .then(connection => {
        if (isRandom) {
          debug('Randomly playing ' + file)
        } else {
          debug('Playing ' + file)
        }
        const dispatcher = connection.playFile('audio-leech/' + file, {
          volume: 0.50 * audioMod
        })
        dispatcher.on('end', () => {
          debug('Stopped playing ' + file)
          voiceChannel.leave()
          isPlaying = false
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

function deleteMemeByIndex (index) {
  let file = memes[index]['file']
  memes.splice(index, 1)
  saveMemes()
  try {
    fs.unlinkSync('audio-leech/' + file)
  } catch (err) {
    debug('Failed to delete ' + file)
    console.log(err)
  }
  debug('Deleted ' + file)
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

function saveMemes () {
  memes.sort(compareMemes)
  fs.writeFileSync('memes-leech.json', JSON.stringify(memes, null, 2))
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
