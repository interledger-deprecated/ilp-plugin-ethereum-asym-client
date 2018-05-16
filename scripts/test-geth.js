const Plugin = require('..')
const crypto = require('crypto')
const IlDcp = require('ilp-protocol-ildcp')
const IlpPacket = require('ilp-packet')
function sha256(preimage) { return crypto.createHash('sha256').update(preimage).digest() }
if (typeof process.env.ADDRESS == 'undefined') {
  console.error('Please set the ADDRESS env var to your Ethereum address!')
  process.exit(1)
}
console.log('Connecting to Amundsen, settling over Machinomy Ethereum, using address:', process.env.ADDRESS)

const plugin = new Plugin({
  account: '0x' + process.env.ADDRESS.substring(2).toUpperCase(),
  // provider: 'https://ropsten.infura.io/QIQwjA7rQvIVca6Z4Tjl',
  server: 'btp+wss://:token@amundsen.ilpdemo.org:1813'
})
console.log('connecting')
plugin.connect().then(async () => {
  console.log('connected')
  const request = IlDcp.serializeIldcpRequest()
  const response = await plugin.sendData(request)
  const info = IlDcp.deserializeIldcpResponse(response)
  const fulfillment = crypto.randomBytes(32)
  const condition = sha256(fulfillment)
  console.log(`\n\nNow go to https://interfaucet.ilpdemo.org/?address=${info.clientAddress}&condition=${condition.toString('hex')}\n\n`)
  plugin.registerDataHandler(packet => {
    const prepare = IlpPacket.deserializeIlpPrepare(packet)
    console.log(prepare)
    return IlpPacket.serializeIlpFulfill({ fulfillment: fulfillment, data: Buffer.from([]) })
  })
  plugin.registerMoneyHandler(packet => {
    console.log('got money!', packet)
    plugin.disconnect()
  })
})
