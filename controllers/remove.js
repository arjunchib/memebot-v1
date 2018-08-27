const logger = require('../helpers/logger.js')
const Meme = require('../models/meme.js')
const util = require('../helpers/util.js')

const ADMIN_USER_ID = process.env.ADMIN_USER_ID

module.exports = function (message, words) {
  // Check input length
  if (words.length < 2) {
    util.displayErrorText(message)
    return
  }

  // Variables
  let name = words[1]
  let meme = Meme.findByCommand(name)

  // Check meme
  if (meme == null) {
    logger.info(`${message.author.username} tried to delete a meme that does not exist`)
    message.channel.send(`Could not find meme by name \`${name}\``)
    return
  }

  // Check authorization
  if (meme.get('authorID') !== message.author.id &&
      meme.get('authorID') !== ADMIN_USER_ID) {
    logger.info(`${message.author.username} tried to delete ${name} without authorization`)
    message.channel.send(`Only the author may delete memes. Vote for a deletion with the !vote command.`)
    return
  }

  // Remove meme
  meme.delete()

  // Send message
  logger.info(`${message.author.username} deleted ${name}`)
  message.channel.send(`Deleted \`${name}\``)
}
