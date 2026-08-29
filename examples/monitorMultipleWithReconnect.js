// Reference pattern for the v1 monitoring feature set: one Connection, one Channel per
// monitored resource, all running concurrently - plus the `reconnect` option so the
// process survives the device rebooting or a network blip without dying silently.
//
// Usage: node monitorMultipleWithReconnect.js <host> <user> <password> [interface]
const MikroNode = require('../lib/index.js');

const testInterface = process.argv[5] || 'ether1';

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4], {
    reconnect: {
        retries: Infinity,
        delay: 1000,
        maxDelay: 30000,
        factor: 2
    }
});

connection.on('error', function (err) {
    console.error('Connection error: ' + err);
});

connection.on('reconnecting', function (attempt, delay) {
    console.log('Lost connection to device - reconnect attempt ' + attempt + ' in ' + delay + 'ms');
});

connection.on('reconnected', function () {
    console.log('Reconnected - reopening monitor channels');
    openMonitorChannels();
});

connection.on('close', function () {
    // Only reached once reconnect gives up (retries exhausted) or close() was called
    // explicitly - a normal, expected disconnect never gets here.
    console.log('Connection closed for good.');
});

/**
 * Opens one channel per monitored resource. Each channel streams its own rows
 * independently on the same underlying connection - see getInterfacesAndRoutes.js for
 * the same pattern with one-shot commands instead of streams.
 */
function openMonitorChannels() {
    const traffic = connection.openChannel();
    // Object-form params are NOT auto-prefixed with '=' - RouterOS traps with
    // "missing =interface=" if you pass plain `interface`/`interval` keys here.
    // Confirmed against a real device.
    traffic.write('/interface/monitor-traffic', { '=interface': testInterface, '=interval': '1' }, function () {
        console.log('Monitoring traffic on ' + testInterface);
    });
    traffic.on('read', function (data) {
        console.log('traffic: ' + JSON.stringify(MikroNode.parseItems(data)));
    });

    const wifiReg = connection.openChannel();
    wifiReg.write('/interface/wifi/registration-table/listen', function () {
        console.log('Monitoring wifi registration table');
    });
    wifiReg.on('read', function (data) {
        console.log('wifi-reg: ' + JSON.stringify(MikroNode.parseItems(data)));
    });

    const routes = connection.openChannel();
    routes.write('/ip/route/listen', function () {
        console.log('Monitoring routes');
    });
    routes.on('read', function (data) {
        console.log('route: ' + JSON.stringify(MikroNode.parseItems(data)));
    });

    // Channel independently listens for the Connection's own 'error' and re-emits it
    // on itself - an EventEmitter 'error' event with no listener throws as an
    // uncaught exception and crashes the whole process. Confirmed the hard way: this
    // is exactly what happens if you skip this on a long-running monitor channel and
    // the device drops mid-session. The Connection-level 'error' handler above already
    // reports it; these just need to exist so the re-emission doesn't crash.
    [traffic, wifiReg, routes].forEach(function (channel) {
        channel.on('error', function () {});
        channel.on('trap', function (trap) {
            console.error('Channel ' + channel.id + ' trap: ' + JSON.stringify(trap));
        });
    });
}

connection.connect(function () {
    console.log('Connected.');
    openMonitorChannels();
});
