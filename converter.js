var fs = require('fs');

var memes = JSON.parse(fs.readFileSync('memes.json', 'utf8'));

for (var i = 0; i < memes.length; i++) {
  // memes[i]['audioModifier'] = 1
  // modify memes
}
saveMemes();

function compareMemes(a, b) {
  return a['name'].toLowerCase().localeCompare(b['name'].toLowerCase());
}

function saveMemes() {
  memes.sort(compareMemes);
  fs.writeFileSync('memes.json', JSON.stringify(memes, null, 2));
}
