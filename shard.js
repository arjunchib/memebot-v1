const { ShardingManager } = require('discord.js')
const manager = new ShardingManager('leech.js')

manager.spawn()
manager.on('launch', function (shard) {
  console.log('Successfully launched shard ' + shard.id)
})
