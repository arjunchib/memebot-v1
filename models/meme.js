const stringSimilarity = require('string-similarity')

const fs = require('fs')
const io = require('../helpers/io.js')
const logger = require('../helpers/logger.js')
const util = require('../helpers/util.js')

// File setup
if (!fs.existsSync('data')) { fs.mkdirSync('data') }
if (!fs.existsSync('data/audio')) { fs.mkdirSync('data/audio') }

// Paths
const storageDirName = './data/memes'
const audioDirName = './data/audio'
const commandLookupFileName = './data/command-lookup.json'
util.makeDirectory('./data')
util.makeDirectory('./data/memes')

// Variables
var cache = new Map()
var commandLookup = io.readJSON(commandLookupFileName) || Object.create(null)
var activeVoiceChannels = new Set([])
var activeGuilds = new Set([])

// Schema
var memeDefaults = {
  name: '',
  author: '',
  authorID: '',
  commands: [],
  tags: [],
  file: '',
  dateAdded: (new Date()).toJSON(),
  lastModified: (new Date()).toJSON(),
  playCount: 0,
  audioModifier: 0
}

function sanitize (data) {
  return util.sanitize(data, memeDefaults)
}

function validate (data) {
  if (!util.validateTypes(data, memeDefaults)) {
    return false
  }
  switch (true) {
    case (data.name === '' || data.name == null):
    case (!data.commands.includes(data.name)):
    case (data.file == null || !fs.existsSync(`${audioDirName}/${data.file}`)):
      return false
    default:
      return true
  }
}

// Populate cache
for (let file of fs.readdirSync(storageDirName)) {
  if (util.getFileExtension(file) === 'json') {
    let path = `${storageDirName}/${file}`
    let data = sanitize(io.readJSON(path))
    if (validate(data)) {
      cache.set(data.name.toLowerCase(), data)
    } else {
      logger.warn(`Could not enter ${file} into cache as this meme is invalid`)
    }
  }
}

// Constructor
var Meme = function (data) {
  this.data = sanitize(data)
}

// Attributes
Meme.prototype.data = {}

// Getter
Meme.prototype.get = function (key) {
  return this.data[key]
}

// Add command to meme
Meme.prototype.addCommand = function (command) {
  if (!this.data.commands.includes(command)) {
    this.data.commands.push(command)
    return true
  }
  return false
}

// Remove command from meme
Meme.prototype.removeCommand = function (command) {
  let commandIndex = this.data.commands.indexOf(command)
  if (commandIndex >= 0) {
    this.data.commands.splice(commandIndex, 1)
    return true
  }
  return false
}

// Add tag to meme
Meme.prototype.addTag = function (tag) {
  if (!this.data.tags.includes(tag)) {
    this.data.tags.push(tag)
    return true
  }
  return false
}

// Remove tag from meme
Meme.prototype.removeTag = function (tag) {
  let tagIndex = this.data.tags.indexOf(tag)
  if (tagIndex >= 0) {
    this.data.tags.splice(tagIndex, 1)
    return true
  }
  return false
}

// Set play count
Meme.prototype.setPlayCount = function (value) {
  this.data.playCount = value
}

// Set audio modifier
Meme.prototype.setVolume = function (value) {
  this.data.audioModifier = value
}

// Save meme to file
Meme.prototype.save = function () {
  this.data.lastModified = (new Date()).toJSON()
  this.data = sanitize(this.data)
  if (!validate(this.data)) {
    logger.warn(`Failed to save ${this.data.name} with invalid format`)
    return false
  }
  cache.set(this.data.name.toLowerCase(), this.data)
  let memeFile = `${storageDirName}/${this.data.name}.json`
  io.saveJSON(this.data, memeFile)
  let didUpdateCommandLookup = false
  for (let command of this.data.commands) {
    if (commandLookup[command.toLowerCase()] !== this.data.name.toLowerCase()) {
      commandLookup[command.toLowerCase()] = this.data.name.toLowerCase()
      didUpdateCommandLookup = true
    }
  }
  if (didUpdateCommandLookup) {
    io.saveJSON(commandLookup, commandLookupFileName)
  }
  return true
}

// Remove from file
Meme.prototype.delete = function () {
  cache.delete(this.data.name.toLowerCase())
  let memeFile = `${storageDirName}/${this.data.name}.json`
  io.delete(memeFile)
  for (let command of this.data.commands) {
    delete commandLookup[command.toLowerCase()]
  }
  io.saveJSON(commandLookup, commandLookupFileName)
}

// Play meme on a voice channel
Meme.prototype.play = function (message, voiceChannel, isRandom = false) {
  logger.info(`Playing ${this.data.name}`)
  var meme = this
  let file = `${audioDirName}/${this.data.file}`
  if (!activeVoiceChannels.has(voiceChannel) && !activeGuilds.has(voiceChannel.guild) &&
  !io.blockedFiles.has(file)) {
    activeVoiceChannels.add(voiceChannel)
    activeGuilds.add(voiceChannel.guild)
    voiceChannel.join()
      .then(connection => {
        logger.play(meme, message, isRandom)
        const dispatcher = connection.playFile(file, {
          volume: 0.50 * meme.get('audioModifier')
        })
        dispatcher.on('end', () => {
          voiceChannel.leave()
          activeVoiceChannels.delete(voiceChannel)
          activeGuilds.delete(voiceChannel.guild)
        })
      })
      .catch(function (err) {
        logger.warn(`Failed to play ${meme.get('name')}`)
        logger.error(err)
        voiceChannel.leave()
        activeVoiceChannels.delete(voiceChannel)
        activeGuilds.delete(voiceChannel.guild)
      })
  } else {
    logger.warn(`Failed to play ${meme.get('name')} as a meme is already playing`)
  }
}

// Find meme with name
Meme.findByName = function (name) {
  if (name != null && cache.has(name.toLowerCase())) {
    return new Meme(cache.get(name.toLowerCase()))
  } else {
    return null
  }
}

// Find meme with most similar name
Meme.findSimilarName = function (name) {
  let commands = Object.keys(commandLookup)
  var matches = stringSimilarity.findBestMatch(name, commands)
  return Meme.findByCommand(matches.bestMatch.target)
}

// Find meme with command
Meme.findByCommand = function (command) {
  let name = commandLookup[command.toLowerCase()]
  return Meme.findByName(name)
}

// Find memes with tag
Meme.findByTag = function (tag) {
  let memes = []
  for (let data of cache.values()) {
    if (data.tags.includes(tag.toLowerCase())) {
      memes.push(new Meme(data))
    }
  }
  return memes
}

// Find random meme
Meme.random = function () {
  let keys = [...cache.keys()]
  let randomKey = keys[util.randomInt(0, keys.length)]
  return new Meme(cache.get(randomKey))
}

// Find all memes
Meme.all = function () {
  let memes = []
  for (var data of cache.values()) {
    memes.push(new Meme(data))
  }
  return memes
}

// Number of memes
Meme.count = function () {
  return cache.size
}

// Export module
module.exports = Meme
