const ffmpeg = require('fluent-ffmpeg')
const ytdl = require('ytdl-core')

const io = require('../helpers/io.js')
const logger = require('../helpers/logger.js')
const Meme = require('../models/meme.js')
const util = require('../helpers/util.js')

module.exports = function (message, words) {
  // Check input length
  if (words.length < 5) {
    util.displayErrorText(message)
    return
  }

  // Check if commands are valid
  let commands = []
  for (let i = 4; i < words.length; i++) {
    commands.push(words[i].replace(/[^a-z0-9]/gi, ''))
  }

  for (let command of commands) {
    if (util.reservedWords.has(command.toLowerCase())) {
      message.channel.send(`The command **${command}** is a reserved word. Please use a different name.`)
      logger.info(`${message.author.username} tried to add the reserved word  ${command} as a command`)
      return
    } else if (Meme.findByCommand(command) != null) {
      message.channel.send(`The command **${command}** already exists! Please delete it first.`)
      logger.info(`${message.author.username} tried to add the command ${command} which already exists`)
      return
    }
  }

  // Varaibles
  let name = commands[0]
  let stream = ytdl(words[1])
  let startTime = words[2]
  let endTime = words[3]

  let endSeekOption = '-to ' + endTime
  let filePath = `data/audio/${name}.mp3`

  // Download youtube audio
  io.blockedFiles.add(filePath)
  ffmpeg(stream)
  .noVideo()
  .seekOutput(startTime)
  .format('mp3')
  .outputOptions(['-write_xing 0', endSeekOption])
  .on('end', function (stdout, stderr) {
    io.blockedFiles.delete(filePath)
    let d = new Date()
    let meme = new Meme({
      name: name,
      author: message.author.username,
      authorID: message.author.id,
      commands: Array.from(commands),
      tags: [],
      file: `${name}.mp3`,
      dateAdded: d.toJSON(),
      lastPlayed: d.toJSON(),
      lastModified: d.toJSON(),
      playCount: 0,
      audioModifier: 1,
      archived: false
    })
    meme.save()
  })
  .on('error', function (err, stdout, stderr) {
    logger.warn(`${message.author.username} induced an ffmpeg error`)
    logger.error(err)
    message.channel.send('Something went wrong when downloading your meme')
  })
  .save(filePath)

  // Send message
  logger.info(`${message.author.username} added ${name}.mp3`)
  message.channel.send(`Added ${name}`)
}
