// Debugging reference for node-red-contrib-mikronode-ng's mikrotik-routes node, and a
// smoke test to re-run against a new RouterOS version.
//
// mikrotik-routes has two modes, both confirmed against a real device:
//   - No interval: print once for an initial snapshot (fires 'done'), then
//     /ip/route/listen for change-only deltas (fires 'read' - listen never dumps an
//     initial snapshot on its own, and does not support =interval=).
//   - Interval set: /ip/route/print =interval=N repeats the FULL table on that
//     cadence by itself (fires 'read', not 'done' - this is the trickiest, most
//     surprising thing found in this whole exercise: interval-mode print behaves
//     completely differently from a one-shot print).
// This file demonstrates whichever mode you ask for, so both are exercisable without
// editing it.
//
// Usage: node monitorRoutes.js <host> <user> <password> [interval]
//   - no [interval]: change-only mode
//   - [interval] given (seconds): periodic full-table mode
const MikroNode = require('../lib/index.js');

const interval = process.argv[5];

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

    if (interval) {
        console.log('Connected. Periodic mode: full table every ' + interval + 's - Ctrl-C to stop.');
        channel.write('/ip/route/print', { '=interval': interval }, function () {});
    } else {
        console.log('Connected. Change-only mode: snapshot now, then updates as routes change - Ctrl-C to stop.');
        channel.write('/ip/route/print', function () {});
        channel.write('/ip/route/listen', function () {});
    }
});
