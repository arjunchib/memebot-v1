const fs = require('fs')

var memes = []

// Read meme files
for (let file of fs.readdirSync('./data/memes')) {
  if (file.split('.').pop() === 'json') { // check extension is json
    let path = `./data/memes/${file}`
    memes.push(JSON.parse(fs.readFileSync(path, 'utf8')))
  }
}

// Write combined minimized meme file
fs.writeFile('./memes.min.json', JSON.stringify(memes), 'utf8', function (err) {
  if (err) {
    return console.log(err)
  }
  console.log('Minimized file saved successfully!')
})

// Write combined meme file
fs.writeFile('./memes.json', JSON.stringify(memes, null, '\t'), 'utf8', function (err) {
  if (err) {
    return console.log(err)
  }
  console.log('Pretty file saved successfully!')
})
