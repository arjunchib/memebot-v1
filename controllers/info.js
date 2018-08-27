const logger = require('../helpers/logger.js')
const Meme = require('../models/meme.js')
const util = require('../helpers/util.js')

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
    logger.info(`${message.author.username} tried to request info on a meme that does not exist`)
    message.channel.send(`Could not find meme by name \`${name}\``)
    return
  }

  // Log
  logger.info(`${message.author.username} requested info on ${meme.get('name')}`)

  // Generate output
  let dateLastmodified = new Date(meme.get('lastModified'))
  let dateAdded = new Date(meme.get('dateAdded'))
  let output =
  `\`\`\`
name: ${meme.get('name')}
commands: ${meme.get('commands').join(', ') || '<none>'}
tags: ${meme.get('tags').join(', ') || '<none>'}
author: ${meme.get('author')}
last modified: ${dateLastmodified.toString()}
date added: ${dateAdded.toString()}
audio modifier: ${meme.get('audioModifier')}
play count: ${meme.get('playCount')}
\`\`\``

  // Send message
  message.channel.send(output)
}
