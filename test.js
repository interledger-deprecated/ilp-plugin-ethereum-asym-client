const Plugin = require('.')
const IlpPacket = require('ilp-packet')
const plugin = new Plugin({
  account: '0x18046108a28e4ba1ed3d25ceb122be9ff7c38b54',
  server: 'btp+ws://:secret@localhost:6666'
})

const plugin2 = new Plugin({
  account: '0x18046108a28e4ba1ed3d25ceb122be9ff7c38b54',
  server: 'btp+ws://:secret_2@localhost:6666',
  db: 'machinomy_db_2'
})

const fulfillment = Buffer.from(
  'Qc4XjnucqgbulbDxZsZrJc3ddA8PsLEaILMSSMVSfJM', 'base64')

async function run () {
  await plugin.connect()
  // await plugin2.connect()
  // while (true) {
    plugin.registerDataHandler(data => {
      console.log("GOT DATA", data)
      return IlpPacket.serializeIlpFulfill({
        fulfillment,
        data: Buffer.alloc(0)
      })
    })
    //await plugin.sendMoney(50)
    // await new Promise(resolve => setTimeout(resolve, 2000))
    // await plugin2.sendMoney(50)
    // await new Promise(resolve => setTimeout(resolve, 2000))
  // }
}

run()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
