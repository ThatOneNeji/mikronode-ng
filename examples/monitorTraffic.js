// Debugging reference for node-red-contrib-mikronode-ng's mikrotik-traffic node, and
// a smoke test to re-run against a new RouterOS version: if the node stops working,
// run this in isolation first to tell whether the problem is in the device/API layer
// or in the Node-RED wrapper around it.
//
// mikrotik-traffic has exactly one mode: /interface/monitor-traffic with =interface=
// and =interval= (both required - object-form params are NOT auto-prefixed with '=',
// confirmed against a real device: RouterOS traps with "missing =interface=" without
// it).
//
// Usage: node monitorTraffic.js <host> <user> <password> [interface] [interval]
const MikroNode = require('../lib/index.js');

const iface = process.argv[5] || 'ether1';
const interval = process.argv[6] || '1';

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
connection.on('error', function (err) {
    console.error('Connection error: ' + err);
});

connection.connect(function () {
    console.log('Connected. Monitoring ' + iface + ' every ' + interval + 's - Ctrl-C to stop.');
    const channel = connection.openChannel();
    channel.write('/interface/monitor-traffic', { '=interface': iface, '=interval': interval }, function () {});
    channel.on('read', function (data) {
        console.log(JSON.stringify(MikroNode.parseItems(data)));
    });
    channel.on('trap', function (trap) {
        console.error('Trap: ' + JSON.stringify(trap));
    });
    // Channel independently re-emits the Connection's own 'error' on itself - an
    // unhandled 'error' event throws and crashes the process. Confirmed the hard way.
    channel.on('error', function () {});
});
