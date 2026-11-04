// Reply parsing and channel routing, without a device: bytes go straight into
// Connection._read(), framed the way RouterOS frames them (length-prefixed words, a
// zero-length word ending each sentence, `.tag` naming the channel).
//
// Regression for replies of several channels on one connection getting merged: seen
// with node-red-contrib-mikronode-ng, where a `/interface/wifi/print` snapshot's `done`
// also held a `monitor-traffic` row and ~300 `/log/print =follow=` entries that had
// arrived in the same TCP chunks.
const test = require('node:test');
const assert = require('node:assert');
const MikroNode = require('../lib/index.js');
const utils = require('../lib/utils.js');

function sentence(words) {
    return Buffer.concat(words.map(utils.encodeString).concat([Buffer.from([0])]));
}

function connectionWithChannels(ids) {
    const connection = MikroNode.getConnection('test-host', 'user', 'password');
    const channels = {};
    ids.forEach(function (id) {
        const channel = connection.openChannel(id);
        channel.on('error', function () {});
        channel.reads = [];
        channel.on('read', function (data) {
            channel.reads.push(MikroNode.parseItems(data));
        });
        channels[id] = channel;
    });
    return { connection: connection, channels: channels };
}

test('routes each sentence of a mixed chunk to its own channel', function () {
    const t = connectionWithChannels(['wifi', 'traffic', 'log']);
    t.connection._read(Buffer.concat([
        sentence(['!re', '.tag=wifi', '=.id=*50', '=name=wlan1']),
        sentence(['!re', '.tag=traffic', '=name=ether1', '=rx-bits-per-second=1808736']),
        sentence(['!re', '.tag=log', '=.id=*266A', '=message=user admin logged in']),
        sentence(['!re', '.tag=wifi', '=.id=*51', '=name=wlan2'])
    ]));

    assert.deepStrictEqual(t.channels.wifi.reads, [
        [{ '.id': '*50', name: 'wlan1' }],
        [{ '.id': '*51', name: 'wlan2' }]
    ]);
    assert.deepStrictEqual(t.channels.traffic.reads, [[{ name: 'ether1', 'rx-bits-per-second': 1808736 }]]);
    assert.deepStrictEqual(t.channels.log.reads, [[{ '.id': '*266A', message: 'user admin logged in' }]]);
});

test('done carries only its own channel\'s rows, even when other channels\' rows arrive in between', function () {
    const t = connectionWithChannels(['wifi', 'traffic']);
    let done = null;
    t.channels.wifi.on('done', function (data) {
        done = MikroNode.parseItems(data);
    });

    t.connection._read(Buffer.concat([
        sentence(['!re', '.tag=wifi', '=.id=*50', '=name=wlan1']),
        sentence(['!re', '.tag=traffic', '=name=ether1']),
        sentence(['!re', '.tag=wifi', '=.id=*51', '=name=wlan2']),
        sentence(['!done', '.tag=wifi'])
    ]));

    // The 'read' listener above parsed every row first: done must still have them all.
    assert.deepStrictEqual(done, [{ '.id': '*50', name: 'wlan1' }, { '.id': '*51', name: 'wlan2' }]);
    assert.deepStrictEqual(t.channels.traffic.reads, [[{ name: 'ether1' }]]);
});

test('reassembles sentences split across chunks at any byte, including multi-byte UTF-8', function () {
    const bytes = Buffer.concat([
        sentence(['!re', '.tag=log', '=message=café ✓ ' + 'x'.repeat(200)]),
        sentence(['!re', '.tag=traffic', '=name=ether1'])
    ]);
    for (let split = 1; split < bytes.length; split++) {
        const t = connectionWithChannels(['log', 'traffic']);
        t.connection._read(bytes.subarray(0, split));
        t.connection._read(bytes.subarray(split));
        assert.deepStrictEqual(t.channels.log.reads, [[{ message: 'café ✓ ' + 'x'.repeat(200) }]],
            'split at byte ' + split);
        assert.deepStrictEqual(t.channels.traffic.reads, [[{ name: 'ether1' }]], 'split at byte ' + split);
    }
});

test('reports a trap on its own channel only', function () {
    const t = connectionWithChannels(['traffic', 'routes']);
    let trap = null;
    let routesDone = false;
    t.channels.traffic.on('trap', function (tr) {
        trap = tr;
    });
    t.channels.routes.on('done', function () {
        routesDone = true;
    });

    t.connection._read(Buffer.concat([
        sentence(['!trap', '.tag=traffic', '=message=input does not match any value of interface']),
        sentence(['!done', '.tag=routes']),
        sentence(['!done', '.tag=traffic'])
    ]));

    assert.strictEqual(trap.errors[0].message, 'input does not match any value of interface');
    assert.strictEqual(trap.channelId, 'traffic');
    assert.strictEqual(routesDone, true);
});

test('delivers a done =ret= value as a row', function () {
    const t = connectionWithChannels(['add']);
    let done = null;
    t.channels.add.on('done', function (data) {
        done = MikroNode.parseItems(data);
    });
    t.connection._read(sentence(['!done', '.tag=add', '=ret=*5']));
    assert.deepStrictEqual(done, [{ ret: '*5' }]);
});

test('parseItems leaves its input untouched', function () {
    const data = [['!re', '=name=ether1', '=mtu=1500']];
    assert.deepStrictEqual(MikroNode.parseItems(data), [{ name: 'ether1', mtu: 1500 }]);
    assert.deepStrictEqual(data, [['!re', '=name=ether1', '=mtu=1500']]);
});
