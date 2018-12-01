const logger = require('../helpers/logger.js')
const Meme = require('../models/meme.js')

module.exports = function (message, words, defaultChannel = null) {
  // Variables
  let force = false
  let name = words[0]
  let voiceChannel = defaultChannel

  if (words[0][0] === '!') {
    force = true
    name = words[0].substring(1)
  }

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

  // Play meme
  if (force) {
    let meme = Meme.findSimilarName(name)
    if (meme == null) {
      logger.info(`${message.author.username} tried to play a meme but could not find any close matches`)
      message.channel.send(`Could not find similar meme by name \`${name}\``)
      return
    }
    meme.play(message, voiceChannel)
  } else {
    let meme = Meme.findByCommand(name)
    if (meme == null) {
      let similarMeme = Meme.findSimilarName(name)
      logger.info(`${message.author.username} tried to play meme that does not exist`)
      if (name != null && name !== ' ' && name !== '') {
        message.channel.send(`Could not find meme by name \`${name}\`\nDid you mean \`${similarMeme.get('name')}\`?`)
      } else {
        message.channel.send(`Could not find meme with no name`)
      }
      return
    }
    meme.play(message, voiceChannel)
  }
}
