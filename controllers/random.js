const logger = require('../helpers/logger.js')
const Meme = require('../models/meme.js')
const util = require('../helpers/util.js')

module.exports = function (message, words, defaultChannel = null) {
  // Variables
  let voiceChannel = defaultChannel

  // Set voice channel
  if (message.member != null && message.member.voiceChannel != null) {
    voiceChannel = message.member.voiceChannel
  }

  // Check voice channel
  if (voiceChannel == null || voiceChannel.type !== 'voice') {
    logger.info(`${message.author.username} tried playing a meme without a voice channel`)
    message.channel.send('You must join a voice channel to play the dank memes')
    return
  }

  // Find Meme
  let meme = null
  if (words.length > 1) {
    let tag = words[1]
    let memes = Meme.findByTag(tag)
    meme = memes[util.randomInt(0, memes.length)]
  } else {
    meme = Meme.random()
  }

  // Play meme
  if (meme == null) {
    logger.info(`${message.author.username} tried to play a random meme but could not find one`)
    message.channel.send(`Could not find a random meme`)
    return
  }
  meme.play(message, voiceChannel, true)
  message.channel.send(`Playing ${meme.get('name')}`)
}
