# First, what is this?

* Handle scalability, 
* Big data, 
* Real time processing 
* Other stuff (rpc, gulp, etc)
* A continuous flow of data

Streams can be defined as a continuous flow of data that can be manipulated asynchronously

# In node terms?

* EventEmitters that emit events

* Readable
* Writable
* Duplex
* Transform
* PassThrough

# The basics:

Requests to an HTTP server are streams, files can be used as streams, as well as stdout. 

Streams are readable, writable, or both. All streams are instances of EventEmitter.

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

Node <= 0.2

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

sys.pump?

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

## What is this backpressure thing?

``` js
input.pipe(transformer).pipe(output);
```


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

* More detail on Readable stream

```js
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
```

so _read is called once by Readable and to get another _read to happen, you'd call self.push(chunk);
```js
self.push(null); // to signal the end of data.
```

### Events:
* 'readable'
* 'data'
* 'end'
* 'close'
* 'error'

### methods:
* readable.read([size])
* readable.setEncoding(encoding)
* readable.resume()
* readable.pause()
* readable.isPaused()
* readable.pipe(destination[, end])
* readable.unpipe([destination])
* readable.unshift(chunk)
* readable.wrap(oldStream)

## Writable Streams:

### Short and Sweet:

```js
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
```

Back pressure and buffering is handled for you according to highWaterMark

### More Detail:

### Events:

* 'drain'
* 'finish'
* 'pipe'
* 'unpipe'
* 'error'

### Methods

* writable.write(chunk[, encoding][, callback])
* writable.cork()
* writable.uncork()
* writable.setDefaultEncoding(encoding)
* writable.end([chunk][, encoding][, callback])

## Transform Streams:

Transform streams are streams that implement both the Readable and Writable interfaces

### Short and Sweet:

Transform streams are Duplex streams where the output is in some way computed from the input. They implement both the Readable and Writable interfaces.

```js
readable
    .pipe(transformOne)
    .pipe(transformTwo)
    .on('error',handleError)
    .on('end',handleEnd)
    .pipe(writable);
```

```js
readable
    .on('data',transformOne)
    .on('data',transformTwo)
    .on('error',handleError)
    .on('end',handleEnd)
    .pipe(writable);
```

```js
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
```

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


