# MikroNode

  Full-Featured asynchronous Mikrotik API interface for [NodeJS](http://nodejs.org).

```js
const MikroNode = require('mikronode-ng');

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4]);
connection.connect(function(conn) {
    const chan = conn.openChannel();
    conn.closeOnDone = true;
    chan.write('/ip/address/print', function() {
        chan.closeOnDone = true;
        chan.on('done', function(data) {
            const parsed = MikroNode.parseItems(data);
            parsed.forEach(function(item) {
                console.log('Interface/IP: ' + item.interface + "/" + item.address);
            });
        });
        chan.once('trap', function(trap, chan) {
            console.log('Command failed: ' + trap);
        });
        chan.once('error', function(err, chan) {
            console.log('Oops: ' + err);
        });
    });
});

    /* Now let's do this with Promises */

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4], {
    closeOnDone : true
});

connection.getConnectPromise().then(function(conn) {
    conn.getCommandPromise('/ip/address/print').then(function resolved(values) {
        console.log('Addreses: ' + JSON.stringify(values));
    }, function rejected(reason) {
        console.log('Oops: ' + JSON.stringify(reason));
    });
});
```

## Features

* Channel based communication
* Multiple Connections can be used in parallel in the same Node process
* Multiple Channels can be used in parallel on the same Connection
* Synchronous execution of commands issued on the same channel
* Asynchrounous execution of commands issued on different channels
* Focus on high performance
* ES6 Promise support for Connection and Channel
* TLS Support

## Upgrading from versions < 1.0.0

There are 2 changes that will need to be made...

```js
const MikroNode = require('mikronode-ng');
// From
const connection = new MikroNode(...)
// To
const connection = MikroNode.getConnection(...)
// or
const connection = new MikroNode.Connection(...)

// From
connection.closeOnDone(true);
channel.closeOnDone(true);
// To
connection.closeOnDone = true;
channel.closeOnDone = true;
```

Everything else should work as expected.

## TODO

* [ ] Make changes so that this becomes a node for Node-red

## API

See the [API JSDocs](doc/index.html) in the doc directory.

## Notes for Node < 22.0.0

MikroNode requires 2 ES6 features that appeared in Node 4.0.0: Promises and WeakMaps.  If
you're running an earlier version of Node and MikroNode can't find those symbols, it will
attempt to load them from the 'es6-promise' and 'weakmap' packages respectively.  If you wish
to use other packages to supply those symbols, require them before requiring mikronode and
set the global symbols.

```js
global.WeakMap = require('some-weakmap-polyfill').WeakMap;
global.Promise = require('some-promise-polyfill').Promise;
const MikroNode = require('mikronode-ng');
```

## Tests

The [test](test/) directory contains a test that exercises all functionality including
Promises and listens/cancels.

## Examples

[Examples (including Promise examples)](examples/)

### Connect to a Mikrotik, and add an address to ether1

```js
const MikroNode = require('mikronode-ng');

const connection = MikroNode.getConnection('192.168.88.1','admin','password');
connection.closeOnDone = true;

connection.connect(function(conn) {
    const chan=conn.openChannel();
    chan.closeOnDone = true;
    chan.write(['/ip/address/add','=interface=ether1','=address=192.168.1.1'], function(c) {
        c.on('trap',function(data) {
            console.log('Error setting IP: '+data);
        });
        c.on('done',function(data) {
            console.log('IP Set.');
        });
    });
});
```

### Writing the program for the example API conversation on the [Mikrotik Wiki](http://wiki.mikrotik.com/wiki/API#.2Fcancel.2C_simultaneous_commands)

DON'T RUN THIS IF YOU'RE CONNECTED VIA ether1! :)

```js
const MikroNode = require('mikronode-ng');
const connection = MikroNode.getConnection('192.168.88.1','admin','password');

connection.connect(function(conn) {

    conn.closeOnDone = true;
    const chan2=conn.openChannel(2);
    chan2.write('/interface/listen',function(chan) {
        chan.on('read',function(data) {
            packet=MikroNode.parseItems(data);
            console.log('Interface change: '+JSON.stringify(packet));
        });
    });

    const chan3=conn.openChannel(3);
    chan3.closeOnDone = true

    chan3.write(['/interface/set','=disabled=yes','=.id=ether1'],function(chan) {
        chan.on('done',function(d,chan) {
            // We do this here, 'cause we want channel 4 to write after channel 3 is done.
            const chan4=conn.openChannel(4); // We'll use this later.
            chan4.closeOnDone = true;
            chan4.write(['/interface/set','=disabled=no','=.id=ether1'],function() {
                const chan5=conn.openChannel(5);
                chan5.closeOnDone = true;
                chan5.write('/interface/getall',function(chan) {
                    chan.on('done',function(data) {
                        packets=MikroNode.parseItems(data);
                        packets.forEach(function(packet) {
                            console.log('Interface: '+JSON.stringify(packet));
                        });
                        chan2.close(); // This should call the /cancel command to stop the listen.
                   });
                });
            })
        });
    });
});
```

### Simplifying the above by reducing the number of channels

DON'T RUN THIS IF YOU'RE CONNECTED VIA ether1! :)
  Notice how the callback embedding is not needed using the syncronous capability.

```js
const MikroNode = require('mikronode-ng');

const connection = MikroNode.getConnection('192.168.88.1','admin','password');
connection.connect(function(conn) {

    conn.closeOnDone = true; // All channels need to complete before the connection will close.
    const listenChannel=conn.openChannel();
    listenChannel.write('/interface/listen',function(chan) {
        chan.on('read',function(data) {
            packet=MikroNode.parseItems(data);
            console.log('Interface change: '+JSON.stringify(packet));
        });
    });

    const actionChannel=conn.openChannel();
    // These will run synchronsously
    actionChannel.write(['/interface/set','=disabled=yes','=.id=ether1']); // don't care to do anything after it's done.
    actionChannel.write(['/interface/set','=disabled=no','=.id=ether1']); // don't care to do anything after it's done.
    actionChannel.write('/interface/getall',function(chan) {
        chan.on('done',function(data) {
            packets=MikroNode.parseItems(data);
            packets.forEach(function(packet) {
                console.log('Interface: '+JSON.stringify(packet));
            });
            listenChannel.close(); // This should call the /cancel command to stop the listen.
        });
    });
    actionChannel.close(); // The above commands will complete before this is closed.
});
```

### A simple Promise scenario

```js
// If your nodejs installation doesn't have Promise support, uncomment
// the following line
//require('es6-promise').polyfill();
// or globally export Promise from your favorite ES6 compatable Promise library.
const MikroNode = require('mikronode-ng');

const connection = MikroNode.getConnection(process.argv[2], process.argv[3], process.argv[4], {
    closeOnDone : true
});

connection.getConnectPromise().then(function(conn) {
    conn.getCommandPromise('/ip/address/print').then(function resolved(values) {
        console.log('Addreses: ' + JSON.stringify(values));
    }, function rejected(reason) {
        console.log('Oops: ' + JSON.stringify(reason));
    });
});
```

The methods *decodeLength* and *encodeString* were written based on code [here on the Mikrotik Wiki](http://wiki.mikrotik.com/wiki/API_PHP_class#Class).
