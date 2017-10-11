const { ShardingManager } = require('discord.js')
var ArgumentParser = require('argparse').ArgumentParser
require('dotenv').config()

const DISCORD_LEECH_TOKEN = process.env.DISCORD_LEECH_TOKEN
var debugMode = false

// ARGUMENT PARSER
var parser = new ArgumentParser({
  version: '0.1',
  addHelp: true,
  description: 'A Discord bot that only plays memes'
})
parser.addArgument(
  [ '-d', '--debug' ],
  {
    help: 'Enables logging to the console',
    action: 'storeTrue'
  }
)
var args = parser.parseArgs()
debugMode = args.debug

var shardArgs = debugMode ? ['-d'] : []

const manager = new ShardingManager('leech.js', {token: DISCORD_LEECH_TOKEN, shardArgs: shardArgs})

manager.spawn()
manager.on('launch', function (shard) {
  console.log('Successfully launched shard ' + shard.id)
})
