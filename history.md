# History

A terribly messy history, yes.

in early node <= 0.2 things were event based

Old school node echo server! We were doing our own piping!
``` js
var net = require('net');
net.createServer(function(socket) {
    socket.write('Echo server\r\n');
    socket.on('data',function(data){
        socket.write(data);
    });
    socket.on('end',function(){
        socket.end();
    });
}).listen(8124,'127.0.0.1');
```

Then there was something called sys.pump for a very brief period of time, but it was the foundational concept for what became the stream pipe method in 0.4.2 which made great sense, because now all streams inherited this pipe method which of course is used to pipe data from stream to stream:

``` js
var net = require('net');
net.createServer(function(socket) {
    socket.write('Echo server\r\n');
    socket.pipe(socket);
}).listen(8124,'127.0.0.1');
```

But streams weren't perfect yet, to implement a stream one might do the following:

``` js
var stream = new Stream();
stream.readable = true;
stream.writable = true;
stream.write = function(data) {
    this.emit('data', data.toString().toUpperCase());
    return true;
};
stream.end = function(){
    return this.emit('end');
};
```

And there was this whole dialog around back pressure.  Every stream had to be aware of back pressure.
TCP has back pressure, human dialog has back pressure, plumbing has back pressure... and streams have back pressure.

But what we really wanted was transformation:

``` js
input.pipe(transformer).pipe(output);
```

in 0.4.2 pipe wasn't chainable but that was changed in 0.6 (I think it just returned null)

However lots of streaming modules came out after 0.6, substack used it quite a bit, for example in dnode,
there were things like pause-stream, dominictarr's scuttlebutt (an eventually consistent distributed memory resident data store thing), mux-demux (combining streams), through, pause-stream, etc.

However, we still have this back pressure issue, non-asynchronous piping and all kinds of other issues.

So work began on Streams 2  So this is a big thing, there is a Streams 1 which I've touched on lightly but there is now a Streams 2.

Original streams are like "push streams" (the source is pushing the data out) - this is streams 1
pull streams are like a drinking straw
then there are pump streams, which is kind of like both. - this is streams 2

So lots of versions of streams, it really comes down to which is the most appropriate for any given situation.

# Streams 1:

back pressure in pump streams: 

back pressure propagates back when .write() === false

``` js
source                // emits "readable"
    .pipe(transform)
    .pipe(sink);
```

``` js
source
    .pipe(transform) // write(data), emits "readable"
    .pipe(sink);
```

``` js
source
    .pipe(transform)
    .pipe(sink);     // if the sink is paused, or can't write for some reason, then it's
                     // write returns false (that is: write(data) === false in the step above)
```

``` js
source
    .pipe(transform) // write(data) === false, this propagates to source, and source will now be paused as well.
    .pipe(sink);
```

``` js
source               // source is now paused
    .pipe(transform) // transform is now paused
    .pipe(sink);     // sink is now paused
```

But it is interesting to note that it takes N writes from the source corresponding to N stages in the pipe chain to learn that write is false, or that the streams are paused.

So back pressure does not propagate instantly.

# Did we have any other choice?

* gozala/reducers          // was inspired by clojure
* Raynos/recurse-stream
* dominictarr/strm
* dominictarr/pull-stream
* creationix/min-stream
* rxjs
* baconjs

and of course now we have: 

* streams 3 === streams 1 | streams 2

# But ultimately

Streams let you treat programs as pieces that can be plumbed together.

readable streams are just event emitters that emit a data event and an end event

a through stream is a readable/writable stream:
``` js
var Stream = require('stream');
var ts = new Stream;
ts.readable = true;
ts.writable = true;

ts.write = function(buf) {
    ts.emit('data',buf.toString().toUpperCase());
};
ts.end = function(buf){
    if(arguments.length) ts.write(buf);
    ts.emit('end');
};

process.stdin.pipe(ts).pipe(process.stdout);
```

For handling back pressure, you use pause() and resume().

Transform Stream: A duplex stream - a readable side and a writable side
Writable Stream: A destination for data

There are two ways to consume a node readable stream.

way 1: You get data pushed at you, you have no control over when you get the next chunk
       (A readable stream consumed as a push stream)

way 2: A pull stream - you have full control over when you get the next chunk.
       (the drinking straw)


Restaurants analogy (instead of doctor analogy)!

Now in node there really is not such a thing as a "pull stream" or a "push stream", actually there is just readablestream 
and however you use it determines whether it is flowing data to you or not which matches the push and pull concepts.

Doing streams in a push style gives you code like this:

```js
readable
    .pipe(transformOne)
    .pipe(transformTwo)
    .on('error',handleError)
    .on('end',handleEnd)
    .pipe(writable);
```

as soon as .pipe is called, the onData event is issued which causes data to start to flow through the pipe chain.

Instead of using .pipe you can actually subscribe to the 'data' event yourself

```js
readable
    .on('data',transformOne)
    .on('data',transformTwo)
    .on('error',handleError)
    .on('end',handleEnd)
    .pipe(writable);
```

Doing streams in a pull style gives you code like this:

```js
var val = readable.read();
if(val === null){
    readable.on('readable',function() { /* read data */ })
}
```

# So how do we implement a stream? {"Node": "^0.10"}

So node gives you base classes that you can use to implement streams:

Readable, Writable, Duplex, Transform, and PassThrough


## Readable:

Readable: implement _read([size])
Writable: implement _write(chunk, encoding, cb)
Transform: implement _transform(chunk, encoding, cb)
                 and _flush(cb)

* More detail on Readable stream:

var stream = require('stream');
var util = require('util');

var Readable = stream.Readable;

util.inherits(MyReadable, Readable);

function MyReadable(opts){
    if(!(this instanceof MyReadable)) return new MyReadable(opts);
    Readable.call(this,opts);
}

MyReadable.prototype._read = function() {
    this.push(this.idx++);
}

so _read is called once by Readable and to get another _read to happen, you'd call self.push(chunk);
self.push(null); // to signal the end of data.

## Writable:

var stream = require('stream');
var util = require('util');

var Writable = stream.Writable;
util.inherits(MyWritable,Writable);

function MyWritable(opts){
    if(!(this instanceof MyWritable)) return new MyWritable(opts);
    Writable.call(this,opts);
}

MyWritable.prototype._write = function(chunk, encoding, cb){
    this.sink(chunk,cb);
}

So, process the chunk, and call cb([error]); to signal write complete.  In this case the sink function is just an asynchronous function that would call cb when it was done.

So, back pressure and buffering is handled for you according to highWaterMark

All of this is handled for you under the hood by the new streams.

## Transform:

var stream = require('stream');
var util = require('util');

var Transform = stream.Transform;
util.inherits(MyTransform,Transform);

function MyTransform(opts) {
    if(!(this instanceof MyTransform)) return new MyTransform(opts);
    Transform.call(this,opts);
}

MyTransform.prototype._transform = function(num, encoding, cb){
    var self = this;
    function respond() {
        self.push(num * num);
        cb();
    }

    setTimeout(respond,this._throttle);
}

So call self.push(chunk) 0 or more times.  For example, a filter would push never for something it was filtering and then call the cb and that value would disappear from 
future stages in the chain.  But if you have multiple values that result from one, due to your transform, you can push more than once, and then call the cb.

Then implement _flush if you want to send something at the very end.

## Duplex: 


## More info:
Again all of these classes, Readable, Writable, Transform, Duplex, PassThrough are all EventEmitters so you can attach listeners and emit events as you normally would.

# And gulp?


