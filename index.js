var Discord = require('discord.js')
var fs = require('fs')
var ytdl = require('ytdl-core')
var ffmpeg = require('fluent-ffmpeg')
var push = require('pushover-notifications')

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const PUSHOVER_USER = process.env.PUSHOVER_USER
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN

const client = new Discord.Client()
const reservedWords = ['add', 'delete', 'list', 'help', 'random', 'info', 'airhorn', 'vote', 'naturalize', 'volume']

var memes = JSON.parse(fs.readFileSync('memes.json', 'utf8'))
var citizens = JSON.parse(fs.readFileSync('citizens.json', 'utf8'))
var debugMode = true
var isPlaying = false
var blockedFile = null
var pushover

// PUSH NOTIFICATIONS
if (PUSHOVER_USER && PUSHOVER_TOKEN) {
  pushover = new push({ // eslint-disable-line
    user: PUSHOVER_USER,
    token: PUSHOVER_TOKEN,
    onerror: function (error) {
      console.log(error)
    }
  })
}

// MAIN LOOP
client.on('ready', () => {
  console.log('Memebot ready')
})

client.on('message', message => {
  try {
    if (message == null || message.content.substring(0, 1) !== '!' || message.content.length <= 1) {
      return
    }
    message.content = trimWhitespace(message.content)
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
      random(message, words)
    } else if (command === 'info') {
      info(message, words)
    } else if (command === 'naturalize') {
      naturalize(message, words)
    } else if (command === 'volume') {
      volume(message, words)
    } else if (command === 'vote') {
      vote(message, words)
    } else if (command === 'airhorn') {
      return
    } else {
      play(message, words)
    }
  } catch (err) {
    console.log(err)
    if (pushover) {
      let msg = {
        message: 'Memebot has fallen and can\'t get up',
        title: 'Memebot',
        sound: 'gamelan',
        device: 'iphone',
        priority: 1
      }
      pushover.send(msg, function (err, result) {
        if (err) throw err
        console.log(result)
        process.exit(0)
      })
    }
  }
})

// ADD
function add (message, words) {
  if (words.length < 5) {
    displayErrorText(message)
    return
  }

  let stream = ytdl(words[1])
  let startTime = words[2]
  let endTime = words[3]

  let commands = []
  for (let i = 4; i < words.length; i++) {
    commands.push(words[i].replace(',', ''))
  }

  for (let i = 0; i < commands.length; i++) {
    for (let j = 0; j < reservedWords.length; j++) {
      if (commands[i].toLowerCase() === reservedWords[j].toLowerCase()) {
        message.channel.send('The command **' + commands[i] + '** is a reserved word. Please use a different name.')
        debug(message.author.username + ' tried to add the ' + commands[i] + ' command which is a reserved word')
      }
    }
  }

  for (let i = 0; i < memes.length; i++) {
    for (let j = 0; j < memes[i]['commands'].length; j++) {
      for (let k = 0; k < commands.length; k++) {
        if (memes[i]['commands'][j].toLowerCase() === commands[k].toLowerCase()) {
          message.channel.send('The command **' + commands[k] + '** already exists! Please delete it first.')
          debug(message.author.username + ' tried to add the ' + commands[k] + ' command which already exists')
          return
        }
      }
    }
  }

  let endSeekOption = '-to ' + endTime
  let filePath = makeFilePath('audio/', commands[0], '.mp3')

  blockedFile = commands[0] + '.mp3'
  ffmpeg(stream)
  .noVideo()
  .seekOutput(startTime)
  .format('mp3')
  .outputOptions(['-write_xing 0', endSeekOption])
  .save(filePath)
  .on('end', function (err, stdout, stderr) {
    if (err) {
      console.log('Cannot process video: ' + err.message)
    }
    blockedFile = null
  })
  .on('error', function (err, stdout, stderr) {
    console.log('Cannot process video: ' + err.message)
    debug(message.author.username + ' induced an ffmpeg error')
  })

  let d = new Date()
  let meme = {
    name: commands[0],
    author: message.author.username,
    authorID: message.author.id,
    commands: commands,
    file: filePath.substring(6),
    dateAdded: d.toJSON(),
    lastPlayed: d.toJSON(),
    audioModifier: 1,
    playCount: 0
  }
  memes.push(meme)
  saveMemes()
  message.channel.send('Added ' + commands[0])
  debug(message.author.username + ' added ' + filePath.substring(6))
}

