# memebot
Memebot lets you add, play, and share your favorite memes on your discord server.

* add memes from your channel from youtube
* play memes with easy commands
* remove undank memes
* lookup meme stats

# How to use
Once installed and the server is up and running, memebot can be controlled completely from your text channel.

Commands:
* !help - list of commands
* !add - add memes from youtube link
* !list - list of your memes
* !delete - remove unwanted memes
* !random - plays a random memes
* !info - stats about your memes
* ![meme] - plays the meme on your currently connected voice channel

# Installation
You will first need to create a new bot on your discord account. Once you have done that you can use the app user bot token to connect to the server. More about creating a discord bot can be found [here](https://discordapp.com/developers/docs/intro "discordapp.com").

You will need to have node.js v6+ installed. Either install with nvm or from  [nodejs.org](https://nodejs.org/en/download/ "nodejs.org").

Download the zip and unzip where you want to store the memebot server

Add your discord token to your .bashrc file  
`export DISCORD_TOKEN="<DISCORD_TOKEN>"`

Reload your bash profile  
`source .bashrc`

Go to the memebot directory

Run the membot server with  
`node index.js`

Memebot is ready to use in discord
