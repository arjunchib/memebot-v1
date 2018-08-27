const logger = require('../helpers/logger.js')
const compare = require('../helpers/compare.js')
const Meme = require('../models/meme.js')
const util = require('../helpers/util.js')

module.exports = function (message, words) {
  logger.info(`${message.author.username} requested a list of memes`)

  // Variables
  let isTag = false
  let isTags = false
  let outputs = []
  let outMessages = []
  let compareMethod = compare.mostPlayed

  // Set mode
  if (words.length > 1) {
    if (words[1] === 'least') {
      compareMethod = compare.leastPlayed
    } else if (words[1] === 'most') {
      compareMethod = compare.mostPlayed
    } else if (words[1] === 'newest' || words[1] === 'new') {
      compareMethod = compare.newest
    } else if (words[1] === 'oldest' || words[1] === 'old') {
      compareMethod = compare.oldest
    } else if (words[1] === 'tags') {
      isTags = true
    } else if (words.length > 1) {
      isTag = true
    } else {
      util.displayErrorText(message)
      return
    }
  }

  // Generate outputs
  if (isTag) {
    for (let tagIndex = 1; tagIndex < words.length; tagIndex++) {
      let tag = words[tagIndex]
      for (let meme of Meme.findByTag(tag)) {
        outputs.push(meme.get('name'))
      }
    }
  } else if (isTags) {
    let tags = new Set()
    for (let meme of Meme.all()) {
      for (let tag of meme.get('tags')) {
        tags.add(tag)
      }
    }
    outputs = [...tags]
  } else {
    for (let meme of Meme.all().sort(compareMethod)) {
      outputs.push(meme.get('name'))
    }
  }

  // Generate output message(s)
  var msgIndex = 0
  var charCount = 3

  outMessages[0] = '```'
  for (let output of outputs) {
    charCount += output.length
    if (charCount > 1997) {
      let outMessage = outMessages[msgIndex]
      outMessages[msgIndex] = outMessage.substring(0, outMessage.length - 2) + '```'
      msgIndex += 1
      outMessages[msgIndex] = '```'
      charCount = 3 + output.length
    }
    outMessages[msgIndex] += output
    outMessages[msgIndex] += ', '
    charCount += 2
  }
  outMessages[msgIndex] = outMessages[msgIndex].substring(0, outMessages[msgIndex].length - 2) + '```'

  if (outputs.length === 0) {
    outMessages[0] = '```No memes :\'(```'
  }

  // Send message(s)
  for (let outMessage of outMessages) {
    message.channel.send(outMessage)
  }
}
