# Memebot

Memebot lets you add, play, and share your favorite memes on your discord server.

* Add memes from your channel from youtube
* Play memes with commands
* Moderate memes
* Keep track of meme stats

## Usage
Once installed and the server is up and running, memebot can be controlled completely from your text channel with the following commands:

`!help` - list of commands  
`!add` - add memes from youtube link  
`!list` - list of your memes  
`!delete` - remove unwanted memes  
`!random` - plays a random memes  
`!info` - stats about your memes  
`![meme]` - plays the meme on your currently connected voice channel

**PSA: You must be connected to a voice channel to play memes**

## Registering a bot with Discord

You will first need to create a new bot on your Discord account. Once you have done that, you can use the app user bot token to connect to the server. Discord has made a  [guide](https://discordapp.com/developers/docs/intro "discordapp.com") to help make new bots.

## Installation

These installation is for unix-like environments (i.e. Linux and OSX). You may have to do more work to install on Windows.

**Installing node.js**  
Install node.js version 6.0.0 or later. I reccomend using [nvm](https://github.com/creationix/nvm) to install and manage versions of node.

**Download repository**  
```
git clone --bare https://github.com/arjunchib/memebot
```

**Install dependicies**  
```
cd memebot
npm install
```

# Setting up environment

**Create environment file**  
Create a .env file in the memebot directory.  
```
nano .env
```

**Declare environement variables**  
Enter these values into your .env file. Only the `DISCORD_TOKEN` is required. If you do not want to have an account with admin privileges, leave out the `ADMIN_USER_ID` line.
```
DISCORD_TOKEN=<YOUR DISCORD TOKEN>
ADMIN_USER_ID=<YOUR DISCORD USER ID>
```

Your Discord app token is found in the [Discord Dev Portal](https://discordapp.com/developers/applications/me) in your app page. Copy the token under `APP BOT USER` and use that string for `<YOUR DISCORD TOKEN>`.

Follow this [support guide](https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-) to find your `ADMIN_USER_ID`.

## Running Memebot

In the memebot directory run
```
node index.js
```

To stop the server enter `Ctrl-C`

I reccomend using [screen](https://www.linode.com/docs/networking/ssh/using-gnu-screen-to-manage-persistent-terminal-sessions) to manage server sessions.

## Adding bot to your Discord server

Go back to the [Discord Dev Portal](https://discordapp.com/developers/applications/me) and open your app. This time copy the string under `Client ID`. Replace `<CLIENT ID>` with your Client ID in the link below:

```
https://discordapp.com/oauth2/authorize?&client_id=<CLIENT ID>&scope=bot&permissions=0
```

Visit the link in your web browser and follow the instructions to add your bot to your Discord server.
