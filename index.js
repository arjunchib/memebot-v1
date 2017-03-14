var Discord = require('discord.js');
var fs = require('fs');
var ytdl = require('ytdl-core');
var ffmpeg = require('fluent-ffmpeg')
var push = require( 'pushover-notifications' );

var DISCORD_TOKEN = process.env.DISCORD_TOKEN;
var PUSHOVER_USER = process.env.PUSHOVER_USER;
// var PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;

var client = new Discord.Client();
var memes = JSON.parse(fs.readFileSync('memes.json', 'utf8'));
var citizens = JSON.parse(fs.readFileSync('citizens.json', 'utf8'));
var debugMode = true;
var isPlaying = false;
var reservedWords = ['add', 'delete', 'list', 'help', 'random', 'info', 'airhorn', 'vote'];
var blockedFile = null;

// PUSH NOTIFICATIONS
// var p = new push( {
//     user: PUSHOVER_USER,
//     token: PUSHOVER_TOKEN,
//     onerror: function(error) {
//       console.log(error);
//     }
// });

// MAIN LOOP
client.on('ready', () => {
  console.log('Memebot ready');
});

client.on('message', message => {
  try {
    if (message == null || message.content.substring(0,1) !== '!' || message.content.length <= 1) {
      return;
    }
    message.content = trimWhitespace(message.content);
    var words = message.content.substring(1).split(' ');
    command = words[0].toLowerCase();
    if (command === 'add') {
      add(message, words)
    } else if (command === 'delete') {
      remove(message, words)
    } else if (command === 'list') {
      list(message, words)
    } else if (command === 'help') {
      help(message)
    } else if (command === 'random') {
      random(message, words)
    } else if (command === 'info') {
      info(message, words)
    } else if (command === 'vote') {
      vote(message, words)
    } else if (command === 'airhorn') {
      //pass
    } else {
      play(message, words)
    }
  } catch(err) {
    console.log(err);
    var msg = {
      message: 'Memebot has fallen and can\'t get up',   // required
      title: "Memebot",
      sound: 'gamelan',
      device: 'iphone',
      priority: 1
    };
    p.send(msg, function(err, result) {
      if (err) throw err;
      console.log(result);
      process.exit(0);
    });
  }
});

// ADD
function add(message, words) {
  if (words.length < 5) {
    displayErrorText(message);
    return;
  }

  citizen = findCitizenByID(message.author.id)
  if (citizen == null) {
    citizen = {
      "name": message.author.username,
      "id": message.author.id,
      "votes": {}
    }
    citizens.push(citizen);
    console.log(citizens);
    saveCitizens();
  }

  var stream = ytdl(words[1]);
  var startTime = words[2];
  var endTime = words[3];

  var commands = [];
  for (var i = 4; i < words.length; i++) {
    commands.push(words[i].replace(',', ''));
  }

  for (var i = 0; i < commands.length; i++) {
    for (var j = 0; j < reservedWords.length; j++) {
      if (commands[i].toLowerCase() === reservedWords[j].toLowerCase()) {
        message.channel.sendMessage('The command **' + commadns[i] + '** is a reserved word. Please use a different name.');
        debug(message.author.username + ' tried to add the ' + commands[i] + ' command which is a reserved word')
      }
    }
  }

  for (var i = 0; i < memes.length; i++) {
    for (var j = 0; j < memes[i]['commands'].length; j++) {
      for (var k = 0; k < commands.length; k++) {
        if (memes[i]['commands'][j].toLowerCase() === commands[k].toLowerCase()) {
          message.channel.sendMessage('The command **' + commands[k] + '** already exists! Please delete it first.');
          debug(message.author.username + ' tried to add the ' + commands[k] + ' command which already exists')
          return;
        }
      }
    }
  }

  var endSeekOption = '-to ' + endTime;
  var filePath = makeFilePath('audio/', commands[0], '.mp3');

  blockedFile = commands[0] + '.mp3';
  ffmpeg(stream)
  .noVideo()
  .seekOutput(startTime)
  .format('mp3')
  .outputOptions(['-write_xing 0', endSeekOption])
  .save(filePath)
  .on('error', function(err, stdout, stderr) {
    console.log('Cannot process video: ' + err.message);
    debug(message.author.username + ' induced an ffmpeg error');
  })
  .on('end', function(err, stdout, stderr) {
    blockedFile = null;
  });

  var d = new Date()
  var meme = {
    name: commands[0],
    author: message.author.username,
    author_id: message.author.id,
    commands: commands,
    file: filePath.substring(6),
    dateAdded: d.toJSON(),
    lastPlayed: d.toJSON(),
    audioModifier: 1,
    playCount: 0
  };
  memes.push(meme);
  saveMemes();
  message.channel.sendMessage('Added ' + commands[0]);
  debug(message.author.username + ' added ' + filePath.substring(6));
}