// REMOVE
function remove (message, words) {
  let index = findIndexByCommand(words[1])
  if (index === -1) {
    message.channel.send('Could not find meme by name: ' + words[1])
    displayErrorText(message)
    return
  }
  if (hasAccess(memes[index], message.author)) {
    deleteMemeByIndex(index)
    message.channel.send('Deleted ' + words[1])
  } else {
    message.channel.send('Only the author may delete memes. Vote for a deletion with the !vote command.')
  }
}

// LIST
function list (message, words) {
  let names = '```'
  let list = []
  let isAll = false
  let isArchived = false
  let isVoting = false

  if (words.length > 1) {
    if (words[1] === 'least') {
      memes.sort(compareMemesLeastRecent)
    } else if (words[1] === 'most') {
      memes.sort(compareMemesMostRecent)
    } else if (words[1] === 'newest') {
      memes.sort(compareMemesNewest)
    } else if (words[1] === 'oldest') {
      memes.sort(compareMemesOldest)
    } else if (words[1] === 'all') {
      isAll = true
    } else if (words[1] === 'archived' || words[1] === 'archives' || words[1] === 'archive') {
      isArchived = true
    } else if (words[1] === 'vote' || words[1] === 'voting' || words[1] === 'votes') {
      isVoting = true
    } else {
      displayErrorText(message)
      return
    }
  } else {
    memes.sort(compareMemesMostRecent)
  }

  if (!isVoting) {
    for (let i = 0; i < memes.length; i++) {
      if (isAll || isArchived === memes[i]['archived']) {
        list.push(memes[i]['name'])
      }
    }
  } else {
    for (let i = 0; i < citizens.length; i++) {
      for (let vote in citizens[i]['votes']) {
        list.push(vote)
      }
    }
    list = removeDuplicates(list)
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
  '```![meme]  \nPlays an audio meme on your currently connected voice channel.\n\n!list [most/least/newest/oldest/archives/votes/all]\nA list of memes. If no modifier is given, the list defaults to unarchived memes ordered by the most times played.\n\n!add [youtube link] [start time] [end time] [command 1, command 2, ...]\nAdds a meme from a youtube video, pulling audio from the start time to the end time. The name of the first command becomes the name of the meme. Start time and end time can take in seconds, hh:mm:ss format, and even decimals.\n\nEx. !add https://www.youtube.com/watch?v=6JaY3vtb760 2:31 2:45.5 Caveman shaggy scooby\n\n!delete [meme]\nDeletes the meme that with this name, if you were the person who added it.\n\n!random\nPlays a random meme.\n\n!info [meme]\nDisplays stats and alternate commands for a meme.\n\n!volume [meme] [audio modifier]\nSets an audio modifier for the meme, such that 0.5 is half the normal volume and 2.0 is twice the normal volume. Only the person who added the meme may change its volume.\n\n!vote [meme] [keep/remove/abstain]\nAllows you to vote for a meme\'s archival. You must be a citizen to vote. The meme will be activated/deactivated once it has recieved over 50% approval.\n\n!help \nThis message.```'
  message.channel.send(helpText)
}

// INFO
function info (message, words) {
  let memeInput = words[1]
  if (memeInput == null) {
    displayErrorText(message)
    return
  }
  let index = findIndexByCommand(memeInput)
  if (index === -1) {
    message.channel.send('Could not find meme by name: ' + words[1])
    return
  }
  let meme = memes[index]
  let output = '```name: ' + meme['name'] + '\ncommands: '
  for (let i = 0; i < meme['commands'].length; i++) {
    output += meme['commands'][i] + ', '
  }
  output = output.substring(0, output.length - 2)
  let dateLastPlayed = new Date(meme['lastPlayed'])
  let dateAdded = new Date(meme['dateAdded'])
  let status = meme['archived'] ? 'archived' : 'active'
  output += '\nauthor: ' + meme['author']
  output += '\nlast played: ' + dateLastPlayed.toString()
  output += '\ndate added: ' + dateAdded.toDateString()
  output += '\naudio modifier: ' + meme['audioModifier']
  output += '\nplay count: ' + meme['playCount']
  output += '\nstatus: ' + status + '```'
  message.channel.send(output)
}

// RANDOM
function random (message, words) {
  if (message.member.voiceChannel == null) {
    message.channel.send('You must join a voice channel to play the dank memes')
    return
  }
  let randomIndex = Math.floor(Math.random() * memes.length)
  if (memes[randomIndex]['archived']) {
    random(message, words)
  } else {
    playMeme(memes[randomIndex], message.member.voiceChannel)
    message.channel.send('Playing ' + memes[randomIndex]['name'])
  }
}

// VOLUME
function volume (message, words) {
  if (words.length < 3) {
    displayErrorText(message)
    return
  }
  let memeInput = words[1]
  if (memeInput == null) {
    displayErrorText(message)
    return
  }
  let audioModifier = words[2]
  if (audioModifier == null || isNaN(audioModifier) || audioModifier < 0) {
    displayErrorText(message)
    return
  }
  let index = findIndexByCommand(memeInput)
  if (index === -1) {
    message.channel.send('Could not find meme by name: ' + words[1])
    return
  }
  if (hasAccess(memes[index], message.author)) {
    memes[index]['audioModifier'] = audioModifier
    saveMemes()
    message.channel.send('The audio modifier of ' + memeInput + ' has been set to: ' + audioModifier)
    debug('Audio modifier of ' + memes[index]['name'] + ' set to ' + audioModifier)
  } else {
    message.channel.send('Only the author may modify memes. Contact ' + memes[index]['author'] + ' to change volume.')
  }
}

// NATURALIZE
function naturalize (message, words) {
  let citizen = findCitizenByID(message.author.id)
  if (citizen == null) {
    citizen = {
      name: message.author.username,
      id: message.author.id,
      votes: {}
    }
    citizens.push(citizen)
    saveCitizens()
    message.channel.send('Welcome, ' + message.author.username + ' to the Council of Memes. May dankness guide your way.')
  } else {
    message.channel.send('You are already on the meme council you pleb')
  }
}

// VOTE
function vote (message, words) {
  if (words.length < 3) {
    displayErrorText(message)
    return
  }

  let index = findIndexByCommand(words[1])
  if (index === -1) {
    message.channel.send('Could not find meme by name: ' + words[1])
    displayErrorText(message)
    return
  }

  let citizen = findCitizenByID(message.author.id)
  if (citizen == null) {
    message.channel.send('You must naturalize to become a citizen of memebotopia')
    displayErrorText(message)
    return
  }

  let memeName = memes[index]['name']
  let memeArchived = memes[index]['archived']
  if (words[2] === 'for' || words[2] === 'yea') {
    if (memeArchived) {
      citizen['votes'][memeName] = 'keep'
    } else {
      citizen['votes'][memeName] = 'remove'
    }
  } else if (words[2] === 'against' || words[2] === 'nay') {
    if (!memeArchived) {
      citizen['votes'][memeName] = 'keep'
    } else {
      citizen['votes'][memeName] = 'remove'
    }
  } else if (words[2] === 'keep') {
    citizen['votes'][memeName] = 'keep'
  } else if (words[2] === 'remove') {
    citizen['votes'][memeName] = 'remove'
  } else if (words[2] === 'abstain') {
    citizen['votes'][memeName] = 'abstain'
  }

  let resolution = ''
  if (memeArchived) {
    resolution += '**Resolution to revive** ***' + memeName + '*** **and restore memebotopia to its former glory.**\n\n'
  } else {
    resolution += '**Resolution to remove** ***' + memeName + '*** **and restore memebotopia to its former glory.**\n\n'
  }

  let yeas = 0
  let nays = 0
  let abstains = 0
  let noVotes = 0
  for (let i = 0; i < citizens.length; i++) {
    let vote = citizens[i]['votes'][memeName]
    if ((vote === 'keep' && memeArchived) || (vote === 'remove' && !memeArchived)) {
      yeas += 1
    } else if ((vote === 'keep' && !memeArchived) || (vote === 'remove' && memeArchived)) {
      nays += 1
    } else if (vote === 'abstain') {
      abstains += 1
    } else {
      noVotes += 1
    }
  }

  resolution += ('yea: ' + yeas + '\n')
  resolution += ('nay: ' + nays + '\n')
  resolution += ('abstain: ' + abstains + '\n')
  resolution += ('no vote: ' + noVotes + '\n')

  if (nays >= citizens.length / 2) {
    resolution += '\nThe neas have it! The resolution is struck down.'
    clearVotes(memeName)
  } else if (yeas > citizens.length / 2) {
    resolution += '\nThe ayes have it! The resolution is passed.'
    memes[index]['archived'] = !memeArchived
    saveMemes()
    let result = memeArchived ? 'unarchived' : 'archived'
    let resultUpper = memeArchived ? 'Unarchived' : 'Archived'
    resolution += ' The meme, ' + memeName + ', has been ' + result + '.'
    debug(resultUpper + ' ' + memeName)
    clearVotes(memeName)
  } else if (yeas + nays >= citizens.length) {
    resolution += '\nGridlock! The resolution dies.'
    clearVotes(memeName)
  } else {
    let votesNeeded = (Math.floor(citizens.length / 2)) + 1 - yeas
    resolution += '\n' + votesNeeded + ' more yea(s) needed to pass this resolution.'
  }

  saveCitizens()
  message.channel.send(resolution)
}

// PLAY
function play (message, words) {
  if (message.member.voiceChannel == null) {
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
  if (index === -1) {
    message.channel.send('Could not find meme by name: ' + words[0])
    return
  }
  if (memes[index]['archived']) {
    message.channel.send('Cannot play archived meme: ' + words[0])
    return
  }
  let meme = memes[index]
  playMeme(meme, message.member.voiceChannel)
  let d = new Date()
  memes[index]['lastPlayed'] = d.toJSON()
  memes[index]['playCount'] += 1
  saveMemes()
}

function playMeme (meme, voiceChannel) {
  let file = meme['file']
  let audioMod = meme['audioModifier']
  if (!isPlaying && file !== blockedFile) {
    isPlaying = true
    voiceChannel.join()
      .then(connection => {
        debug('Playing ' + file)
        const dispatcher = connection.playFile('audio/' + file, {
          volume: 0.50 * audioMod
        })
        dispatcher.on('end', () => {
          debug('Stopped playing ' + file)
          voiceChannel.leave()
          isPlaying = false
        })
      })
      .catch(function (e) {
        console.log(e)
        console.log('hi')
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

function findCitizenByID (authorID) {
  for (let i = 0; i < citizens.length; i++) {
    if (citizens[i]['id'] === authorID) {
      return citizens[i]
    }
  }
  return null
}

function makeFilePath (path, fileName, extension) {
  let number = 0
  while (fs.existsSync(path + makeFileName(fileName, number) + extension)) {
    number++
  }
  return path + makeFileName(fileName, number) + extension
}

function makeFileName (fileName, number) {
  if (number === 0) {
    return fileName
  } else {
    return fileName + number
  }
}

function deleteMemeByIndex (index) {
  let file = memes[index]['file']
  memes.splice(index, 1)
  saveMemes()
  try {
    fs.unlinkSync('audio/' + file)
  } catch (err) {
    console.log(err)
  }
  debug('Deleted ' + file)
}

function clearVotes (memeName) {
  for (let i = 0; i < citizens.length; i++) {
    delete citizens[i]['votes'][memeName]
  }
  saveCitizens()
}

function compareMemes (a, b) {
  return a['name'].toLowerCase().localeCompare(b['name'].toLowerCase())
}

function compareMemesMostRecent (a, b) {
  return b['playCount'] - a['playCount']
}

function compareMemesLeastRecent (a, b) {
  return a['playCount'] - b['playCount']
}

function compareMemesNewest (a, b) {
  return new Date(b['dateAdded']) - new Date(a['dateAdded'])
}

function compareMemesOldest (a, b) {
  return b['dateAdded'] - a['dateAdded']
}

function compareCitizens (a, b) {
  return a['name'].toLowerCase().localeCompare(b['name'].toLowerCase())
}

function removeDuplicates (a) {
  return a.sort().filter(function (item, pos, ary) {
    return !pos || item !== ary[pos - 1]
  })
}

function hasAccess (meme, author) {
  return (author.id === '135936099011788800' || (meme['authorID'] != null && meme['authorID'] === author.id))
}

function saveMemes () {
  memes.sort(compareMemes)
  fs.writeFileSync('memes.json', JSON.stringify(memes, null, 2))
}

function saveCitizens () {
  citizens.sort(compareCitizens)
  fs.writeFileSync('citizens.json', JSON.stringify(citizens, null, 2))
}

// DEBUG
function debug (msg) {
  if (debugMode) {
    console.log(msg)
  }
  let d = new Date()
  let timeString = d.getFullYear() + '-' + formatTime(d.getMonth() + 1) + '-' + formatTime(d.getDate()) + ' ' + formatTime(d.getHours()) + ':' + formatTime(d.getMinutes()) + ':' + formatTime(d.getSeconds())
  msg = '[' + timeString + '] ' + msg + '\n'
  fs.appendFile('debug.log', msg, function (err) {
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

client.login(DISCORD_TOKEN)
