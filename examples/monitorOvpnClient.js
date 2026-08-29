// Debugging reference for node-red-contrib-mikronode-ng's mikrotik-ovpn-client node,
// and a smoke test to re-run against a new RouterOS version.
//
// Lists configured OVPN client interfaces, then monitors the first enabled one found.
// Two distinct commands, both confirmed against a real device:
//   - /interface/ovpn-client/print   - one-shot list, all configured clients
//     (regardless of disabled state)
//   - /interface/ovpn-client/monitor - live status for a specific client, targeted by
//     =.id= (RouterOS traps with "missing =.id=" without one - unlike
//     monitor-traffic's =interface=, this command wants the target keyed by =.id=,
//     even though in practice the value you give it is just the interface name)
//
// Usage: node monitorOvpnClient.js <host> <user> <password>
const MikroNode = require('../lib/index.js');

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
connection.on('error', function (err) {
    console.error('Connection error: ' + err);
});

connection.connect(function () {
    const list = connection.openChannel();
    list.write('/interface/ovpn-client/print', function () {
        console.log('Listing configured OVPN client interfaces...');
    });
    list.on('trap', function (trap) {
        console.error('List failed: ' + JSON.stringify(trap));
    });
    list.on('done', function (data) {
        const clients = MikroNode.parseItems(data);
        console.log(JSON.stringify(clients, null, 2));

        const target = clients.find(function (c) { return c.disabled === 'false'; });
        if (!target) {
            console.log('No enabled OVPN client interfaces to monitor.');
            return;
        }
        monitor(target.name);
    });
});

function monitor(name) {
    console.log('Monitoring ' + name + ' - press Ctrl-C to stop.');
    const mon = connection.openChannel();
    mon.write('/interface/ovpn-client/monitor', { '=.id': name, '=interval': '5' }, function () {});
    mon.on('read', function (data) {
        console.log(name + ': ' + JSON.stringify(MikroNode.parseItems(data)));
    });
    mon.on('trap', function (trap) {
        console.error('Monitor failed: ' + JSON.stringify(trap));
    });
    // See monitorMultipleWithReconnect.js for why this is needed: an unhandled
    // channel-level 'error' throws and crashes the process.
    mon.on('error', function () {});
}

// Example /interface/ovpn-client/print output (values illustrative, not from a real
// device):
// [
//   {
//     ".id": "*1",
//     "name": "ovpn-out1",
//     "mac-address": "02:00:00:00:00:01",
//     "connect-to": "vpn.example.com",
//     "port": 1194,
//     "user": "someuser",
//     "profile": "default",
//     "running": "true",
//     "disabled": "false"
//   }
// ]
//
// Example /interface/ovpn-client/monitor output for that interface:
// [{ "status": "connected", "uptime": "1d23h47m44s", "encoding": "AES-256-CBC/SHA512",
//    "mtu": 1500, "local-address": "10.8.10.250" }]
