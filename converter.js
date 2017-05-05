var fs = require('fs')

var memes = JSON.parse(fs.readFileSync('memes.json', 'utf8'))

// var d = new Date(0)
for (let i = 0; i < memes.length; i++) {
  memes[i]['authorID'] = memes[i]['author_id']
  delete memes[i]['author_id']
}
saveMemes()

function compareMemes (a, b) {
  return a['name'].toLowerCase().localeCompare(b['name'].toLowerCase())
}

function saveMemes () {
  memes.sort(compareMemes)
  fs.writeFileSync('memes_converted.json', JSON.stringify(memes, null, 2))
}
