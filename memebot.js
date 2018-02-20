var Discord = require('discord.js')
var fs = require('fs')
var ytdl = require('ytdl-core')
var ffmpeg = require('fluent-ffmpeg')
var push = require('pushover-notifications')
var ArgumentParser = require('argparse').ArgumentParser
var stringSimilarity = require('string-similarity')
var onExit = require('signal-exit')
require('dotenv').config()

// ENVIRONMENT VARS
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const PUSHOVER_USER = process.env.PUSHOVER_USER
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN
const ADMIN_USER_ID = process.env.ADMIN_USER_ID

// CONSTANTS
const client = new Discord.Client()
const reservedWords = ['add', 'delete', 'list', 'help', 'random', 'info', 'airhorn', 'vote', 'naturalize', 'volume', 'mb', 'stats', 'tag', 'untag', 'tags', 'alias', 'unalias', '!', '!!']

// GLOBALS
var memes = readJSON('memes.json')
var citizens = readJSON('citizens.json')
var stats = readJSON('stats.json', {})
var isPlaying = false
var blockedFile = null
var debugMode = false

// ARGUMENT PARSER
var parser = new ArgumentParser({
  version: '0.1',
  addHelp: true,
  description: 'A Discord bot for memes'
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

// PUSH NOTIFICATIONS
var pushover
if (PUSHOVER_USER && PUSHOVER_TOKEN) {
  pushover = new push({ // eslint-disable-line
    user: PUSHOVER_USER,
    token: PUSHOVER_TOKEN,
    onerror: function (error) {
      console.log(error)
    }
  })
}

// CREATE DIRS
if (!fs.existsSync('audio')) {
  fs.mkdirSync('audio')
}
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs')
}

// EXIT
onExit(function (code, signal) {
  console.log('Killing memebot')
})

// DISCORD SERVER
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
    } else if (command === 'alias' || command === 'unalias') {
      alias(message, words)
    } else if (command === 'stats') {
      showStats(message)
    } else if (command === 'tag' || command === 'untag') {
      tag(message, words)
    } else if (command === 'airhorn' || command === 'mb') {
      return
    } else {
      play(message, words)
    }
  } catch (err) {
    debug('Memebot crashed')
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

client.on('disconnect', (event) => {
  console.log('Memebot disconnect')
})

client.on('error', (error) => {
  console.error(error)
})

client.login(DISCORD_TOKEN)

// ADD
function add (message, words) {
  if (words.length < 5) {
    displayErrorText(message)
    return
  }

  let commands = []
  for (let i = 4; i < words.length; i++) {
    commands.push(words[i].replace(/[^a-z0-9]/gi, ''))
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

  try {
    let stream = ytdl(words[1])
    let startTime = words[2]
    let endTime = words[3]

    let endSeekOption = '-to ' + endTime
    let filePath = makeFilePath('audio/', commands[0], '.mp3')

    blockedFile = commands[0] + '.mp3'
    ffmpeg(stream)
    .noVideo()
    .seekOutput(startTime)
    .format('mp3')
    .outputOptions(['-write_xing 0', endSeekOption])
    .on('end', function (stdout, stderr) {
      blockedFile = null
    })
    .on('error', function (err, stdout, stderr) {
      console.error('Cannot process video: ' + err.message)
      debug(message.author.username + ' induced an ffmpeg error')
      displayErrorText(message)
    })
    .save(filePath)

    let d = new Date()
    let meme = {
      name: commands[0],
      author: message.author.username,
      authorID: message.author.id,
      commands: commands,
      tags: [],
      file: filePath.substring(6),
      dateAdded: d.toJSON(),
      lastPlayed: d.toJSON(),
      lastModified: d.toJSON(),
      audioModifier: 1,
      playCount: 0,
      archived: false
    }
    memes.push(meme)
    message.channel.send('Added ' + commands[0])
    saveMemes()
    debug(message.author.username + ' added ' + filePath.substring(6))
  } catch (e) {
    message.channel.send('Unable to add meme please check your link and commands')
    debug('An error occured when ' + message.author.username + ' tried to add ' + words[1])
  }
}

// REMOVE
function remove (message, words) {
  if (words.length < 2) {
    displayErrorText(message)
    return
  }
  let index = findIndexByCommand(words[1])
  if (index === -1) {
    message.channel.send('Could not find meme by name: `' + words[1] + '`')
    displayErrorText(message)
    return
  }
  if (hasAccess(memes[index], message.author)) {
    deleteMemeByIndex(index)
    message.channel.send('Deleted `' + words[1] + '`')
  } else {
    message.channel.send('Only the author may delete memes. Vote for a deletion with the !vote command.')
  }
}

// ALIAS
function alias (message, words) {
  if (words.length < 3) {
    displayErrorText(message)
    return
  }
  let index = findIndexByCommand(words[1])
  if (index === -1) {
    message.channel.send('Could not find meme by name: `' + words[1] + '`')
    displayErrorText(message)
    return
  }
  let numAliases = 0
  let output = ''
  if (words[0].toLowerCase() === 'alias') {
    for (let i = 2; i < words.length; i++) {
      if (!memes[index]['commands'].includes(words[i]) && findIndexByCommand(words[i]) < 0) {
        memes[index]['commands'].push(words[i])
        output += (words[i] + ', ')
        numAliases += 1
      }
    }
    output = output.substring(0, output.length - 2)
    if (numAliases === 0) {
      output = 'No valid commands supplied for ' + memes[index]['name']
    } else if (numAliases === 1) {
      output = 'Added command to ' + memes[index]['name'] + ': `' + output + '`'
    } else if (numAliases > 1) {
      output = 'Added commands to ' + memes[index]['name'] + ': `' + output + '`'
    }
  } else if (words[0].toLowerCase() === 'unalias') {
    for (let i = 2; i < words.length; i++) {
      if (memes[index]['commands'].includes(words[i]) && words[i].toLowerCase() !== memes[index]['name'].toLowerCase()) {
        var commandIndex = memes[index]['commands'].indexOf(words[i])
        memes[index]['commands'].splice(commandIndex, 1)
        output += (words[i] + ', ')
        numAliases += 1
      }
    }
    output = output.substring(0, output.length - 2)
    if (numAliases === 0) {
      output = 'No valid commands supplied for ' + memes[index]['name']
    } else if (numAliases === 1) {
      output = 'Removed command from ' + memes[index]['name'] + ': `' + output + '`'
    } else if (numAliases > 1) {
      output = 'Removed commands from' + memes[index]['name'] + ': `' + output + '`'
    }
  } else {
    displayErrorText(message)
    return
  }
  message.channel.send(output)
  updateLastModified(memes[index])
  saveMemes()
}

// TAG
function tag (message, words) {
  if (words.length < 3) {
    displayErrorText(message)
    return
  }
  let index = findIndexByCommand(words[1])
  if (index === -1) {
    message.channel.send('Could not find meme by name: `' + words[1] + '`')
    displayErrorText(message)
    return
  }
  let numTags = 0
  let output = ''
  if (words[0].toLowerCase() === 'tag') {
    for (let i = 2; i < words.length; i++) {
      if (!memes[index]['tags'].includes(words[i])) {
        memes[index]['tags'].push(words[i])
        output += (words[i] + ', ')
        numTags += 1
      }
    }
    output = output.substring(0, output.length - 2)
    if (numTags === 0) {
      output = 'No valid tags supplied for ' + memes[index]['name']
    } else if (numTags === 1) {
      output = 'Added tag to ' + memes[index]['name'] + ': `' + output + '`'
    } else if (numTags > 1) {
      output = 'Added tags to ' + memes[index]['name'] + ': `' + output + '`'
    }
  } else if (words[0].toLowerCase() === 'untag') {
    for (let i = 2; i < words.length; i++) {
      if (memes[index]['tags'].includes(words[i])) {
        var tagIndex = memes[index]['tags'].indexOf(words[i])
        memes[index]['tags'].splice(tagIndex, 1)
        output += (words[i] + ', ')
        numTags += 1
      }
    }
    output = output.substring(0, output.length - 2)
    if (numTags === 0) {
      output = 'No valid commands supplied for ' + memes[index]['name']
    } else if (numTags === 1) {
      output = 'Removed tag from ' + memes[index]['name'] + ': `' + output + '`'
    } else if (numTags > 1) {
      output = 'Removed tags from' + memes[index]['name'] + ': `' + output + '`'
    }
  } else {
    displayErrorText(message)
    return
  }
  message.channel.send(output)
  updateLastModified(memes[index])
  saveMemes()
}

// LIST
function list (message, words) {
  let names = '```'
  let list = []
  let isAll = false
  let isArchived = false
  let isVoting = false
  let isTag = false
  let isTags = false

  if (words.length > 1) {
    if (words[1] === 'least') {
      memes.sort(compareMemesLeastPlayed)
    } else if (words[1] === 'most') {
      memes.sort(compareMemesMostPlayed)
    } else if (words[1] === 'newest' || words[1] === 'new') {
      memes.sort(compareMemesNewest)
    } else if (words[1] === 'oldest' || words[1] === 'old') {
      memes.sort(compareMemesOldest)
    } else if (words[1] === 'global') {
      if (words[2] === 'least') {
        memes.sort(compareMemesGlobalLeastPlayed)
      } else {
        memes.sort(compareMemesGlobalMostPlayed)
      }
    } else if (words[1] === 'all') {
      isAll = true
    } else if (['archived', 'archives', 'archive'].includes(words[1])) {
      isArchived = true
    } else if (['votes', 'voting', 'vote'].includes(words[1])) {
      isVoting = true
    } else if (words[1] === 'tags') {
      isTags = true
    } else if (words.length > 1) {
      isTag = true
    } else {
      displayErrorText(message)
      return
    }
  } else {
    memes.sort(compareMemesMostPlayed)
  }

  if (isTag) {
    for (let i = 0; i < memes.length; i++) {
      for (let tagIndex = 1; tagIndex < words.length; tagIndex++) {
        if (memes[i]['tags'].includes(words[tagIndex])) {
          list.push(memes[i]['name'])
        }
      }
    }
  } else if (isTags) {
    let tags = new Set()
    for (let i = 0; i < memes.length; i++) {
      for (let tag in memes[i]['tags']) {
        tags.add(memes[i]['tags'][tag])
      }
    }
    list = [...tags]
  } else if (isVoting) {
    for (let i = 0; i < citizens.length; i++) {
      for (let vote in citizens[i]['votes']) {
        let index = findIndexByCommand(vote)
        if (index >= 0 && memes[index]['archived']) {
          vote += '*'
        }
        list.push(vote)
      }
    }
    list = removeDuplicates(list)
  } else {
    for (let i = 0; i < memes.length; i++) {
      if (isAll || isArchived === memes[i]['archived']) {
        list.push(memes[i]['name'])
      }
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
  '```![meme]  \nPlays an audio meme on your currently connected voice channel.\n\n!list [most/least/newest/oldest/archives/votes/all/tags/<tag>]\nA list of memes. If no modifier is given, the list defaults to alphabetical order.\n\n!add [youtube link] [start time] [end time] [command 1, command 2, ...]\nAdds a meme from a youtube video, pulling audio from the start time to the end time. The name of the first command becomes the name of the meme. Start time and end time can take in seconds, hh:mm:ss format, and even decimals.\n\nEx. !add https://www.youtube.com/watch?v=6JaY3vtb760 2:31 2:45.5 Caveman shaggy scooby\n\n!delete [meme]\nDeletes the meme that with this name, if you were the person who added it.\n\n!random [tag]\nPlays a random meme. If the tag option is used, will play a random memes with that tag.\n\n!info [meme]\nDisplays stats and alternate commands for a meme.\n\n!volume [meme] [audio modifier]\nSets an audio modifier for the meme, such that 0.5 is half the normal volume and 2.0 is twice the normal volume.\n\n!(un)alias [meme] [command 1, command 2, ...]\nAdds or removes commands for the meme. Cannot remove the first command given to the meme.\n\n!(un)tag [meme] [tag 1, tag 2, ...]\nAdds or removes tags for the meme.\n\n!vote [meme] [keep/remove/abstain]\nAllows you to vote for a meme\'s archival. You must be a citizen to vote. The meme will be activated/deactivated once it has recieved over 50% approval.\n\n!stats\nDisplays memebot stats\n\n!help \nThis message.```'
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
    message.channel.send('Could not find meme by name: `' + words[1] + '`')
    return
  }
  readStats()
  let meme = memes[index]
  let output = '```name: ' + meme['name']
  output += '\ncommands: '
  for (let i = 0; i < meme['commands'].length; i++) {
    output += meme['commands'][i] + ', '
  }
  output = output.substring(0, output.length - 2)
  output += '\ntags: '
  if (meme['tags'].length > 0) {
    for (let i = 0; i < meme['tags'].length; i++) {
      output += meme['tags'][i] + ', '
    }
    output = output.substring(0, output.length - 2)
  } else {
    output += '<none>'
  }
  let dateLastPlayed = new Date(meme['lastPlayed'])
  let dateAdded = new Date(meme['dateAdded'])
  let status = meme['archived'] ? 'archived' : 'active'
  let count = stats['counts'] && stats['counts'][meme['name']] ? stats['counts'][meme['name']] : 0
  output += '\nauthor: ' + meme['author']
  output += '\nlast played: ' + dateLastPlayed.toString()
  output += '\ndate added: ' + dateAdded.toDateString()
  output += '\naudio modifier: ' + meme['audioModifier']
  output += '\nplay count: ' + meme['playCount']
  output += '\nglobal play count: ' + count
  output += '\nstatus: ' + status + '```'
  message.channel.send(output)
}

// RANDOM
function random (message, words) {
  let voiceChannel = client.channels.find('id', '213484561127047169')
  if (message.member != null && message.member.voiceChannel != null) {
    voiceChannel = message.member.voiceChannel
  }
  if (voiceChannel == null || voiceChannel.type !== 'voice') {
    message.channel.send('You must join a voice channel to play the dank memes')
    return
  }
  let randomIndex = -1
  if (words.length === 1) {
    do {
      randomIndex = Math.floor(Math.random() * memes.length)
    } while (memes[randomIndex]['archived'])
  } else {
    let tags = []
    for (let i = 0; i < memes.length; i++) {
      if (!memes[i]['archived'] && memes[i]['tags'].includes(words[1])) {
        tags.push(i)
      }
    }
    if (tags.length === 0) {
      message.channel.send('Could not find any memes with tag: ' + words[1])
      return
    }
    do {
      randomIndex = tags[Math.floor(Math.random() * tags.length)]
    } while (memes[randomIndex]['archived'])
  }
  if (!isPlaying) {
    message.channel.send('Playing ' + memes[randomIndex]['name'])
    playMeme(memes[randomIndex], voiceChannel, true)
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
    message.channel.send('Could not find meme by name: `' + words[1] + '`')
    return
  }
  memes[index]['audioModifier'] = audioModifier
  updateLastModified(memes[index])
  saveMemes()
  message.channel.send('The audio modifier of ' + memeInput + ' has been set to: `' + audioModifier + '`')
  debug('Audio modifier of ' + memes[index]['name'] + ' set to ' + audioModifier)
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
  if (words.length < 2) {
    displayErrorText(message)
    return
  }

  let index = findIndexByCommand(words[1])
  if (index === -1) {
    message.channel.send('Could not find meme by name: `' + words[1] + '`')
    displayErrorText(message)
    return
  }

  let memeName = memes[index]['name']
  let memeArchived = memes[index]['archived']
  let citizen = findCitizenByID(message.author.id)
  if (citizen == null && words.length >= 3) {
    message.channel.send('You must naturalize to become a citizen of memebotopia')
    displayErrorText(message)
    return
  } else {
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
    saveCitizens()
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
    updateLastModified(memes[index])
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

  message.channel.send(resolution)
}

function showStats (message) {
  let numGuilds = stats['guilds']
  let numPlays = 0
  Object.keys(stats['counts']).forEach(function (name) {
    numPlays += stats['counts'][name]
  })
  let numMemes = memes.length
  let statsText = '```Active guilds: ' + numGuilds
  statsText += '\nNumber of memes played: ' + numPlays
  statsText += '\nNumber of memes: ' + numMemes
  statsText += '```'
  message.channel.send(statsText)
}

// PLAY
function play (message, words) {
  let voiceChannel = client.channels.find('id', '213484561127047169')
  if (message.member != null && message.member.voiceChannel != null) {
    voiceChannel = message.member.voiceChannel
  }
  if (voiceChannel == null || voiceChannel.type !== 'voice') {
    message.channel.send('You must join a voice channel to play the dank memes')
    return
  }
  let memeInput = ''
  for (let i = 0; i < words.length; i++) {
    if (words[i].length !== 0) {
      memeInput += words[i]
    }
  }
  if (memeInput == null || memeInput.length === 0) {
    displayErrorText(message)
    return
  }
  let force = false
  if (memeInput[0] === '!') {
    force = true
    memeInput = memeInput.substring(1)
  }
  if (memeInput === 'random') {
    random(message, words)
  }
  let index = findIndexByCommand(memeInput)
  if (index === -1 || memes[index]['archived']) {
    var commands = []
    for (let i = 0; i < memes.length; i++) {
      if (!memes[i]['archived']) {
        commands = commands.concat(memes[i]['commands'])
      }
    }
    var matches = stringSimilarity.findBestMatch(memeInput, commands)
    if (!force) {
      let output = ''
      if (index >= 0 && memes[index]['archived']) {
        output += 'Cannot play archived meme: `' + memeInput + '`'
      } else {
        output += 'Could not find meme by name: `' + memeInput + '`'
      }
      output += '\nDid you mean: `' + matches['bestMatch']['target'] + '`?'
      message.channel.send(output)
      return
    } else {
      index = findIndexByCommand(matches['bestMatch']['target'])
    }
  }
  let meme = memes[index]
  playMeme(meme, voiceChannel, false)
  let d = new Date()
  memes[index]['lastPlayed'] = d.toJSON()
  memes[index]['playCount'] += 1
  saveMemes()
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
        if (isRandom) {
          debug('Failed to randomly play ' + file)
        } else {
          debug('Failed to play ' + file)
        }
        voiceChannel.leave()
        console.log(e.message)
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
  for (let i = 0; i < citizens.length; i++) {
    for (let j = 0; j < citizens[i]['votes'].length; j++) {
      if (citizens[i]['votes'][j] === memes[index]['name']) {
        delete citizens[i]['votes'][j]
      }
    }
  }
  saveCitizens()
  memes.splice(index, 1)
  saveMemes()
  try {
    fs.unlinkSync('audio/' + file)
  } catch (err) {
    debug('Failed to delete ' + file)
    console.error(err.message)
  }
  debug('Deleted ' + file)
}

function clearVotes (memeName) {
  for (let i = 0; i < citizens.length; i++) {
    delete citizens[i]['votes'][memeName]
  }
  saveCitizens()
}

function updateLastModified (meme) {
  var d = new Date()
  meme['lastModified'] = d.toJSON()
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

function compareMemesGlobalMostPlayed (a, b) {
  readStats()
  let countA = stats['counts'] && stats['counts'][a['name']] ? stats['counts'][a['name']] : 0
  let countB = stats['counts'] && stats['counts'][b['name']] ? stats['counts'][b['name']] : 0
  return countB - countA
}

function compareMemesGlobalLeastPlayed (a, b) {
  readStats()
  let countA = stats['counts'] && stats['counts'][a['name']] ? stats['counts'][a['name']] : 0
  let countB = stats['counts'] && stats['counts'][b['name']] ? stats['counts'][b['name']] : 0
  return countA - countB
}

function compareMemesNewest (a, b) {
  return new Date(b['dateAdded']) - new Date(a['dateAdded'])
}

function compareMemesOldest (a, b) {
  return new Date(a['dateAdded']) - new Date(b['dateAdded'])
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
  return (author.id === ADMIN_USER_ID || (meme['authorID'] != null && meme['authorID'] === author.id))
}

function saveMemes () {
  memes.sort(compareMemes)
  fs.writeFile('memes.json', JSON.stringify(memes, null, 2), (err) => {
    if (err) throw err
    debug('Saved memes.json', false)
  })
  fs.writeFile('memes-backup.json', JSON.stringify(memes, null, 2), (err) => {
    if (err) throw err
    debug('Saved memes-backup.json', false)
  })
}

function saveCitizens () {
  citizens.sort(compareCitizens)
  fs.writeFile('citizens.json', JSON.stringify(citizens, null, 2), (err) => {
    if (err) throw err
    debug('Saved citizens.json', false)
  })
}

function readJSON (file, defaultValue = []) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(e.message)
    return defaultValue
  }
}

function readStats () {
  stats = readJSON('stats.json', {})
}

// DEBUG
function debug (msg, shouldLog = true) {
  if (debugMode) {
    console.log(msg)
  }
  if (shouldLog) {
    let d = new Date()
    let timeString = d.getFullYear() + '-' + formatTime(d.getMonth() + 1) + '-' + formatTime(d.getDate()) + ' ' + formatTime(d.getHours()) + ':' + formatTime(d.getMinutes()) + ':' + formatTime(d.getSeconds())
    msg = '[' + timeString + '] ' + msg + '\n'
    fs.appendFile('logs/debug.log', msg, function (err) {
      if (err) {
        return console.log(err)
      }
    })
  }
}

function formatTime (time) {
  if (time <= 9) {
    time = '0' + time
  }
  return time
}
