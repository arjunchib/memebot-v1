var fs = require('fs')

var memes = JSON.parse(fs.readFileSync('memes.json', 'utf8'))
var d = new Date()

for (let i = 0; i < memes.length; i++) {
  // Code to modify memes.json
  memes[i]['lastModified'] = d.toJSON()
}
saveMemes()

function compareMemes (a, b) {
  return a['name'].toLowerCase().localeCompare(b['name'].toLowerCase())
}

function saveMemes () {
  memes.sort(compareMemes)
  fs.writeFileSync('memes-converted.json', JSON.stringify(memes, null, 2))
}
