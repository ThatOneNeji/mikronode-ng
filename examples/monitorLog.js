// Debugging reference for a future node-red-contrib-mikronode-ng log node, and a smoke
// test to re-run against a new RouterOS version.
//
// Two modes, both /log/print on one long-running command that never sends 'done':
//   follow-only (default) - only new log entries
//   follow                - all previous log entries, then new ones
//
// saveBuffer is switched off in the write callback: by default the channel keeps every
// row until 'done', which never comes here, so memory would grow for as long as it runs.
// write() turns saveBuffer back on, so it has to be done there and not before.
//
// Usage: node monitorLog.js <host> <user> <password> [follow-only|follow]
const MikroNode = require('../lib/index.js');

const mode = process.argv[5] || 'follow-only';
if (mode !== 'follow' && mode !== 'follow-only') {
    console.error('Unknown mode "' + mode + '" - use follow-only or follow.');
    process.exit(1);
}

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
connection.on('error', function (err) {
    console.error('Connection error: ' + err);
});

connection.connect(function () {
    if (mode === 'follow') {
        console.log('Connected. Previous logs, then showing new log entries - Ctrl-C to stop.');
    } else {
        console.log('Connected. Showing new log entries - Ctrl-C to stop.');
    }
    const channel = connection.openChannel('log');
    channel.write('/log/print', {['=' + mode]: null}, function (ch) {
        ch.saveBuffer = false;
    });
    channel.on('read', function (data) {
        console.log(JSON.stringify(MikroNode.parseItems(data)));
    });
    channel.on('trap', function (trap) {
        console.error('Trap: ' + JSON.stringify(trap));
    });
    // Channel re-emits the Connection's 'error' on itself - an unhandled 'error' throws.
    channel.on('error', function () {});
});
