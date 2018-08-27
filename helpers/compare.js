module.exports = {
  alphabetical: function (a, b) {
    let aName = a.get('name').toLowerCase()
    let bName = b.get('name').toLowerCase()
    return aName.localeCompare(bName)
  },
  mostPlayed: function (a, b) {
    return b.get('playCount') - a.get('playCount')
  },
  leastPlayed: function (a, b) {
    return a.get('playCount') - b.get('playCount')
  },
  newest: function (a, b) {
    return new Date(b.get('dateAdded')) - new Date(a.get('dateAdded'))
  },
  oldest: function (a, b) {
    return new Date(a.get('dateAdded')) - new Date(b.get('dateAdded'))
  }
}
