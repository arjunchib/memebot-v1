var fs = require('fs')

exports.displayErrorText = function (message) {
  let errorText =
`You did something wrong.
Type **!help** my adult son.`
  message.channel.send(errorText)
}

exports.trimWhitespace = function (str) {
  return str.replace(/\s+/g, ' ').trim()
}

exports.removeDuplicates = function (a) {
  return a.sort().filter(function (item, pos, ary) {
    return !pos || item !== ary[pos - 1]
  })
}

exports.typeOf = function (obj) {
  Object.prototype.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}

exports.getFileExtension = function (file) {
  return file.split('.').pop()
}

exports.clone = function (a) {
  return JSON.parse(JSON.stringify(a))
}

exports.makeDirectory = function (path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path)
  }
}

exports.sanitize = function (data, defaults) {
  // Check if data is null
  if (data == null) {
    return exports.clone(defaults)
  }

  // Clone data
  let sanitizedData = exports.clone(data)

  // Fill out default entires
  for (let key of Object.keys(defaults)) {
    if (!data.hasOwnProperty(key)) {
      sanitizedData[key] = defaults[key]
    }
  }

  // Remove invalid entries
  for (let key of Object.keys(data)) {
    if (!Object.keys(defaults).includes(key)) {
      delete sanitizedData[key]
    }
  }

  return sanitizedData
}

exports.validateTypes = function (data, defaults) {
  for (let key of Object.keys(defaults)) {
    if (data.hasOwnProperty(key)) {
      if (exports.typeOf(data[key]) !== exports.typeOf(defaults[key])) {
        return false
      }
    }
  }
  return true
}

exports.randomInt = function (min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

exports.reservedWords = new Set(
  ['add', 'delete', 'list', 'help', 'random', 'info', 'airhorn', 'vote', 'naturalize', 'volume', 'mb', 'stats', 'tag', 'untag', 'tags', 'alias', 'unalias', '!', '!!']
)
