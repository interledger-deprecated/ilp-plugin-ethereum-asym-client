'use strict'
const crypto = require('crypto')
const debug = require('debug')('ilp-plugin-ethereum-asym-client')
const BtpPacket = require('btp-packet')
const BigNumber = require('bignumber.js')
const Web3 = require('web3')
const Machinomy = require('machinomy').default
const PluginBtp = require('ilp-plugin-btp')

async function _requestId () {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(4, (err, buf) => {
      if (err) reject(err)
      resolve(buf.readUInt32BE(0))
    })
  })
}

class EthUnit extends BigNumber {
  constructor (amount, unit) {
    super(amount)
    if (!unit) {
      throw new Error('Must specify a unit of ether')
    }
    this.unit = unit
  }

  _transform (unit) {
    const orders = {
      wei: 0,
      gwei: 9,
      ether: 18
    }
    return new EthUnit(
      this.shift(orders[this.unit] - orders[unit]),
      unit
    )
  }

  wei () {
    return this._transform('wei')
  }

  gwei () {
    return this._transform('gwei')
  }

  ether () {
    return this._transform('ether')
  }

  ethStr () {
    return this.ether().toString() + ' ETH'
  }
}

class Plugin extends PluginBtp {
  constructor (opts) {
    super(opts)
    this._account = opts.account
    this._db = opts.db || 'machinomy_db'
    this._provider = opts.provider || 'http://localhost:8545'
    this._minimumChannelAmount = new EthUnit(opts.minimumChannelAmount || 1, 'gwei')
    this._web3 = new Web3(typeof this._provider === 'string'
      ? new Web3.providers.HttpProvider(this._provider)
      : this._provider)
    this._receiver = null
  }

  async _connect () {
    this._machinomy = new Machinomy(this._account, this._web3, {
      databaseUrl: 'nedb://' + this._db,
      minimumChannelAmount: this._minimumChannelAmount.wei()
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

    this._peerAccount = '0x' + info.ethereumAccount.substring(2).toUpperCase()
    const result = await this._machinomy.channelManager.requireOpenChannel(
      this._account,
      this._peerAccount,
      this._minimumChannelAmount.wei()
    )

    const format = n => new EthUnit(n, 'wei').ethStr()
    debug('got payment channel. channelId=', result.channelId,
      `spent ${format(result.spent)} / ${format(result.value)}`,
      'receiver=', result.receiver
    )
    this._channel = result.channelId
    this._receiver = result.receiver

    // TODO: should we store whether we've paid the upfront cost
    if (!info.clientChannel) {
      await this.sendMoney(info.minimumChannelAmount)
    }
  }

  async _disconnect () {
    await this._settle()
    await this._machinomy.shutdown()
  }

  async _settle () {
    // Settle channels for which this client is a receiver and are ready to be settled
    const channels = (await this._machinomy.channels()).filter(
      c => c.receiver === this._account && c.state === 0
    )
    return Promise.all(
      channels.map(c => {
        debug('settling payment channel for', new EthUnit(c.spent, 'wei').ethStr())
        return this._machinomy.close(c.channelId)
      })
    )
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
    const price = new EthUnit(amount, 'gwei')

    // Don't bother sending channel updates for 0 amounts
    if (price.eq(0)) {
      return
    }

    const channels = await this._machinomy.channels()
    const currentChannel = channels
      .filter(c => c.channelId === this._channel)[0]

    // Deposit enough to the existing channel to cover the payment instead of opening a new one
    const depositAmount = price.wei()
      .plus(currentChannel.spent)
      .minus(currentChannel.value)
    if (depositAmount.gt(0)) {
      debug(`funding channel for ${depositAmount.ethStr()}`)
      await this._machinomy.deposit(this._channel, depositAmount)
    }

    // If a channel is sufficiently funded, Machinomy uses that; if not, it opens a new one
    const {payment} = await this._machinomy.payment({
      receiver: this._receiver,
      price
    })

    // TODO: how should I debug this?
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
      const payment = JSON.parse(primary.data.toString())
      await this._machinomy.acceptPayment({ payment })

      const amount = new EthUnit(payment.price, 'wei').gwei()
      debug('got payment for', amount.ethStr())
      
      if (!this._moneyHandler) {
        throw new Error('no money handler registered')
      }
      
      if (amount.gt(0)) {
        await this._moneyHandler(amount.toString())
      }
    }
  }
}

module.exports = Plugin
