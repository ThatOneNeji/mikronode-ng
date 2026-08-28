// src interface
/* jshint undef: true */
/* globals Promise */
const MikroNode = require('../lib/index.js');

/* Don't be surprised if you see the output interleaved. :) */

let interfaceList = {};

function ipOutput(p) {
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
     //   console.log('IP: address ' + v.address + c.join("\n"));
    }
    return true;
}

const c1 = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
c1.closeOnDone = true;
c1.connect(function (c) {
    const o = c.openChannel();
    o.closeOnDone = true;
    /*
        channels.chan_monitor.write(['/interface/monitor-traffic', interface_str], function (c) {
            c.addListener('read', function (data) {
                var parsed = mikronode.parseItems(data);
                update_emitter(parsed); //function that sends update on the websocket room
            });
        }
    */


    o.write(['/interface/monitor-traffic', '=interface=ether3', '=interval=5'], function (channel) {
        console.log('Listening to ip changes.');
        console.log('Press CTRL-C to stop listening.');
        channel.on('done', function () {
            console.log('ip listen done');
        });
        channel.addListener('read', ipOutput); // report when an IP is being addeed.
    });
    /*
        o.write(['/interface/monitor-traffic', '=interface=', 'ether3'], function (channel) {
            console.log('Getting Interfaces');
            channel.once('done', function (p, chan) {
                let d = MikroNode.parseItems(p);
                d.forEach(function (i) {
                    console.log(i);
                });
            });
            channel.on('trap', function (trap, chan) {
                console.log(`Command failed:`, trap);
            });
            channel.on('error', function (err, chan) {
                console.log(`Oops:`, err);
            });
        });

        */
    /*
        o.write('/ip/route/print', function (channel) {
            console.log('Getting routes');
            channel.on('done', function (p, chan) {
                console.log('Routes:');
                let d = MikroNode.parseItems(p);
                d.forEach(function (i) {
                    console.log(i);
                });
            });
        });
        */
});

/* Now let's do this with Promises */
/*
var connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4], {
    closeOnDone: false
});

var connPromise = connection.getConnectPromise().then(function (conn) {
    var chan1Promise = conn.getCommandPromise('/interface/print');
    var chan2Promise = conn.getCommandPromise('/ip/route/print');
    Promise.all([chan1Promise, chan2Promise]).then(function resolved(values) {
        console.log('Interfaces via Promise: ' + JSON.stringify(values[0]) + '\n\n');
        console.log('Routes via Promise: ' + JSON.stringify(values[1]) + '\n\n');
        conn.close();
    }, function rejected(reason) {
        console.log('Oops: ' + reason);
    });
});
*/
