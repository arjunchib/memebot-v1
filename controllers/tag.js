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
  let mode = words[0].toLowerCase()
  let name = words[1]
  let meme = Meme.findByCommand(name)

  // Check meme
  if (meme == null) {
    logger.info(`${message.author.username} tried to tag a meme that does not exist`)
    message.channel.send(`Could not find meme by name \`${name}\``)
    return
  }

  // Genertae tag commands
  let commands = []
  for (let i = 2; i < words.length; i++) {
    commands.push(words[i])
  }

  // Add or remove tags
  let output = ``
  if (mode === 'tag') {
    let tags = []
    for (let command of commands) {
      if (meme.addTag(command)) {
        tags.push(command)
      }
    }
    if (tags.length === 0) {
      output = `No valid tags supplied for ${name}`
    } else {
      let s = (tags.length > 1) ? 's' : ''
      output = `Added tag${s} \`${tags.join('` `')}\``
    }
  } else if (mode === 'untag') {
    let tags = []
    for (let command of commands) {
      if (meme.removeTag(command)) {
        tags.push(command)
      }
    }
    if (tags.length === 0) {
      output = `No valid tags supplied for ${name}`
    } else {
      let s = (tags.length > 1) ? 's' : ''
      output = `Removed tag${s} \`${tags.join('` `')}\``
    }
  }
  meme.save()

  // Send message
  logger.info(`${message.author.username} ${mode}ged ${meme.get('name')}`)
  message.channel.send(output)
}
