const Plugin = require('..')
const IlDcp = require('ilp-protocol-ildcp')
const IlpPacket = require('ilp-packet')
const HDWalletProvider = require('truffle-hdwallet-provider')
function sha256(preimage) { return crypto.createHash('sha256').update(preimage).digest() }
if (typeof process.env.PROVIDER_URL == 'undefined' || typeof process.env.SECRET == 'undefined') {
  console.error('Please set the PROVIDER_URL and SECRET env vars!')
  process.exit(1)
}

const provider = new HDWalletProvider(process.env.SECRET, process.env.PROVIDER_URL)
// const account = '0x' + provider.address.substring(2).toUpperCase()
const account = '0x' + provider.getAddress(0).substring(2).toLowerCase()
console.log('Connecting to local port 6666, settling over Machinomy Ethereum, account:', account)

const plugin = new Plugin({
  account,
  provider,
  // server: 'btp+wss://:token@amundsen.ilpdemo.org:1813'
  server: 'btp+ws://:token@localhost:6666'
})
console.log('connecting')
plugin.connect().then(async () => {
  console.log('connected')
  const request = IlDcp.serializeIldcpRequest()
  const response = await plugin.sendData(request)
  const info = IlDcp.deserializeIldcpResponse(response)
  // plugin.registerDataHandler(packet => {
  //   const prepare = IlpPacket.deserializeIlpPrepare(packet)
  //   console.log('got data', prepare)
  //   return IlpPacket.serializeIlpFulfill({ fulfillment: crypto.randomBytes(32), data: Buffer.from([]) })
  // })
  // plugin.registerMoneyHandler(packet => {
  //   console.log('got money!', packet)
  // })
  console.log('sending money')
  await plugin.sendMoney(10)
  console.log('sending money')
  await plugin.sendMoney(10)
  console.log('sending money')
  await plugin.sendMoney(10)
  console.log('disconnecting')
  await plugin.disconnect()
  console.log('done')
}, err => console.error(err))
