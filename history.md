# First, what is this?

The challenges of scalability, big data analysis, real time processing are challenges that many modern applications face. With Node.js, streams are a powerful API for data intensive computing but are also seen for a variety of other needs as they are simple to use and simple to implement.

Streams can be defined as a continuous flow of data that can be manipulated asynchronously as data comes in (or out). In Node.js streams can be readable or writable.

A readable stream is an EventEmitter object that emits data events every time a chunk of data is received.

Writable streams, on the other hand, accept streams of data. This type of stream inherits from the EventEmitter object too, and implements two methods: write() and end().

# The basics:

Requests to an HTTP server are streams, files can be used as streams, as well as stdout. Streams are readable, writable, or both. All streams are instances of EventEmitter.

Load the Stream base classes by doing: 

```js
require('stream')
```

## Stuff you may have seen before:

```js
// Plagiarized from docs:

var http = require('http');

var server = http.createServer(function (req, res) {
    // req is an http.IncomingMessage, which is a Readable Stream
    // res is an http.ServerResponse, which is a Writable Stream

    var body = '';
    // we want to get the data as utf8 strings
    // If you don't set an encoding, then you'll get Buffer objects
    req.setEncoding('utf8');

    // Readable streams emit 'data' events once a listener is added
    req.on('data', function (chunk) {
        body += chunk;
    });

    // the end event tells you that you have entire body
    req.on('end', function () {
        try {
            var data = JSON.parse(body);
        } catch (er) {
            // uh oh!  bad json!
            res.statusCode = 400;
            return res.end('error: ' + er.message);
        }

        // write back something interesting to the user:
        res.write(typeof data);
        res.end();
    });
});

server.listen(1337);

// $ curl localhost:1337 -d '{}'
// object
// $ curl localhost:1337 -d '"foo"'
// string
// $ curl localhost:1337 -d 'not json'
// error: Unexpected token o
```

# History

A terribly messy history, yes.

in early node <= 0.2 things were event based

