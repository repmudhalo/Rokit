// Base class every chat source extends. The hub only ever talks to a source
// through this interface, so adding a platform = subclass + implement start().
//
// A source's job: connect to its platform, and for every chat message call
// `this.emit(normalizedMessage)`. Use makeMessage() to build that object.

import { EventEmitter } from 'node:events'

export class ChatSource extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} opts.platform  - 'twitch' | 'kick' | 'x'
   * @param {string} opts.channel   - channel/slug this instance handles
   */
  constructor({ platform, channel }) {
    super()
    this.platform = platform
    this.channel = channel
    this.connected = false
  }

  // Override in subclasses. Should connect and begin emitting 'message' events.
  async start() {
    throw new Error(`${this.platform} source did not implement start()`)
  }

  // Override in subclasses to cleanly tear down sockets/timers.
  async stop() {}

  // Subclasses call this for each received chat message.
  emitMessage(msg) {
    this.emit('message', msg)
  }

  // Lightweight, consistent logging tag for a source instance.
  log(...args) {
    console.log(`[${this.platform}:${this.channel}]`, ...args)
  }
}
