// src interface
/* jshint undef: true */
/* globals Promise */
const MikroNode = require('../lib/index.js');

if (process.argv.length != 5) {
    console.error('Missing parameters\nnode getWifiRegistration.js address username password');
    process.exit(1);
}

function regOutput(p) {
    const v = MikroNode.parseItems(p);
    console.log(parseWifiClients(JSON.parse(JSON.stringify(v))));
    return true;
}

const c1 = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
c1.closeOnDone = true;
c1.connect(function (c) {
    const o = c.openChannel();
    o.closeOnDone = true;


    o.write(['/caps-man/registration-table/print', '=interval=5'], function (channel) {
        console.log('Listening to wifi client registration changes.');
        console.log('Press CTRL-C to stop listening.');
        channel.on('done', function () {
            console.log('Registration listen done');
        });
        channel.addListener('read', regOutput);
    });

});

function parseRate(data) {
    const rateObj = {
        rate: 0,
        width: 0,
    };
    const result = data.matchAll(/^(?<rate>[\d.]+[\w]+)-?(?<width>[\d]+[\w]+)?/gmi);
    for (const match of result) {
        rateObj.rate = match[1];
        rateObj.width = match[2] || null;
    }
    return rateObj;
}

function parseRateSet(data) {
    const rateSetObj = {};
    const result = data.matchAll(/(?<key>[\w]+):(?<value>[\d-\w=,]+)/gmi);
    for (const match of result) {
        rateSetObj[match.groups.key] = match.groups.value
    }
    return rateSetObj;
}

function parseWifiClients(data) {
    const event = new Date();
    const rdate = event.toLocaleString('en-ZA').split(', ');
    const wifiClientsData = {
        datetime: rdate[0] + ' ' + rdate[1],
        data: []
    };

    if (data.length) {
        data.forEach(function (element) {
            const bytes = element.bytes.split(',');
            const packets = element.packets.split(',');
            const rx_rate = parseRate(element['rx-rate']);
            const tx_rate = parseRate(element['tx-rate']);
            const tx_rate_sets = parseRateSet(element['tx-rate-set']);
            const reg = {
                mac_address: element['mac-address'],
                ssid: element.ssid,
                comment: element.comment,
                eap_identity: element['eap-identity'],
                interface: element.interface,
                uptime: element.uptime,
                vlan_id: parseInt(element['vlan-id']),
                last_ip: element['last-ip'],
                rx: {
                    bytes: parseInt(bytes[1]),
                    packets: parseInt(packets[1]),
                    rate: rx_rate.rate,
                    width: rx_rate.width,
                    rx_signal: parseInt(element['rx-signal'])
                },
                tx: {
                    bytes: parseInt(bytes[0]),
                    packets: parseInt(packets[0]),
                    rate: tx_rate.rate,
                    width: tx_rate.width,
                    rate_sets: tx_rate_sets
                }
            };
            wifiClientsData.data.push(reg);
        });
    }
    return wifiClientsData;
}
