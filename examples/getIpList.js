const MikroNode = require('../lib/index.js');

let connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4], {
    timeout: 4,
    closeOnDone: true,
    closeOnTimeout: true,
});


connection.connect(function (conn) {
    const chan = conn.openChannel();
    conn.closeOnDone = true;
    chan.write(['/ip/address/print', '=interval=5'], function () {
        chan.closeOnDone = true;
        chan.on('done', function (data) {
            let parsed = MikroNode.parseItems(data);
            parsed.forEach(function (item) {
                console.log('Interface/IP: ' + item.interface + "/" + item.address);
            });
        });
        chan.once('trap', function (trap, chan) {
            console.log(`Command failed:`, trap);
        });
        chan.once('error', function (err, chan) {
            console.log(`Oops:`, err);
        });
    });
});


/* Now let's do this with Promises */
/*
connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4], {
    closeOnDone: true
});

connection.getConnectPromise().then(function (conn) {
    conn.getCommandPromise('/ip/address/print').then(function resolved(values) {
        console.debug(`Addreses:`, values);
    }, function rejected(error_) {
        console.error(`Oops`, error_);
    });
});
*/
