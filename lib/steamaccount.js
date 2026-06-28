"use strict"

const _ = require("lodash")
const SteamUser = require("steam-user")
const SteamTotp = require("steam-totp")
const Promise = require("bluebird")
const moment = require("moment")
const EventEmitter = require("events")

module.exports = class SteamAccount extends EventEmitter {
  constructor(name, password, machineAuthToken, secret, games, indent = 0) {
    super()
    this.name = name
    this.password = password
    this.machineAuthToken = machineAuthToken
    this.secret = secret
    this.games = games
    this.indent = indent
    this.client = new SteamUser({ dataDirectory: null })

    this.client.on("error", err => this.emit("clientError", err))
    this.client.on("steamGuard", () => this.emit("clientSteamGuard"))
    this.client.once("steamGuard", () => (this.steamGuardRequested = true))
  }

  logheader() {
    return _.padEnd(
      `[${moment().format("YYYY-MM-DD HH:mm:ss")} - ${this.name}]`,
      this.indent
    )
  }

  error(err) {
    return this.emit("customError", err)
  }

  _buildLogOnDetails() {
    const details = {
      accountName: this.name,
      password: this.password
    }
    if (this.machineAuthToken) details.machineAuthToken = this.machineAuthToken
    if (this.secret) details.twoFactorCode = SteamTotp.generateAuthCode(this.secret)
    return details
  }

  login() {
    if (this.client.steamID) return Promise.resolve()
    if (this.steamGuardRequested && !this.secret) return Promise.reject("Steam guard requested!")

    return new Promise((resolve, reject) => {
      this.once("clientError", reject)
      this.once("clientSteamGuard", () => reject("Steam guard requested!"))
      this.client.once("loggedOn", resolve)
      this.client.logOn(this._buildLogOnDetails())
    })
      .timeout(10000)
      .catch(Promise.TimeoutError, () => Promise.reject("Timed out at login"))
      .finally(() => {
        this.removeAllListeners("clientError")
        this.removeAllListeners("clientSteamGuard")
        return this.client.removeAllListeners("loggedOn")
      })
  }

  logoff() {
    if (!this.client.steamID) return
    this.client.gamesPlayed([])
    return this.client.logOff()
  }

  boost() {
    return this.login()
      .then(() => {
        this.client.setPersona(SteamUser.EPersonaState.Offline)
        this.client.gamesPlayed(this.games !== null ? this.games : [10, 730])
        return console.log(`${this.logheader()} Starting to boost games!`)
      })
      .catch(err => console.error(`${this.logheader()} ${err}`))
  }

  restartGames() {
    this.client.gamesPlayed([])
    return Promise.delay(5000).then(() => this.boost())
  }
}
