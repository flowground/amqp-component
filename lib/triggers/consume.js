'use strict';
const eioUtils = require('elasticio-node').messages;
const co = require('co');
const amqp = require('amqplib');
const encryptor = require('../encryptor.js');

var conn, channel;

module.exports.process = processAction;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
function processAction(msg, cfg) {
  console.log('Trigger started, cfg=%j', cfg);
  const amqpURI = cfg.amqpURI;
  const amqpExchange = cfg.topc;

  co(function*() {
    if (!conn) {
      console.log('Connecting to amqpURI=%s', amqpURI);
      conn = yield amqp.connect(amqpURI);
    }
    if (!channel) {
      console.log('Creating a confirm channel');
      channel = yield conn.createConfirmChannel();
      console.log('Asserting topic exchange exchange=%s', amqpExchange);
      yield channel.assertExchange(amqpExchange, 'topic');
    }
    console.log('Publishing message id=%s', msg.id);
    let encryptedData = encryptor.encryptMessageContent({
      id: msg.id,
      body: msg.body,
      attachments: msg.attachments
    });
    channel.publish(amqpExchange, 'foo', encryptedData);
    console.log('Message published id=%s', msg.id);
    yield channel.waitForConfirms();
    console.log('Message publishing confirmed id=%s', msg.id);
    this.emit('data', msg);
    this.emit('end');
  }.bind(this)).catch(err => {
    console.log('Error occurred', err.stack || err);
    this.emit('error', err);
    this.emit('end');
  });
}