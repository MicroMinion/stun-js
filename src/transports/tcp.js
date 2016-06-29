'use strict'

var net = require('net')
var Q = require('q')

var debug = require('debug')
var debugLog = debug('stun-js:transports:tcp')
var errorLog = debug('stun-js:transports:tcp:error')

function TcpWrapper () {
}

TcpWrapper.prototype.init = function (host, port) {
  var self = this
  this._host = host
  this._port = port
  this._client = net.createConnection(this._port, this._host)
  this._client.on('error', this._onError)
  this._client.on('data', function (bytes) {
    debugLog('[conn: ' + self._client.localPort + '] incoming data: ' + bytes.length + ' bytes')
    var rinfo = {}
    rinfo.address = self._host
    rinfo.port = parseInt(self._port, 10)
    rinfo.family = net.isIPv4(self._host) ? 'IPv4' : 'IPv6'
    rinfo.size = bytes.length
    self._onData(bytes, rinfo, false)
  })
}

TcpWrapper.prototype.send = function (bytes, onSuccess, onFailure) {
  debugLog('[conn: ' + this._client.localPort + '] outgoing data: ' + bytes.length + ' bytes')
  if (onSuccess === undefined || onFailure === undefined) {
    var error = 'tcp send bytes callback handlers are undefined'
    errorLog(error)
    throw new Error(error)
  }
  var self = this
  var flushed = this._client.write(bytes, 'binary', function () {
    debugLog('[conn: ' + self._client.localPort + '] message sent')
  })
  if (!flushed) {
    debugLog('[conn: ' + this._client.localPort + '] high water -- buffer size = ' + this._client.bufferSize)
    this._client.once('drain', function () {
      debugLog('[conn: ' + self._client.localPort + '] drained -- buffer size = ' + self._client.bufferSize)
      onSuccess()
    })
  } else {
    onSuccess()
  }
}

TcpWrapper.prototype.sendP = function (bytes) {
  var deferred = Q.defer()
  var self = this
  this.send(
    bytes,
    function () { // on success
      deferred.resolve()
    },
    function (error) {
      var errorMsg = 'tcp wrapper could not send bytes to ' + self._host + ':' + self._port + '. ' + error
      errorLog(errorMsg)
      deferred.reject(errorMsg)
    }
  )
  return deferred.promise
}

TcpWrapper.prototype.close = function (done) {
  this._client.once('close', function () {
    if (done) {
      done()
    }
  })
  this._client.destroy()
}

TcpWrapper.prototype.closeP = function () {
  var deferred = Q.defer()
  this.close(
    function () { // on success
      deferred.resolve()
    }
  )
  return deferred.promise
}

TcpWrapper.prototype.onData = function (callback) {
  this._onData = callback
}

TcpWrapper.prototype.onError = function (callback) {
  this._onError = callback
}

module.exports = TcpWrapper
