const Plugin = require('.')
const plugin = new Plugin({
  account: '0x18046108a28e4ba1ed3d25ceb122be9ff7c38b54',
  server: 'btp+ws://:secret@localhost:6666'
})

async function run () {
  await plugin.connect()
  await plugin.sendMoney(50)
}

run()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
