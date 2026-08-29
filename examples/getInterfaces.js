const MikroNode = require('../lib/index.js');

let interfaceList = {};

function interfaceOutput(p) {
    const v = MikroNode.parseItems(p)[0]; // Returns a row of items, but we only need one.
    let t = interfaceList[v['.id']];

    if (v['.dead']) {
        if (!t) {
            t = {
                name: 'Unknown'
            };
        }
        console.log('IP: ' + t.address + ' deleted');
        delete interfaceList[v['.id']];
    } else {
        let c = [];
        if (t) {
            Object.keys(v).forEach(function (k) {
                if (v[k] !== t[k]) {
                    if (c.length === 0) {
                        c.push('changed ');
                    }
                    c.push("    (" + k + ')' + t[k] + ' to ' + v[k] + ' ');
                    interfaceList[v['.id']][k] = v[k];
                }
            });
        } else {
            interfaceList[v['.id']] = v;
        }
        console.log(v.name + ': ' + JSON.stringify(v));
    }
    return true;
}

const c1 = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
c1.closeOnDone = true;
c1.connect(function (c) {
    const o = c.openChannel();
    o.closeOnDone = true;

    o.write(['/interface/monitor-traffic', '=interface=ether3', '=interval=5'], function (channel) {
        console.log('Listening for traffic');
        console.log('Press CTRL-C to stop listening.');
        channel.on('done', function () {
            console.log('monitor-traffic listen done');
        });
        channel.addListener('read', interfaceOutput);
    });
});
