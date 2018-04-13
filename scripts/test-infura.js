const Plugin = require('..')
const crypto = require('crypto')
const IlDcp = require('ilp-protocol-ildcp')
const IlpPacket = require('ilp-packet')
const HDWalletProvider = require('truffle-hdwallet-provider')
function sha256(preimage) { return crypto.createHash('sha256').update(preimage).digest() }
if (typeof process.env.RINKEBY_PROVIDER_URL == 'undefined' || typeof process.env.SECRET == 'undefined') {
  console.error('Please set the RINKEBY_PROVIDER_URL and SECRET env vars!')
  process.exit(1)
}

console.log('creating provider')
const provider = new HDWalletProvider(process.env.SECRET, process.env.RINKEBY_PROVIDER_URL)
console.log(provider)
// const account = '0x' + provider.address.substring(2).toUpperCase()
const account = '0x' + provider.address.substring(2).toLowerCase()
console.log('Connecting to Amundsen, settling over Machinomy Ethereum Rinkeby, account:', account)

const plugin = new Plugin({
  account,
  provider,
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
