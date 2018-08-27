const logger = require('../helpers/logger.js')
const Meme = require('../models/meme.js')
const util = require('../helpers/util.js')

module.exports = function (message, words) {
  // Check input length
  if (words.length < 3) {
    util.displayErrorText(message)
    return
  }

  // Variables
  let name = words[1]
  let meme = Meme.findByCommand(name)
  let audioModifier = words[2]

  // Check meme
  if (meme == null) {
    logger.info(`${message.author.username} tried to change the volume of a meme that does not exist`)
    message.channel.send(`Could not find meme by name \`${name}\``)
    return
  }

  // Check audio modifier
  if (audioModifier == null || isNaN(audioModifier) || audioModifier < 0) {
    logger.info(`${message.author.username} tried to change volume of a meme with an invalid audio modifier`)
    message.channel.send(`The given audio modifier is invalid \`${audioModifier}\``)
    return
  }

  // Change audio modifier
  meme.setVolume(audioModifier)
  meme.save()

  // Send message
  logger.info(`${message.author.username} changed the volume of ${name} to ${audioModifier}`)
  message.channel.send(`The audio modifier has been set to \`${audioModifier}\``)
}
