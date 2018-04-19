# ILP Plugin Ethereum Asym Client
> Client to Ethereum Asym Server

- [Description](#description)
- [Usage](#usage)

## Description

**This plugin is still under development. Don't use it for large amounts of money.**

This is an implementation of an ILP integration with Ethereum. It uses simple
unidirectional payment channels on Ethereum, by making use of the
[Machinomy](https://github.com/machinomy/machinomy) library.

One party must run an [Ethereum Asym
Server](https://github.com/sharafian/ilp-plugin-ethereum-asym-server) instance,
and then any number of clients can connect by using this Asym Client. Each
client opens a payment channel to the server, and will immediately send a
claim. This claim is to cover the transaction fee of the server opening a
channel to the client. The end result is that the server and client have two
payment channels, allowing either one to send and receive.

Interleger packets are passed over the websocket connection that the client and
server share, and then are periodically settled by passing claims over the
websocket connection. The [ILP
Connector](https://github.com/interledgerjs/ilp-connector) will manage this
logic for you.

Because this plugin allows you to connect to the Interledger, you can use your
Ether to pay anyone else on the network, regardless of what system they choose
to use.

## Usage

You must have a local ethereum provider running in order to use this plugin.
The Machinomy contracts must be deployed on the chain that you connect to.

```js
new PluginEthereumAsymClient({
  account: '0x....', // Your ethereum account
  db: 'machinomy_db', // The db file created by machinomy
  provider: 'http://localhost:8545', // ethereum provider 
  minimumChannelAmount: '10000', // amount with which to fund the channel
})
```

## Connecting to a local server

* Follow the instructions from https://github.com/interledgerjs/ilp-plugin-ethereum-asym-server/blob/1db56bd25e20e1c93576da0bc499f7ab217101f8/README.md#usage
* Sign up on https://infura.io and get your PROVIDER_URL from them
* That service doesn't support private accounts, so for that, choose a SECRET
* Using this PROVIDER_URL and SECRET, in a separate window from the one running the server, run the clients:
```sh
export PROVIDER_URL=https://ropsten.infura.io/QIQwjA7rQvIVca6Z4Tjl
export SECRET=ietah3IeZ0Zun4Se2daf3ieVia8Xeengahx8quo0
npm install
DEBUG=* node scripts/test-infura-local.js
```

## Connecting to the testnet (easy way)

* Sign up on https://infura.io and get your PROVIDER_URL from them
* That service doesn't support private accounts, so for that, choose a SECRET
* Using this PROVIDER_URL and SECRET, run:
```sh
export PROVIDER_URL=https://ropsten.infura.io/QIQwjA7rQvIVca6Z4Tjl
export SECRET=ietah3IeZ0Zun4Se2daf3ieVia8Xeengahx8quo0
npm install
DEBUG=* node scripts/test-infura.js
```

## Connecting to the testnet (hard way)

* Follow the instructions from https://gist.github.com/cryptogoth/10a98e8078cfd69f7ca892ddbdcf26bc
* Make sure to run `geth --testnet --rpc` instead of just `geth --testnet`
* In another terminal window, run:
```sh
npm install
DEBUG=* ADDRESS=0xb9458d0076cc76d4568ebaac482ace6f1b30becb node scripts/test-geth.js
```
