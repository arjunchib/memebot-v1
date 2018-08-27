const logger = require('../helpers/logger.js')
const Meme = require('../models/meme.js')
const util = require('../helpers/util.js')

module.exports = function (message, words) {
  // Check input length
  if (words.length < 3) {
    util.displayErrorText(message)
    return
  }

  // Varaibles
  let mode = words[0].toLowerCase()
  let name = words[1]
  let meme = Meme.findByCommand(name)

  // Check meme
  if (meme == null) {
    logger.info(`${message.author.username} tried to alias a meme that does not exist`)
    message.channel.send(`Could not find meme by name \`${name}\``)
    return
  }

  // Generate alias commands
  let commands = []
  for (let i = 2; i < words.length; i++) {
    commands.push(words[i])
  }

  // Add/remove aliases
  let output = ``
  if (mode === 'alias') {
    let aliases = []
    for (let command of commands) {
      if (Meme.findByCommand(command) == null) {
        if (meme.addCommand(command)) {
          aliases.push(command)
        }
      }
    }
    if (aliases.length === 0) {
      output = `No valid commands supplied for ${name}`
    } else {
      let s = (commands.length > 1) ? 's' : ''
      output = `Added command${s} \`${aliases.join('` `')}\``
    }
  } else if (mode === 'unalias') {
    let aliases = []
    for (let command of commands) {
      if (meme.removeCommand(command)) {
        aliases.push(command)
      }
    }
    if (aliases.length === 0) {
      output = `No valid commands supplied for ${name}`
    } else {
      let s = (commands.length > 1) ? 's' : ''
      output = `Removed command${s} \`${aliases.join('` `')}\``
    }
  }
  meme.save()

  // Send message
  logger.info(`${message.author.username} ${mode}ed ${meme.get('name')}`)
  message.channel.send(output)
}