Old school node echo server! We were doing our own piping!
``` js var net = require('net');
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

# Changes over time:

## [0.8 to 0.10](https://github.com/joyent/node/wiki/API-changes-between-v0.8-and-v0.10)

* Readable, Writable, Duplex, and Transform base classes added.
* Readable streams use a read() method instead of emitting 'data' events right away.
* Adding a 'data' event handler, or calling pause() or resume() will switch into "old mode".
* This means that data event handlers won't ever miss the first chunk if they're not added right away, and pause() is no longer merely advisory.
* If you don't consume the data, then streams will sit in a paused state forever, and the end event will never happen.

## [0.8 to 0.12](https://github.com/joyent/node/wiki/API-changes-between-v0.10-and-v0.12):

* Some bug fixes, nothing major.

# But ultimately

Streams let you treat programs as pieces that can be plumbed together.

So node gives you base classes that you can use to implement streams:

Readable, Writable, Duplex, Transform, and PassThrough

## Readable Streams

### Short and Sweet:

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

### More Detail:

Readable streams have two "modes": a flowing mode and a paused mode. When in flowing mode, data is read from the underlying system and provided to your program as fast as possible. In paused mode, you must explicitly call stream.read() to get chunks of data out. Streams start out in paused mode.

Readable streams are just event emitters that emit a data event and an end event

Note: If no data event handlers are attached, and there are no pipe() destinations, and the stream is switched into flowing mode, then data will be lost.

You can switch to flowing mode by doing any of the following:

* Adding a 'data' event handler to listen for data.
* Calling the resume() method to explicitly open the flow.
* Calling the pipe() method to send the data to a Writable.

You can switch back to paused mode by doing either of the following:

* If there are no pipe destinations, by calling the pause() method.
* If there are pipe destinations, by removing any 'data' event handlers, and removing all pipe destinations by calling the unpipe() method.

Note that, for backwards compatibility reasons, removing 'data' event handlers will not automatically pause the stream. Also, if there are piped destinations, then calling pause() will not guarantee that the stream will remain paused once those destinations drain and ask for more data.

Examples of readable streams:

* http responses, on the client
* http requests, on the server
* fs read streams
* zlib streams
* crypto streams
* tcp sockets
* child process stdout and stderr
* process.stdin

### Events:
* Event: 'readable'
    - When a chunk of data can be read from the stream, it will emit a 'readable' event.
    - Once the internal buffer is drained, a readable event will fire again when more data is available.

```js
var readable = getReadableStreamSomehow();
readable.on('readable', function() {
    // there is some data to read now
});
```
* Event: 'data'
    - Attaching a data event listener to a stream that has not been explicitly paused will switch the stream into flowing mode. Data will then be passed as soon as it is available.
    - the data is a Node Buffer and has a length property

```js
var readable = getReadableStreamSomehow();
readable.on('data', function(chunk) {
    console.log('got %d bytes of data', chunk.length);
});
```

* Event: 'end'
    - This event fires when there will be no more data to read.
    - (note thought the difference between calling ‘end’ and emitting ‘end’);

```js
var readable = getReadableStreamSomehow();
readable.on('data', function(chunk) {
    console.log('got %d bytes of data', chunk.length);
});
readable.on('end', function() {
    console.log('there will be no more data.');
});
```

* Event: 'close'
    - Emitted when the underlying resource (for example, the backing file descriptor) has been closed. Not all streams will emit this.

* Event: 'error'
    - Emitted if there was an error receiving data.

### methods:
* readable.read([size])
* readable.setEncoding(encoding)
    - 'utf8', 'hex'
    - This properly handles multi-byte characters that would otherwise be potentially mangled if you simply pulled the Buffers directly and called buf.toString(encoding) on them. If you want to read the data as strings, always use this method.
    - assert.equal(typeof chunk, 'string');
* readable.resume()
* readable.pause()
* readable.isPaused()
* readable.pipe(destination[, end])
    - end: boolean: default true. End the writer when the reader ends.

for example:
```js
reader.pipe(writer, { end: false });
reader.on('end', function() {
    writer.end('Goodbye\n');
});
```

* readable.unpipe([destination])
    - This method will remove the hooks set up for a previous pipe() call.
    - If the destination is not specified, then all pipes are removed.

* readable.unshift(chunk)
    - put stuff back.

* var newStream = readable.wrap(oldStream)

## Writable Streams:

Used for writing data

Examples include:

* http requests, on the client
* http responses, on the server
* fs write streams
* zlib streams
* crypto streams
* tcp sockets
* child process stdin
* process.stdout, process.stderr

### Short and Sweet:

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


### More Detail:

### Events:

* Event: 'drain'
    - If a writable.write(chunk) call returns false, then the drain event will indicate when it is appropriate to begin writing more data to the stream.
* Event: 'finish'
    - When the end() method has been called, and all data has been flushed to the underlying system, this event is emitted.
* Event: 'pipe'
    - This is emitted whenever the pipe() method is called on a readable stream, adding this writable to its set of destinations.
* Event: 'unpipe'
    - This is emitted whenever the unpipe() method is called on a readable stream, removing this writable from its set of destinations.
* Event: 'error'
    - Emitted if there was an error when writing or piping data.

### Methods

* writable.write(chunk[, encoding][, callback])
    - chunk String | Buffer The data to write
    - encoding String The encoding, if chunk is a String
    - callback Function Callback for when this chunk of data is flushed
    - Returns: Boolean True if the data was handled completely.
* writable.cork()
    - Forces buffering of all writes.
    - Buffered data will be flushed either at .uncork() or at .end() call.
* writable.uncork()
    - Flush all data, buffered since .cork() call.
* writable.setDefaultEncoding(encoding)
    - Sets the default encoding for a writable stream.
* writable.end([chunk][, encoding][, callback])
    - all this method when no more data will be written to the stream.
    - Calling write() after calling end() will raise an error.

## Duplex Streams:

Duplex streams are streams that implement both the Readable and Writable interfaces

## Through Streams

Transform streams are Duplex streams where the output is in some way computed from the input. They implement both the Readable and Writable interfaces. See above for usage.

### Short and Sweet:

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

Now in node there really is not such a thing as a "pull stream" or a "push stream", actually there is just ReadableStream 
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

The Duplex class is like a Readable and Writable stream in one. It’s like transmitting and receiving data in one stream. 

To implement a Duplex stream, inherit from stream.Duplex and implement both the _read and _write methods.

## PassThrough:

The PassThrough stream inherits from Transform and really all it does is relay the input to the output. It would be good for implementing spy’s to check on data being passed through different points in the stream for example (or you could perhaps write tests using a PassThrough stream).

Actually you don’t even really need PassThrough, you can could use a Transform stream that just pushes data itself.

## A bit more on piping:

Pipes look like this: readable.pipe(writable). 

And since Duplex and Transform streams can read and write, they can be used either way.

Again all of these classes, Readable, Writable, Transform, Duplex, PassThrough are all EventEmitters so you can attach listeners and emit events as you normally would.

## Cool stuff using streams:

* until-stream: https://github.com/EvanOxfeld/until-stream
* multiparser: https://github.com/jessetane/multiparser
* hiccup: https://github.com/naomik/hiccup
* bun: https://github.com/naomik/bun
* pillion: https://github.com/deoxxa/pillion
* csv-stream: https://github.com/klaemo/csv-stream


# And gulp?

## Install it! 

```sh
sudo npm install -g gulp 
gulp -v
npm install --save-dev gulp

npm install gulp-jshint gulp-sass gulp-concat gulp-uglify gulp-rename --save-dev
```

gulpfile.js:
```js
// Include gulp
var gulp = require('gulp'); 

// Include Our Plugins
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

// Lint Task
gulp.task('lint', function() {
    return gulp.src('js/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

// Compile Our Sass
gulp.task('sass', function() {
    return gulp.src('scss/*.scss')
        .pipe(sass())
        .pipe(gulp.dest('css'));
});

// Concatenate & Minify JS
gulp.task('scripts', function() {
    return gulp.src('js/*.js')
        .pipe(concat('all.js'))
        .pipe(gulp.dest('dist'))
        .pipe(rename('all.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('dist'));
});

// Watch Files For Changes
gulp.task('watch', function() {
    gulp.watch('js/*.js', ['lint', 'scripts']);
    gulp.watch('scss/*.scss', ['sass']);
});

// Default Task
gulp.task('default', ['lint', 'sass', 'scripts', 'watch']);
```

```sh
gulp
```
```sh
gulp default
```
```sh
gulp sass
```

[Gulp Plugins](https://www.npmjs.com/search?q=gulpplugin):


