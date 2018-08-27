var fs = require('fs')

require('dotenv').config()

// const Meme = require('./models/meme.js')
var counts = JSON.parse(fs.readFileSync('./data/counts.json', 'utf8'))
// var memes = JSON.parse(fs.readFileSync('./data/memes.json', 'utf8'))

// for (let data of memes) {
//   let meme = new Meme(data)
//   meme.save()
// }

let total = 0
for (let name of Object.keys(counts)) {
  total += counts[name]
}
console.log(total)
