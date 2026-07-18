// src interface
/* jshint undef: true */
/* globals Promise */
const MikroNode = require('../lib/index.js');

/* Don't be surprised if you see the output interleaved. :) */

const c1 = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
c1.closeOnDone = true;
c1.connect(function (c) {
    const o = c.openChannel();
    o.closeOnDone = true;
    o.write('/interface/print', function (channel) {
        console.log('Getting Interfaces');
        channel.once('done', function (p, chan) {
            const d = MikroNode.parseItems(p);
            d.forEach(function (i) {
                console.log(JSON.stringify(i));
            });
        });
        channel.on('trap', function (trap, chan) {
            console.log('Command failed: ' + trap);
        });
        channel.on('error', function (err, chan) {
            console.log('Oops: ' + err);
        });
    });
    o.write('/ip/route/print', function (channel) {
        console.log('Getting routes');
        channel.on('done', function (p, chan) {
            console.log('Routes:');
            const d = MikroNode.parseItems(p);
            d.forEach(function (i) {
                console.log(JSON.stringify(i));
            });
        });
    });
});

/* Now let's do this with Promises */

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4], {
    closeOnDone: false
});

const connPromise = connection.getConnectPromise().then(function (conn) {
    const chan1Promise = conn.getCommandPromise('/interface/print');
    const chan2Promise = conn.getCommandPromise('/ip/route/print');
    Promise.all([chan1Promise, chan2Promise]).then(function resolved(values) {
        console.log('Interfaces via Promise: ' + JSON.stringify(values[0]) + '\n\n');
        console.log('Routes via Promise: ' + JSON.stringify(values[1]) + '\n\n');
        conn.close();
    }, function rejected(reason) {
        console.log('Oops: ' + reason);
    });
});
