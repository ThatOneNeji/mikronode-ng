// Debugging reference for a future node-red-contrib-mikronode-ng mikrotik-wifi-config
// node, and a smoke test to re-run against a new RouterOS version.
//
// Wifi interface configuration - old CAPsMAN (/caps-man/actual-interface-configuration)
// or new (/interface/wifi) - with the same two modes as monitorWifiRegistration.js:
//   - No interval: print once for an initial snapshot, then .../listen for
//     change-only deltas.
//   - Interval set: .../print =interval=N repeats the full table on that cadence.
//
// Usage: node monitorWifiCfg.js <host> <user> <password> [old|new] [interval]
//   - capsman defaults to "new" (/interface/wifi) if omitted
//   - no [interval]: change-only mode; [interval] given (seconds): periodic mode
const MikroNode = require('../lib/index.js');

const capsman = process.argv[5] === 'old' ? 'old' : 'new';
const interval = process.argv[6];
const basePath = capsman === 'old' ? '/caps-man/actual-interface-configuration' : '/interface/wifi';

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
connection.on('error', function (err) {
    console.error('Connection error: ' + err);
});

connection.connect(function () {
    const channel = connection.openChannel();

    channel.on('read', function (data) {
        console.log('read: ' + JSON.stringify(MikroNode.parseItems(data)));
    });
    channel.on('done', function (data) {
        console.log('done (initial snapshot): ' + JSON.stringify(MikroNode.parseItems(data)));
    });
    channel.on('trap', function (trap) {
        console.error('Trap: ' + JSON.stringify(trap));
    });
    channel.on('error', function () {});

    console.log('Connected. CAPsMAN: ' + capsman + '.');
    if (interval) {
        console.log('Periodic mode: full table every ' + interval + 's - Ctrl-C to stop.');
        channel.write(basePath + '/print', { '=interval': interval }, function (ch) {
            ch.saveBuffer = false;
        });
    } else {
        console.log('Change-only mode: snapshot now, then updates as wifi interface config changes - Ctrl-C to stop.');
        channel.write(basePath + '/print', function () {});
        // Only the listen stops buffering: the print snapshot above still needs it for 'done'.
        channel.write(basePath + '/listen', function (ch) {
            ch.saveBuffer = false;
        });
    }
});
