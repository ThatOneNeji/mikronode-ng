/* jshint undef: true, unused: true */
/* globals Promise */
const net = require('node:net');
const tls = require('node:tls');
const events = require('node:events');
const crypto = require('node:crypto');
const util = require('node:util');
const dbg = require('debug');
const utils = require('./utils');
const Channel = require('./channel');
const Trap = require('./trap');

module.exports = (function () {

    const debugSocket = dbg('mikronode-ng:socket');
    const debugSocketData = dbg('mikronode-ng:socket:data');
    const debugLogin = dbg('mikronode-ng:login');
    const debugSentence = dbg('mikronode-ng:sentence');
    const debugConnection = dbg('mikronode-ng:connection');
    const debugPromise = dbg('mikronode-ng:promise');

    const _ = require('private-parts').createKey();
    const emptyString = String.fromCodePoint(0);

    const reconnectDefaults = {
        retries: Infinity,
        delay: 1000,
        maxDelay: 30000,
        factor: 2
    };

    /**
     * Normalizes the reconnect option into a settings object, or null if disabled.
     * @private
     * @param {(boolean|object)} opt
     * @returns {?object}
     */
    function normalizeReconnect(opt) {
        if (!opt) {
            return null;
        }
        if (opt === true) {
            return Object.assign({}, reconnectDefaults);
        }
        return Object.assign({}, reconnectDefaults, opt);
    }

    /**
     * Emitted when a non-recoverable error has occurred on the socket. No further commands
     * can be processed on any channel.
     * @event mikronode-ng.Connection#event:error
     * @property {error} error - The error object
     * @property {mikronode-ng.Connection} connection - The connection originating the
     *           event
     */
    /**
     * Emitted when a socket has been idle too long.
     * @event mikronode-ng.Connection#event:timeout
     * @property {string} message - 'Socket Timeout'
     * @property {boolean} socketStillOpen - If true, communications can continue
     * @property {mikronode-ng.Connection} connection - The connection originating the
     *           event
     */
    /**
     * Emitted when the connection is closed either by an explicit call to
     * {@link mikronode-ng.Connection#close} or when the connection is closed automatically
     * via {@link mikronode-ng.Connection#closeOnDone}
     * @event mikronode-ng.Connection#event:close
     * @property {mikronode-ng.Connection} connection - The connection originating the
     *           event
     */
    /**
     * Emitted when a login has failed. No further commands can be processed on any
     * channel.
     * @event mikronode-ng.Connection#event:trap
     * @property {mikronode-ng.Trap} trap - The trap object
     */
    /**
     * Emitted before each reconnect attempt when an unexpected disconnect occurs and
     * {@link mikronode-ng.Connection#reconnect} is configured.
     * @event mikronode-ng.Connection#event:reconnecting
     * @property {number} attempt - The reconnect attempt number (starting at 1)
     * @property {number} delay - Milliseconds until the attempt is made
     * @property {mikronode-ng.Connection} connection - The connection originating the
     *           event
     */
    /**
     * Emitted when a reconnect attempt succeeds and the connection is authenticated
     * again. Any channels that were open before the disconnect are gone by this point -
     * reopen whatever channels you need from this event.
     * @event mikronode-ng.Connection#event:reconnected
     * @property {mikronode-ng.Connection} connection - The connection originating the
     *           event
     */

    /**
     * <strong>An instance of Connection is fully self-contained. You can have as many open
     * in parallel in the same node process as your environment can handle.</strong>
     * <p>
     * @exports mikronode-ng.Connection
     * @class
     * @implements {EventEmitter}
     * @param {string} host - The host name or ip address
     * @param {string} user - The user name
     * @param {string} password - The users password
     * @param {object} [options]
     * @param {number} [options.port=8728] - Sets the port if not the standard 8728 (8729
     *           for TLS).
     * @param {boolean} [options.closeOnDone=false] - If set, when the last channel closes,
     *           the connection will automatically close.
     * @param {number} [options.timeout=0] - Sets the socket inactivity timeout. A timeout
     *           does not necessarily mean that an error has occurred, especially if you're
     *           only listening for events.
     * @param {boolean} [options.closeOnTimeout=false] - If set, when a socket timeout
     *           happens the connection will automatically close.
     * @param {(object|boolean)} [options.tls] - Set to true to use TLS for this
     *           connection. Set to an object to use TLS and pass the object to tls.connect
     *           as the tls options. If your device uses self-signed certificates, you'll
     *           either have to set 'rejectUnauthorized : false' or supply the proper CA
     *           certificate. See the options for
     *           {@link https://nodejs.org/api/tls.html#tls_tls_connect_port_host_options_callback|tls.connect()}
     *           for more info.
     * @fires mikronode-ng.Connection#event:trap
     * @fires mikronode-ng.Connection#event:error
     * @throws <strong>WARNING: If you do not listen for 'error' or 'timeout' events and
     *            one occurrs during the initial connection (host unreachable, connection
     *            refused, etc.), an "Unhandled 'error' event" exception will be thrown.</strong>
     * @fires mikronode-ng.Connection#event:timeout
     * @fires mikronode-ng.Connection#event:close
     *
     * @example
     *
     * <pre>
     * var MikroNode = require('mikronode');
     *
     * var connection = new MikroNode.Connection('192.168.88.1', 'admin', 'mypassword', {
     * 	timeout : 4,
     * 	closeOnDone : true,
     * 	closeOnTimeout : true,
     * });
     *
     * connection.on('error', function(err) {
     * 	console.error('Error: ', err);
     * });
     *
     * </pre>
     *
     */
    function Connection(host, user, password, options) {
        this.hash = crypto.createHash('md5').update(host + user).digest('hex');
        // If we already have a connection, return the same one.
        options = options || {};
        // // if (api._conn[this.hash]) return api._conn[this.hash];

        /**
         * @public
         * @readonly
         * @instance
         * @member {string} host - Hostname or ip address
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'host', host, false, _);

        /**
         * @public
         * @readonly
         * @instance
         * @member {string} user - User ID
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'user', user, false, _);

        /**
         * @public
         * @readonly
         * @instance
         * @member {string} password - Password
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'password', password, false, _);

        /**
         * @public
         * @readonly
         * @instance
         * @member {number} [port=8728] - Port
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'port', options.port || (options.tls ? 8729 : 8728), false, _);

        /**
         * @public
         * @readonly
         * @instance
         * @member {number} [timeout=0] - Socket inactivity timeout
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'timeout', options.timeout, false, _);

        /**
         * @public
         * @readonly
         * @instance
         * @member {(object|boolean)} [tls] - Set to true to use TLS for this connection
         *         with default options. Set to an object to use TLS and pass the object to
         *         tls.connect as the tls options. If your device uses self-signed
         *         certificates, you'll either need to set 'rejectUnauthorized : false' or
         *         supply the proper CA certificate. See the options for
         *         {@link https://nodejs.org/api/tls.html#tls_tls_connect_port_host_options_callback|tls.connect()}
         *         for more info.
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'tls', options.tls, false, _);

        /**
         * @public
         * @readonly
         * @instance
         * @member {string} status - Connection status
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'status', 'New', false, _);

        /**
         * @public
         * @readonly
         * @instance
         * @member {object} channels - Active channels keyed by channel id
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'channels', {}, false, _, true);

        /**
         * @public
         * @instance
         * @member {boolean} [closeOnDone=false] - If set, when the last channel closes, the
         *         connection will automatically close.
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'closeOnDone', !!options.closeOnDone, true, _);

        /**
         * @public
         * @instance
         * @readonly
         * @member {boolean} [options.closeOnTimeout=false] - If set, when a socket timeout
         *         happens the connection will automatically close.
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'closeOnTimeout', !!options.closeOnTimeout, true, _);

        /**
         * @public
         * @readonly
         * @instance
         * @member {(boolean|object)} [reconnect=false] - If set, the connection will
         *         automatically try to reconnect (and re-authenticate) after an
         *         unexpected disconnect (socket error, socket close, or a timeout with
         *         closeOnTimeout). Has no effect when the connection is closed
         *         explicitly via {@link mikronode-ng.Connection#close}. Set to true to
         *         use the defaults below, or supply an object to override them.
         *         Channels do not survive a reconnect - reopen what you need in a
         *         {@link mikronode-ng.Connection#event:reconnected} handler.
         * @member {number} [reconnect.retries=Infinity] - Maximum number of reconnect
         *         attempts before giving up and emitting 'close'.
         * @member {number} [reconnect.delay=1000] - Delay in ms before the first
         *         reconnect attempt.
         * @member {number} [reconnect.maxDelay=30000] - Maximum delay in ms between
         *         attempts.
         * @member {number} [reconnect.factor=2] - Multiplier applied to the delay after
         *         each failed attempt (exponential backoff).
         * @memberof mikronode-ng.Connection
         */
        utils.createProperty(this, 'reconnect', normalizeReconnect(options.reconnect), false, _);

        /* The following properties are all private */
        _(this).connected = false;
        _(this).connecting = false;
        _(this).socket = null; // socket connection
        _(this).pending = Buffer.alloc(0); // bytes of a word not fully received yet
        _(this).words = []; // words of the sentence being received
        _(this).traps = {}; // traps received per channel, delivered with that channel's !done
        _(this).error = {}; // Buffer errors
        _(this).connectionCallback = null;
        _(this).intentionalClose = false; // true once close() has been called
        _(this).teardownInProgress = false; // guards _cleanupChannel against re-entrant close()
        _(this).isReconnecting = false;
        _(this).reconnectAttempt = 0;
        _(this).reconnectTimer = null;

    }
    util.inherits(Connection, events.EventEmitter);

    Connection.prototype.getTraps = function () {
        return _(this).traps;
    };

    const integerPattern = /^-?\d+$/;
    const floatPattern = /^-?\d+\.\d+$/;

    /**
     * RouterOS's API protocol is untyped - every value arrives as a string, whether
     * it started life as a number, a boolean, or actual text. Coerce the ones that are
     * unambiguously numbers; leave everything else (MAC addresses, `.id` values like
     * `*80000001`, IP/CIDR addresses, `true`/`false`, interface names, ...) as strings,
     * since none of those round-trip safely through Number(). Integers outside JS's
     * safe range are also left as strings rather than silently losing precision -
     * relevant for cumulative byte/packet counters on a long-uptime, high-traffic
     * interface.
     * @private
     * @param {string} value
     * @returns {(number|string)}
     */
    function coerceValue(value) {
        if (integerPattern.test(value)) {
            const n = Number(value);
            return Number.isSafeInteger(n) ? n : value;
        }
        if (floatPattern.test(value)) {
            return Number(value);
        }
        return value;
    }

    /**
     * Parse !re return records into an array of objects. Leaves `data` untouched: the
     * same row arrays are handed to 'read' listeners and kept (saveBuffer) for 'done'.
     * @function
     * @static
     * @param {string[][]} data - The data[] returned from Channel.on('done') or 'read'
     * @returns {object[]}
     */
    Connection.parseItems = function parseItems(data) {
        const db = [];
        let record = {};
        data.forEach(function (words) {
            words.forEach(function (word) {
                if (word === '!re') {
                    if (db.length) {
                        record = {};
                    }
                    db.push(record);
                    return;
                }
                const l = word.split(/=/);
                l.shift(); // remove empty first element
                const key = l.shift(); // next element is key. All the rest is value.
                record[key] = coerceValue(l.join('='));
            });
        });
        return db;
    };

    /**
     * Handles one complete sentence: its reply word, then its attribute words. Each
     * sentence names its own channel in `.tag`, and sentences of different channels
     * arrive interleaved, so every one is routed on its own - never merged with whatever
     * else came in the same TCP chunk.
     * @private
     * @param {string[]} words - The sentence's words, without the terminating empty word
     * @this mikronode-ng.Connection
     */
    Connection.prototype.sentence = function sentence(words) {
        debugSentence('Sentence: %o', words);
        const reply = words[0];
        let tag = null;
        const attributes = [];
        for (let i = 1; i < words.length; i++) {
            if (words[i].startsWith('.tag=')) {
                tag = words[i].substring(5);
            } else {
                attributes.push(words[i]);
            }
        }

        if (reply === '!fatal') { // Untagged: the whole connection is going away.
            this.emit('fatal', attributes, this);
            if (!_(this).closing) {
                this.close();
            }
            return;
        }

        const channel = tag === null ? null : _(this).channels[tag];
        if (!channel) {
            debugSentence('Sentence for unknown channel %s, ignored', tag);
            return;
        }

        if (reply === '!re') {
            channel._data(['!re'].concat(attributes));
        } else if (reply === '!trap') {
            // A command can send several !trap sentences before its !done.
            let trap = _(this).traps[tag];
            if (trap) {
                trap.addTrapError();
            } else {
                trap = new Trap();
                trap.channelId = tag;
                trap.channel = channel;
                _(this).traps[tag] = trap;
            }
            const error = trap.errors[trap.errors.length - 1];
            attributes.forEach(function (word) {
                const m = word.match(/^=(category|message)=([\s\S]*)$/);
                if (m) {
                    error[m[1]] = m[2];
                }
            });
            debugSentence('Trap for channel %s: %o', tag, trap);
        } else if (reply === '!done') {
            const trap = _(this).traps[tag];
            delete _(this).traps[tag];
            // A !done can carry a value itself (e.g. =ret=*5 from an add): deliver it as a row.
            channel._done(attributes.length ? ['!re'].concat(attributes) : [], trap);
        }
        // !empty (a print with no rows, RouterOS 7.18+) carries nothing; its !done follows.
    };

    /**
     * Bytes in a word's length prefix, from its first byte (RouterOS API length encoding).
     * @private
     * @param {number} b
     * @returns {number}
     */
    function lengthPrefixSize(b) {
        if ((b & 0x80) === 0) {
            return 1;
        }
        if ((b & 0xC0) === 0x80) {
            return 2;
        }
        if ((b & 0xE0) === 0xC0) {
            return 3;
        }
        if ((b & 0xF0) === 0xE0) {
            return 4;
        }
        return 5;
    }

    /**
     * Triggered by a 'data' event on the socket. A sentence is a run of length-prefixed
     * words ending with a zero-length word; a chunk can hold several sentences, or end
     * part-way through a word or its length prefix. Bytes are kept until a whole word is
     * in (decoded only then, so a multi-byte UTF-8 character split across chunks stays
     * intact), and words until the whole sentence is.
     * @private
     * @param {Buffer} data
     * @this mikronode-ng.Connection
     */
    Connection.prototype._read = function _read(data) {
        if (debugSocketData.enabled) {
            utils.hexDump(data, debugSocketData);
        }
        const buf = _(this).pending.length ? Buffer.concat([_(this).pending, data]) : data;
        let pos = 0;
        while (pos < buf.length) {
            const prefix = lengthPrefixSize(buf[pos]);
            if (pos + prefix > buf.length) {
                break;
            }
            const len = utils.decodeLength(buf.subarray(pos))[1];
            if (pos + prefix + len > buf.length) {
                break;
            }
            const word = buf.toString('utf8', pos + prefix, pos + prefix + len);
            pos += prefix + len;
            if (len === 0) {
                const words = _(this).words;
                _(this).words = [];
                if (words.length) {
                    this.sentence(words);
                }
            } else {
                _(this).words.push(word);
            }
        }
        _(this).pending = Buffer.from(buf.subarray(pos));
    };

    /**
     * Send data
     * @private
     * @param {string} data - Sentence
     * @this mikronode-ng.Connection
     */
    Connection.prototype._write = function write(data) {
        const _this = this;
        if (!_(this).connected && !_(this).connecting) {
            debugSocket('write: not connected ');
            return;
        }
        if (typeof (data) === 'string') {
            data = [data];
        } else if (!Array.isArray(data)) {
            return;
        }
        data.forEach(function (i) {
            debugSocket('write: sending ' + i);
            _(_this).socket.write(utils.encodeString(i));
        });
        _(this).socket.write(emptyString);
    };

    /**
     * Called when the connection is established and authenticated
     * @callback mikronode-ng.Connection.connectCallback
     * @param {mikronode-ng.Connection}
     */

    /**
     * Opens the socket and performs authentication
     * @param {mikronode-ng.Connection.connectCallback} callback - Called when
     *           authentication succeeds and the connection is ready for channel activity
     * @returns {mikronode-ng.Connection}
     * @fires mikronode-ng.Connection#event:trap
     * @fires mikronode-ng.Connection#event:error
     * @throws <strong>WARNING: If you do not listen for 'error' or 'timeout' events and an
     *            error occurrs during the initial connection (host unreachable, connection
     *            refused, etc.), an "Unhandled 'error' event" exception will be thrown.</strong>
     * @fires mikronode-ng.Connection#event:timeout
     * @fires mikronode-ng.Connection#event:close
     */
    Connection.prototype.connect = function connect(callBack) {
        if (_(this).connected) {
            return;
        }
        _(this).connectionCallback = callBack;
        this._openSocket();
        return this;
    };

    /**
     * (Re)opens the socket and performs authentication. Used both for the initial
     * connect() and for reconnect attempts.
     * @private
     */
    Connection.prototype._openSocket = function _openSocket() {
        const _this = this;

        _(this).intentionalClose = false;
        _(this).teardownInProgress = false;
        _(this).status = "Connecting";

        /**
         * Reset all sentence/frame parsing state before (re)connecting. On a reconnect
         * this wipes out whatever was left mid-parse on the dead socket (half a word or
         * sentence from an interrupted exchange); without this, the new session's first
         * reply would be glued onto it.
         */
        _(this).pending = Buffer.alloc(0);
        _(this).words = [];
        _(this).traps = {};
        _(this).error = {};

        const tempSocket = new net.Socket({
            type: 'tcp4'
        });

        if (_(this).tls) {
            const tlsopts = ((typeof _(this).tls === 'boolean') ? {} : _(this).tls);
            _(this).socket = new tls.TLSSocket(tempSocket, tlsopts);
        } else {
            _(this).socket = tempSocket;
        }

        debugSocket('Created%s socket to %s:%d', _(this).tls ? ' TLS' : '', _(this).host, _(this).port);

        _(this).connecting = true;

        _(this).socket.on('data', function (a) {
            _this._read(a);
        });

        /**
         * 'error' is always followed by a 'close' event on a net.Socket, so we let
         * 'close' (below) own the actual state cleanup / reconnect decision and just
         * propagate the error here.
         */
        _(this).socket.on('error', function (a) {
            debugSocket('Connection error: ' + a);
            _(_this).teardownInProgress = true;
            _this.emit('error', a, _this);
        });

        /**
         * Reliably catches every disconnect, including a clean/graceful remote close
         * that never raises a socket 'error' or 'timeout' (e.g. the device rebooting).
         * Without this, the connection silently stops receiving data with no signal to
         * the caller.
         */
        _(this).socket.on('close', function () {
            debugSocket('Socket closed');
            _this._handleClose();
        });

        /**
         * timeout is triggered if the socket goes inactive for a set period of time. This
         * may be normal if we're listening for events that may not occur often.
         */
        if (_(this).timeout) {
            debugConnection('Setting timeout to %d seconds', _(this).timeout);
            /**
             * Calling setTimeout with a callback is safer than socket.on('timeout') for TLS
             * sockets
             */
            _(this).socket.setTimeout(_(this).timeout * 1000, function () {
                debugSocket('Timeout');
                if (_(_this).closeOnTimeout) {
                    _this.emit('timeout', 'Socket Timeout', false, _this);
                    _(_this).socket.destroy(); // triggers the 'close' handler above
                } else {
                    _this.emit('timeout', 'Socket Timeout', true, _this);
                }
            });
        }
        _(this).socket.setKeepAlive(true, 1000);

        /**
         * Setup is done. Call connect on the NON TLS socket to start the login state
         * machine. _this.loginStateMachine() can't be passed directly to connect as the
         * callback because it's 'this' will be the socket instead of our connection.
         */
        tempSocket.connect(_(this).port, _(this).host, function lsm() {
            _this.loginStateMachine();
        });
    };

    /**
     * Handles cleanup once the socket has closed, whether the close was explicit
     * ({@link mikronode-ng.Connection#close}) or not. If {@link
     * mikronode-ng.Connection#reconnect} is configured and the close wasn't explicit,
     * schedules another connection attempt with exponential backoff instead of
     * finalizing.
     * @private
     * @fires mikronode-ng.Connection#event:reconnecting
     * @fires mikronode-ng.Connection#event:close
     */
    Connection.prototype._handleClose = function _handleClose() {
        const _this = this;
        _(this).connected = false;
        _(this).connecting = false;
        _(this).teardownInProgress = true;

        // Any channels still open belonged to the now-dead socket and can't be resumed.
        Object.keys(_(this).channels).forEach(function (id) {
            _(_this).channels[id].close(true);
        });

        if (_(this).intentionalClose) {
            debugConnection('Connection closed: ' + _(this).host);
            _this.emit('close', _this);
            _this.removeAllListeners();
            return;
        }

        const rc = _(this).reconnect;
        if (rc && _(this).reconnectAttempt < rc.retries) {
            _(this).reconnectAttempt++;
            const delay = Math.min(rc.delay * Math.pow(rc.factor, _(this).reconnectAttempt - 1), rc.maxDelay);
            debugConnection('Connection lost, reconnecting (attempt %d) in %dms: %s',
                _(this).reconnectAttempt, delay, _(this).host);
            _(this).isReconnecting = true;
            _this.emit('reconnecting', _(this).reconnectAttempt, delay, _this);
            _(this).reconnectTimer = setTimeout(function () {
                _(_this).reconnectTimer = null;
                _this._openSocket();
            }, delay);
            return;
        }

        debugConnection('Connection lost, giving up: ' + _(this).host);
        _this.emit('close', _this);
        _this.removeAllListeners();
    };

    /**
     * RouterOS 7.x+ only: logs in with the single-step plaintext login
     * (`/login =name= =password=`), sent directly with no challenge/response
     * round-trip. Older RouterOS versions that only speak the pre-6.43 two-step MD5
     * challenge login are not supported.
     */
    Connection.prototype.loginStateMachine = function loginStateMachine() {
        /**
         * We save the value of closeOnDone as set by the caller, force it to false, then
         * restore it after successful login. Otherwise, if set set to true, when the login
         * channel closes, the connection would also be closed and be of no further use.
         */
        const tempcOD = _(this).closeOnDone;
        _(this).closeOnDone = false;

        const lc = this.openChannel('login');
        /**
         * lc.closeOnDone has to be false because we're expecting multiple done events.
         */
        lc.closeOnDone = false;

        const _this = this;
        // Channel independently listens for the Connection's own 'error' and
        // re-emits it on itself (see Channel's constructor) - an EventEmitter 'error'
        // event with no listener throws as an uncaught exception in Node.js. The
        // Connection-level 'error' (emitted on `this`, not `lc`) is the one callers
        // are expected to listen to; this just prevents a login-time socket error
        // (e.g. during a reconnect's relogin) from crashing the process.
        lc.on('error', function () {});

        lc.on('trap', function loginTrap(data) {
            /** @this is now mikronode-ng.Channel */

            _(_this).status = 'Received Trap';
            debugLogin('%s %o', _(_this).status, data);
            _this.emit('trap', data);
            this.close(true);
            _(_this).closeOnDone = true;
        });

        lc.on('done', function loginDone(data) {
            /** @this is now mikronode-ng.Channel */

            const parsed = Connection.parseItems(data);
            _(_this).status = 'Received Response';
            debugLogin('%s %o', _(_this).status, parsed);
            this.close(true);
            _(_this).status = 'Connected';
            debugLogin(_(_this).status);
            _(_this).connected = true;
            _(_this).reconnectAttempt = 0;

            if (_(_this).isReconnecting) {
                _(_this).isReconnecting = false;
                debugConnection('Reconnected: ' + _(_this).host);
                _this.emit('reconnected', _this);
            } else if (_(_this).connectionCallback) {
                _(_this).connectionCallback(_this);
                _(_this).connectionCallback = null;
            }

            _(_this).closeOnDone = tempcOD;
        });

        _(this).status = 'Sending Login';
        debugLogin(_(this).status);
        lc.write('/login', {
            "=name": _(this).user,
            "=password": _(this).password
        });
        _(this).status = 'Waiting for Response';
        debugLogin(_(this).status);
    };

    /**
     * Opens a new Channel
     * @public
     * @param {string} [id=next available] - Automatically assigned ids are numbers but you
     *           can specify any string.
     * @returns {mikronode-ng.Channel}
     */
    Connection.prototype.openChannel = function openChannel(id) {
        const _this = this;
        if (!id) {
            id = Object.keys(_(this).channels).length + 1;
            while (_(this).channels[id]) {
                id++;
            }
        } else if (_(this).channels[id]) {
            throw ('Channel already exists for ID ' + id);
        }
        _(this).channels[id] = new Channel(id, this);
        _(this).channels[id].addListener('close', function (channel) {
            _this._cleanupChannel(channel.id);
        });
        debugConnection('Opening channel: ' + id + ' %o', _(this).traps);
        return _(this).channels[id];
    };

    /**
     * Returns the channel specified by id.
     * @public
     * @param {number} id - The id of the channel desired
     * @returns {mikronode-ng.Channel}
     */
    Connection.prototype.getChannel = function getChannel(id) {
        if (!id && id !== 0) {
            throw ('Missing channel ID parameter' + id);
        }
        if (!_(this).channels[id]) {
            throw ('Channel does not exist for ID ' + id);
        }
        debugConnection('Getting channel: ' + id);
        return _(this).channels[id];
    };

    /**
     * Cleanup channel
     * @private
     * @param {number} id - The id of the channel to close
     * @this mikronode-ng.Connection
     */
    Connection.prototype._cleanupChannel = function cleanupChannel(id) {
        delete _(this).channels[id];
        const channelsLeft = Object.keys(_(this).channels).length;
        debugConnection('Closing channel: %s  Channels left: %d', id, channelsLeft);
        if (_(this).teardownInProgress) {
            // The connection itself is already being torn down (explicit close() or a
            // disconnect); don't re-enter close() as a side effect of that teardown
            // force-closing this channel.
            return;
        }
        if (channelsLeft === 0 && ((_(this).closing || _(this).closeOnDone))) {
            debugConnection('Last channel closed %s %s', _(this).closing, _(this).closeOnDone);
            this.close();
        }
    };

    /**
     * Closes the channel specified by id.
     * @public
     * @param {number} id - The id of the channel to close
     */
    Connection.prototype.closeChannel = function closeChannel(id) {
        if (!id) {
            throw ("Missing ID for stream channel to close.");
        }
        if (!_(this).channels[id]) {
            throw ('Channel does not exist for ID ' + id);
        }
        // Make sure that the channel closes itself... so that remaining
        // commands will execute.
        if (!_(this).channels[id].closed) {
            return _(this).channels[id].close();
        }
    };

    Connection.prototype.close = function close(force) {
        const _this = this;
        _(this).intentionalClose = true;
        if (_(this).reconnectTimer) {
            clearTimeout(_(this).reconnectTimer);
            _(this).reconnectTimer = null;
        }
        if (!_(this).connected) {
            debugConnection('Connection already disconnected: ' + _(this).host);
            _(this).teardownInProgress = true;
            _(this).socket.destroy(); // triggers _handleClose via the socket 'close' event
            return;
        }
        if (!force && ((Object.keys(_(this).channels).length > 0))) {
            _(this).closing = true;
            debugConnection('deferring closing connection');
            return;
        }
        debugConnection('Connection disconnecting: ' + _(this).host);
        _(this).teardownInProgress = true;
        this.removeAllListeners('done');
        this.removeAllListeners('error');
        this.removeAllListeners('timeout');

        if (force) {
            Object.keys(_(this).channels).forEach(function (e) {
                _(_this).channels[e].close(true);
            });
        }
        this.once('fatal', function () { // quit command ends with a fatal.
            debugConnection('Connection disconnected: ' + _(this).host);
            _(_this).socket.destroy(); // triggers _handleClose via the socket 'close' event
        });
        _(this).closing = false;
        this._write(['/quit']);
        _(this).closing = true;
    };

    Connection.prototype.finalize = function finalize() {
        _(this).close(true);
    };

    /**
     * Returns a Promise for an open connection.
     * <p>
     * The promise will resolve when the connection is ready for use or reject if there's
     * an error or trap. If resolved, the result object will be the
     * {@link mikronode-ng.Connection} with authentication completed and ready for
     * channels. If rejected, the result object will be an Error if there was a socket
     * error or timeout during connection or login or a {@link mikronode-ng.Trap} if there
     * was a problem with the login credentials.
     * <p>
     * @returns {Promise}
     *
     * @example
     *
     * <pre>
     * var MikroNode = require('mikronode');
     *
     * var connection = new MikroNode.Connection(process.argv[2], process.argv[3], process.argv[4], {
     * 	closeOnDone : true
     * });
     *
     * var connPromise = connection.getConnectPromise().then(function resolve(conn) {
     * // You now have an open, authenticated connection
     * // To issue some commands see {@link mikronode-ng.Connection#getCommandPromise getCommandPromise}
     * });
     * </pre>
     */
    Connection.prototype.getConnectPromise = function connectPromise() {
        const _this = this;
        return new Promise(function (resolve, reject) {
            try {
                if (_(_this).connected || _(_this).connecting) {
                    resolve(_this);
                    return;
                }

                _this.on('error', function (err) {
                    debugConnection('Error: %o', err);
                    reject(err);
                    _this.close();
                });

                _this.on('trap', function (err) {
                    debugConnection('Trap: %o', err);
                    reject(err);
                    _this.close();
                });

                _this.on('timeout', function (err) {
                    debugConnection('Timeout: %o', err);
                    reject(err);
                    _this.close();
                });

                _this.connect(function connect(connection) {
                    debugConnection('Resolved');
                    resolve(connection);
                });
            } catch (err) {
                reject(err);
            }
        });
    };

    /**
     * ** Returnes a Promise of a completed command.
     * <p>
     * The promise will resolve when the command completes or reject if there's an error or
     * trap. If resolved, the result will be an array of instances of DestinationClass (or
     * Object, if no destination class was specified). If rejected, the result will be an
     * Error if there was a socket error or timeout, or a {@link mikronode-ng.Trap} if the
     * command failed on the device.
     *
     * @param {(string|string[])} data - Can be a single string with the command and
     *           optional parameters separated by '\n' or an array of strings with the
     *           command in the first position and the parameters in the rest.
     * @param {(object|string[])} [parameters] - If the first parameter is a command
     *           string, this object will be treated as the parameters for the command.
     *           <p>
     *           It can be an array or strings...
     *
     * <pre>
     * ['name=value','name=value'...]
     * </pre>
     *
     * or an Object...
     *
     * <pre>
     * {'name': 'value', 'name': 'value'...}
     * </pre>
     *
     * @param {object} [options] - A set of options that determine what to do with the
     *           return data (if any). If neither dataClass nor itemClass are provided, the
     *           default behavior will be as though itemClass were set to Object. This will
     *           result in Promise.resolve() being called with an array of plain Objects,
     *           one for each parsed item.
     * @param {boolean} [options.closeOnDone=true] - If true, the channel will
     *           automatically close when the command completes.
     * @param {boolean} [options.dontParse=false] - If true, Promise.resolve() will be
     *           called with the unaltered data array provided by the channel's 'done'
     *           event. with the unaltered data array provided by the channel's 'done'
     *           event.
     * @param {class} [options.dataClass] - If provided, this class will be instantiated
     *           with the data array provided by the channel's 'done' event as the
     *           constructor's sole argument. Promise.resolve() will then be called with
     *           this object.
     * @param {class} [options.itemClass] - If provided, {mikronode-ng.parseItems} will be
     *           called on the returned data and this class will be instantiated once for
     *           each resulting item. The item object will be passed as the sole argument
     *           to the constructor. An array of itemClass objects will be passed to
     *           Promise.resolve().
     * @param {string} [options.itemKey] - If provided, instead of an array of parsed
     *           objects being passed to Promise.resolve(), the parsed objects will be
     *           added to a wrapper object using the value of itemKey as the property name.
     *
     * @return {Promise} The promise will have a channel property added which will be set
     *         to the channel used to fulfill the promise.
     *
     * @example
     *
     * <pre>
     *
     * function Interface(intf) {
     * 	var _this = this;
     * 	Object.keys(intf).forEach(function(key) {
     * 		_this[key] = intf[key];
     * 	});
     * }
     *
     * var chan1Promise = conn.getCommandPromise('/interface/print', {
     * 	itemClass : Interface,
     * 	itemKey : 'name'
     * });
     *
     * chan1Promise.then(function(values){
     * // It succeeded. You'll have a hash of Interfaces keyed by interface name.
     * });
     *
     * chan1Promise.catch(function(result){
     * // It failed. result will tell you why.
     * });
     * </pre>
     */
    Connection.prototype.getCommandPromise = function commandPromise(data, parameters, options) {
        const _this = this;
        debugConnection('getCommandPromise');
        if (parameters
            && !Array.isArray(parameters)
            && (parameters.hasOwnProperty('closeOnDone') || parameters.hasOwnProperty('dontParse')
                || parameters.dataClass || parameters.itemClass || parameters.itemKey)) {
            options = parameters;
            parameters = null;
        }
        options = options || {};
        const chan = _this.openChannel();

        chan.closeOnDone = options.hasOwnProperty('closeOnDone') ? options.closeOnDone : true;

        const p1 = new Promise(function (resolve, reject) {
            try {
                chan.write(data, parameters, function () {
                    chan.on('error', function (err) {
                        debugPromise('Channel %d error: %o', chan.id, err);
                        chan.close();
                        reject(err);
                    });
                    chan.on('trap', function (err) {
                        debugPromise('Channel %d trap: %o', chan.id, err);
                        chan.close();
                        reject(err);
                    });
                    chan.on('timeout', function (err) {
                        debugPromise('Channel %d timeout', chan.id);
                        chan.close();
                        reject(err);
                    });
                    chan.on('done', function chanDone(data) {
                        debugPromise('Channel %d done: %o', chan.id, data);
                        if (options.dontParse) {
                            resolve(data);
                            return;
                        }
                        if (typeof options.dataClass === 'function') {
                            resolve(new options.dataClass(data));
                            return;
                        }
                        let items;
                        if (options.itemKey) {
                            items = {};
                        } else {
                            items = [];
                        }
                        const parsed = Connection.parseItems(data);
                        parsed.forEach(function (item) {
                            let o;
                            if (typeof options.itemClass === 'function') {
                                o = new options.itemClass(item);
                            } else {
                                o = {};
                                Object.keys(item).forEach(function (k) {
                                    o[k] = item[k];
                                });
                            }
                            if (options.itemKey) {
                                items[item[options.itemKey]] = o;
                            } else {
                                items.push(o);
                            }
                        });
                        resolve(items);
                    });
                });
            } catch (err) {
                reject(err);
            }
        });
        p1.channel = chan;
        return p1;
    };

    return Connection;
})();
