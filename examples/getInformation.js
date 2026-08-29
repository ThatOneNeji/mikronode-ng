const MikroNode = require('../lib/index.js');

const c1 = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
c1.closeOnDone = true;
c1.connect(function (c) {
    const o = c.openChannel();
    o.closeOnDone = true;
    o.write('/system/package/print', function (channel) {
        console.log('Getting packages...');
        channel.once('done', function (p, chan) {
            const d = MikroNode.parseItems(p);
            console.log('Packages:' + JSON.stringify(d));
        });
        channel.on('trap', function (trap, chan) {
            console.log('Command failed: ' + trap);
        });
        channel.on('error', function (err, chan) {
            console.log('Oops: ' + err);
        });
    });

    o.write('/system/resource/print', function (channel) {
        console.log('Getting resources...');
        channel.on('done', function (p, chan) {
            const d = MikroNode.parseItems(p);
            console.log('Resources:' + JSON.stringify(d));
        });
        channel.on('trap', function (trap, chan) {
            console.log('Command failed: ' + trap);
        });
        channel.on('error', function (err, chan) {
            console.log('Oops: ' + err);
        });
    });
});