// REMOVE
function remove(message, words) {
  var index = findIndexByCommand(words[1]);
  if (index === -1) {
    message.channel.sendMessage('Could not find meme by name: ' + words[1]);
    displayErrorText(message);
    return;
  }
  if (memes[index]['author_id'] == message.author.id) {
    deleteMemeByIndex(index)
    message.channel.sendMessage('Deleted ' + words[1]);
  } else {
    message.channel.sendMessage('Only the author may delete memes. Vote for a deletion with the !vote command.');
  }
}

// LIST
function list(message, words) {
  var names = '```';
  var count = names.length;
  if (words.length > 1 && words[1] == 'least') {
    memes.sort(compareMemesLeastRecent);
  } else {
    memes.sort(compareMemesMostRecent);
  }
  for (var i = 0; i < memes.length; i++) {
    memeName = memes[i]['name'];
    if (names.length + memeName.length + 2 <= 1999) {
      names += memeName;
      names += ', ';
    }
  }
  if (names.length > 1999) {
    names = names.substring(0, 1999);
  }
  names = names.substring(0, names.length - 2) + '```'
  message.channel.sendMessage(names);
}

// HELP
function help(message) {
  var helpText =
  '```![meme]  \nPlays an audio meme on your currently connected voice channel.\n\n!list\nA list of all meme names.\n\n!add [youtube link] [start time] [end time] [command 1, command 2, ...]\nAdds a meme from a youtube video, pulling audio from the start time to the end time. The name of the first command becomes the name of the meme. Start time and end time can take in seconds, hh:mm:ss format, and even decimals.\n\nEx. !add https://www.youtube.com/watch?v=6JaY3vtb760 2:31 2:45.5 Caveman shaggy scooby\n\n!delete [meme]\nDeletes the meme that with this name, if you were the person who added it.\n\n!random\nPlays a random meme.\n\n!info [meme]\nDisplays stats and alternate commands for a meme.\n\n!vote [meme] [yea/nay]\nAllows you to vote for a memes deletion. Yea votes to delete, while nay votes to keep (alternatively you can use remove/keep). You must have added a meme to vote on meme deletions. The meme will be deleted once it has recieved over 50% approval for its deletion.\n\n!help \nThis message.```';
  message.channel.sendMessage(helpText);
}

// INFO
function info(message, words) {
  var memeInput = words[1];
  if (memeInput == null) {
    displayErrorText(message);
    return;
  }
  var index = findIndexByCommand(memeInput);
  if (index === -1) {
    message.channel.sendMessage('Could not find meme by name: ' + words[0]);
    return;
  }
  var meme = memes[index];
  var output = '```name: ' + meme['name'] + '\ncommands: ';
  for (var i = 0; i < meme['commands'].length; i++) {
    output += meme['commands'][i] + ', ';
  }
  output = output.substring(0, output.length - 2);
  var dateLastPlayed = new Date(meme['lastPlayed']);
  var dateAdded = new Date(meme['dateAdded']);
  output += '\nauthor: ' + meme['author'];
  output += '\nlast played: ' + dateLastPlayed.toString();
  output += '\ndate added: ' + dateAdded.toDateString();
  output += '\naudio modifier: ' + meme['audioModifier'];
  output += '\nplay count: ' + meme['playCount'] + '```';
  message.channel.sendMessage(output);
}

// RANDOM
function random(message, words) {
  if (message.member.voiceChannel == null) {
    message.channel.sendMessage('You must join a voice channel to play the dank memes');
    return;
  }
  var randomIndex = Math.floor(Math.random() * memes.length);
  playFile(memes[randomIndex]['file'], message.member.voiceChannel);
}

// VOTE
function vote(message, words) {
  if (words.length < 2) {
    displayErrorText(message);
    return;
  }

  index = findIndexByCommand(words[1]);
  if (index === -1) {
    message.channel.sendMessage('Could not find meme by name: ' + words[1]);
    displayErrorText(message);
    return;
  }

  citizen = findCitizenByID(message.author.id)
  if (citizen == null) {
    message.channel.sendMessage('You must have added a meme to become a citizen of memebotopia');
    displayErrorText(message);
    return;
  }

  memeName = memes[index]['name']
  if (words[2] == 'yea' || words[2] == 'remove') {
    citizen['votes'][memeName] = true;
  } else if (words[2] == 'nay' || words[2] == 'keep') {
    citizen['votes'][memeName] = false;
  }

  resolution = '**Resolution to remove "' + memeName + '" and restore memebotopia to its former glory.**\n\n';

  yeas = 0;
  nays = 0;
  for (var i = 0; i < citizens.length; i++) {
    if (citizens[i]['votes'][memeName] === true) {
      yeas += 1;
    } else if (citizens[i]['votes'][memeName] === false) {
      nays += 1;
    }
  }

  resolution += (yeas + ' yea(s)\n');
  resolution += (nays + ' nay(s)');

  if (nays >= citizens.length / 2) {
    resolution += '\n\n The neas have it! The resolution is strcuk down.';
    clearVotes(memeName);
  } else if (yeas > citizens.length / 2) {
    resolution += '\n\n The ayes have it! The resolution is passed. The meme ' + memeName + ' has been deleted.';
    deleteMemeByIndex(index);
    clearVotes(memeName);
  } else if (yeas + nays >= citizens.length) {
    resolution += '\n\n Gridlock! The resolution dies.';
    clearVotes(memeName);
  } else {
    var votesNeeded = (citizens.length / 2) + 1 - yeas;
    resolution += '\n\n ' + votesNeeded + ' more yea(s) needed to pass this resolution.';
  }

  saveCitizens()
  message.channel.sendMessage(resolution);
}

