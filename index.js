'use strict'
const debug = require('debug')('ilp-plugin-ethereum-asym-client')
const BtpPacket = require('btp-packet')
const BigNumber = require('bignumber.js')
const Web3 = require('web3')
const Machinomy = require('machinomy').default
const Payment = require('machinomy/lib/payment').default
const PluginBtp = require('ilp-plugin-btp')

class Plugin extends BtpPlugin {
  constructor (opts) {
    super(opts)
    this._account = opts.account
    this._db = opts.db || 'machinomy_db'
    this._provider = opts.provider || 'http://localhost:8545'
    this._minimumChannelAmount = opts.minimumChannelAmount || 100
    this._web3 = new Web3(typeof this._provider === 'string'
      ? new Web3.providers.HttpProvider(this._provider)
      : this._provider)
  }

  async _connect () {
    this.machinomy = new Machinomy(this.account, this.web3, {
      engine: 'nedb',
      databaseFile: this.db,
      minimumChannelAmount: this.minimumChannelAmount
    })

    const infoResponse = await this._call(null, {
      type: BtpPacket.TYPE_MESSAGE,
      requestId: await util._requestId(),
      data: { protocolData: [{
        protocolName: 'info',
        contentType: BtpPacket.MIME_APPLICATION_OCTET_STREAM,
        data: Buffer.from([ util.INFO_REQUEST_ALL ])
      }] }
    })

    const info = JSON.parse(infoResponse.protocolData[0].data.toString())
    debug('got info. info=', info)

    this._peerAccount = info.ethereumAccount
    this._channel = await this.machinomy.requireOpenChannel(
      this._account,
      this._peerAccount,
      this._minimumChannelAmount)
  }

  async _disconnect () {
    // closes the machinomy channel at a different date
  }

  async _handleData (from, { requestId, data }) {
    const { ilp } = this.protocolDataToIlpAndCustom(data)
    if (!this._dataHandler) {
      throw new Error('no request handler registered')
    }

    const response = await this._dataHandler(ilp)
    return this.ilpAndCustomToProtocolData({ ilp: response })
  }

  async sendMoney (amount) {
    const payment = await this.machinomy.nextPayment(
      this._channel,
      new BigNumber(amount),
      '')

    return this._call(null, {
      type: BtpPacket.TYPE_TRANSFER,
      requestId: await util._requestId(),
      data: {
        amount,
        protocolData: [{
          protocolName: 'machinomy',
          contentType: BtpPacket.MIME_APPLICATION_JSON,
          data: Buffer.from(JSON.stringify(payment))
        }]
      }
    })
  }

  async _handleMoney (from, { requestId, data }) {
    const primary = data.protocolData[0]
    if (primary.protocolName === 'machinomy') {
      const payment = new Payment(JSON.parse(primary.data.toString()))
      await this.machinomy.acceptPayment(payment)
      if (payment.price > 0 && this._moneyHandler) {
        await this._moneyHandler(payment.price)
      }
    }
  }
}
