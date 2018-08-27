const logger = require('../helpers/logger.js')

module.exports = function (message) {
  // Help output
  const helpText =
`\`\`\`
![meme]
Plays an audio meme on your currently connected voice channel.

!list [most/least/newest/oldest/tags/<tag>]
A list of memes. If no modifier is given, the list defaults to alphabetical order.

!add [youtube link] [start time] [end time] [command 1, command 2, ...]
Adds a meme from a youtube video, pulling audio from the start time to the end time. The name of the first command becomes the name of the meme. Start time and end time can take in seconds, hh:mm:ss format, and even decimals.

Ex. !add https://www.youtube.com/watch?v=6JaY3vtb760 2:31 2:45.5 Caveman shaggy scooby

!delete [meme]
Deletes the meme that with this name, if you were the person who added it.

!random [tag]
Plays a random meme. If the tag option is used, will play a random memes with that tag.

!info [meme]
Displays stats and alternate commands for a meme.

!volume [meme] [audio modifier]
Sets an audio modifier for the meme, such that 0.5 is half the normal volume and 2.0 is twice the normal volume.

!(un)alias [meme] [command 1, command 2, ...]
Adds or removes commands for the meme. Cannot remove the first command given to the meme.

!(un)tag [meme] [tag 1, tag 2, ...]
Adds or removes tags for the meme.

!stats
Displays memebot stats

!help
This message.
\`\`\``

  // Send message
  logger.info(`${message.author.username} requested help`)
  message.channel.send(helpText)
}
