const fs = require('fs')
const logger = require('./logger.js')

module.exports = {
  saveJSON: function (data, filename) {
    fs.writeFile(filename, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        logger.warn('Failed to save ' + filename)
        logger.error(err)
      }
    })
  },
  readJSON: function (filename) {
    try {
      return JSON.parse(fs.readFileSync(filename, 'utf8'))
    } catch (err) {
      logger.warn('Failed to parse ' + filename)
      logger.error(err)
      return null
    }
  },
  delete: function (filename) {
    fs.unlink(filename, (err) => {
      if (err) {
        logger.warn(`Failed to delete ${filename}`)
        logger.error(err)
      } else {
        logger.info(`Deleted ${filename}`)
      }
    })
  },
  blockedFiles: new Set()
}