// PLAY
function play(message, words) {
  if (message.member.voiceChannel == null) {
    message.channel.sendMessage('You must join a voice channel to play the dank memes');
    return;
  }
  var memeInput = words[0];
  if (words[0].length == 0 && words.length > 1) {
    var memeInput = words[1];
  }
  if (memeInput == null) {
    displayErrorText(message);
    return;
  }
  var index = findIndexByCommand(memeInput);
  if (index === -1) {
    message.channel.sendMessage('Could not find meme by name: ' + words[0]);
    return;
  }
  var file = memes[index]['file'];
  playFile(file, message.member.voiceChannel);
  var d = new Date()
  memes[index]['lastPlayed'] = d.toJSON()
  memes[index]['playCount'] += 1;
  saveMemes();
}

function playFile(file, voiceChannel) {
  if (!isPlaying && file !== blockedFile) {
    isPlaying = true;
    voiceChannel.join()
      .then(connection => {
        debug('Playing ' + file)
        const dispatcher = connection.playFile('audio/' + file, {volume: 0.50});
        dispatcher.on('end', () => {
          debug('Stopped playing ' + file)
          voiceChannel.leave();
          isPlaying = false;
        });
      })
      .catch(console.log);
  }
}

// HELPERS
function displayErrorText(message) {
  var errorText =
  'You did something wrong.\nType **!help** my adult son.';
  message.channel.sendMessage(errorText);
}

function trimWhitespace(str) {
  return str.replace(/\s+/g,' ').trim();
}

function findIndexByCommand(inputCommand) {
  if (!inputCommand) {
    return -1;
  }
  for (var i = 0; i < memes.length; i++) {
    var meme = memes[i];
    for (var j = 0; j < meme['commands'].length; j++) {
      var command = meme['commands'][j];
      if (inputCommand.toLowerCase() === command.toLowerCase()) {
        return i;
      }
    }
  }
  return -1;
}

function findCitizenByID(author_id) {
  for (var i = 0; i < citizens.length; i++) {
    if (citizens[i]['id'] == author_id) {
      return citizens[i];
    }
  }
  return null;
}

function makeFilePath(path, fileName, extension) {
  var number = 0;
  while (fs.existsSync(path + makeFileName(fileName, number) + extension)) {
    number++;
  }
  return path + makeFileName(fileName, number) + extension;
}

function makeFileName(fileName, number) {
  if (number === 0) {
    return fileName;
  } else {
    return fileName + number;
  }
}

function deleteMemeByIndex(index) {
  var file = memes[index]['file'];
  memes.splice(index, 1);
  saveMemes();
  try {
    fs.unlinkSync('audio/' + file);
  } catch (err) {
    console.log(err);
  }
  debug('Deleted ' + file);
}

function clearVotes(memeName) {
  for (var i = 0; i < citizens.length; i++) {
    delete citizens[i]['votes'][memeName];
  }
  saveCitizens();
}

function compareMemes(a, b) {
  return a['name'].toLowerCase().localeCompare(b['name'].toLowerCase());
}

function compareMemesMostRecent(a, b) {
  return b['playCount'] - a['playCount'];
}

function compareMemesLeastRecent(a, b) {
  return a['playCount'] - b['playCount'];
}

function compareCitizens(a, b) {
  return a['name'].toLowerCase().localeCompare(b['name'].toLowerCase());
}

function saveMemes() {
  memes.sort(compareMemes);
  fs.writeFileSync('memes.json', JSON.stringify(memes, null, 2));
}

function saveCitizens() {
  citizens.sort(compareCitizens);
  fs.writeFileSync('citizens.json', JSON.stringify(citizens, null, 2));
}

// DEBUG
function debug(msg) {
  if (debugMode) {
    console.log(msg);
  }
  var d = new Date();
  var timeString = d.getFullYear() + '-' + formatTime(d.getMonth() + 1) + '-' + formatTime(d.getDate()) + ' ' + formatTime(d.getHours()) + ':' + formatTime(d.getMinutes()) + ':' + formatTime(d.getSeconds());
  msg = '[' + timeString + '] ' + msg + '\n';
  fs.appendFile('debug.log', msg, function(err) {
      if(err) {
          return console.log(err);
      }
  });
}

function formatTime(time) {
  if (time <= 9) {
    return time = '0' + time;
  }
  return time;
}


client.login(DISCORD_TOKEN);
