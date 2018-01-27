'use strict'
const crypto = require('crypto')
const debug = require('debug')('ilp-plugin-ethereum-asym-client')
const BtpPacket = require('btp-packet')
const BigNumber = require('bignumber.js')
const Web3 = require('web3')
const Machinomy = require('machinomy').default
const Payment = require('machinomy/lib/payment').default
const PluginBtp = require('ilp-plugin-btp')

async function _requestId () {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(4, (err, buf) => {
      if (err) reject(err)
      resolve(buf.readUInt32BE(0))
    })
  })
}

class Plugin extends PluginBtp {
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
    this._machinomy = new Machinomy(this._account, this._web3, {
      engine: 'nedb',
      databaseFile: this._db,
      minimumChannelAmount: this._minimumChannelAmount
    })

    const infoResponse = await this._call(null, {
      type: BtpPacket.TYPE_MESSAGE,
      requestId: await _requestId(),
      data: { protocolData: [{
        protocolName: 'info',
        contentType: BtpPacket.MIME_APPLICATION_OCTET_STREAM,
        data: Buffer.from([ 2 ])
      }] }
    })

    const info = JSON.parse(infoResponse.protocolData[0].data.toString())
    debug('got info. info=', info)

    this._peerAccount = info.ethereumAccount
    const result = await this._machinomy.requireOpenChannel(
      this._account,
      this._peerAccount,
      this._minimumChannelAmount)

    debug('got payment channel. channelId=' + result.channelId,
      'value=' + result.value.toString(),
      'spent=' + result.spent.toString(),
      'receiver=' + result.receiver)
    this._channel = result.channelId

    // TODO: should we store whether we've paid the upfront cost
    if (!info.clientChannel) {
      await this.sendMoney(info.minimumChannelAmount)
    }
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
    const channels = await this._machinomy.channels()
    const currentChannel = channels
      .filter(c => c.channelId === this._channel)[0]

    if (currentChannel.spent.add(amount).gte(currentChannel.value)) {
      // TODO: do this pre-emptively and asynchronously
      debug('funding channel for', currentChannel.value.toString())
      await this._machinomy.deposit(this._channel, currentChannel.value)
    }

    const payment = await this._machinomy.nextPayment(
      this._channel,
      new BigNumber(amount),
      '')

    debug('sending payment.', payment)
    return this._call(null, {
      type: BtpPacket.TYPE_TRANSFER,
      requestId: await _requestId(),
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
      await this._machinomy.acceptPayment(payment)
      debug('got payment. amount=' + payment.price.toString())
      if (payment.price.gt(0) && this._moneyHandler) {
        await this._moneyHandler(payment.price.toString())
      }
    }
  }
}

module.exports = Plugin
