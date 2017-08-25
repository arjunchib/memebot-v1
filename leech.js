var Discord = require('discord.js')
var request = require('request')
var schedule = require('node-schedule')
var fs = require('fs')
var ArgumentParser = require('argparse').ArgumentParser
require('dotenv').config()

// ENVIRONMENT VARS
const DISCORD_LEECH_TOKEN = process.env.DISCORD_LEECH_TOKEN

// CONSTANTS
const client = new Discord.Client()

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
  schedule.scheduleJob('0 * * * *', syncMemes)
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
    console.log(err)
  }
})

client.on('disconnect', (event) => {
  console.log('Memebot disconnect')
})

client.login(DISCORD_LEECH_TOKEN)

// SYNC MEMES
function syncMemes () {
  request
    .get({url: 'http://teamloser.xyz:3000/memes/', json: true},
    function (err, res, body) {
      if (err) {
        debug('Failed to sync memes')
        console.log(err)
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
        debug('Downloaded ' + memesDownloaded + ' memes')
        debug('Synced memes')
        saveMemes()
      }
    })
}

function downloadMeme (meme) {
  request
    .get('http://teamloser.xyz:3000/meme/' + meme['name'] + '/audio')
    .on('error', function (err) {
      console.log(err)
    })
    .pipe(fs.createWriteStream('audio-leech/' + meme['file']))
}

// LIST
function list (message, words) {
  let names = '```'
  let list = []

  if (words.length > 1) {
    if (words[1] === 'least') {
      memes.sort(compareMemesLeastPlayed)
    } else if (words[1] === 'most') {
      memes.sort(compareMemesMostPlayed)
    } else if (words[1] === 'newest') {
      memes.sort(compareMemesNewest)
    } else if (words[1] === 'oldest') {
      memes.sort(compareMemesOldest)
    } else {
      displayErrorText(message)
      return
    }
  } else {
    memes.sort(compareMemesMostPlayed)
  }

  for (let i = 0; i < memes.length; i++) {
    if (!memes[i]['archived']) {
      list.push(memes[i]['name'])
    }
  }

  for (let i = 0; i < list.length; i++) {
    let memeName = list[i]
    if (names.length + memeName.length + 2 <= 1999) {
      names += memeName
      names += ', '
    }
  }

  if (names.length > 1999) {
    names = names.substring(0, 1999)
  }
  if (names.length > 3) {
    names = names.substring(0, names.length - 2) + '```'
  } else {
    names = '```No memes :\'(```'
  }

  message.channel.send(names)
}

// HELP
function help (message) {
  const helpText =
  '```![meme]  \nPlays an audio meme on your currently connected voice channel.\n\n!list [most/least/newest/oldest]\nA list of memes. If no modifier is given, the list defaults to unarchived memes ordered by the most times played.\n\n!random\nPlays a random meme.\n\n!help \nThis message.```'
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
    message.channel.send('Could not find meme by name: ' + words[0])
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
        console.log(e)
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

function compareMemesMostPlayed (a, b) {
  return b['playCount'] - a['playCount']
}

function compareMemesLeastPlayed (a, b) {
  return a['playCount'] - b['playCount']
}

function compareMemesNewest (a, b) {
  return new Date(b['dateAdded']) - new Date(a['dateAdded'])
}

function compareMemesOldest (a, b) {
  return new Date(a['dateAdded']) - new Date(b['dateAdded'])
}

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
