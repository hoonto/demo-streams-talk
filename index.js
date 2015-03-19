var fs = require('fs');
var path = require('path');
var split = require('split');
var fileName = path.join(__dirname, 'input.txt');

var Transform = require('stream').Transform;
var util = require('util');

util.inherits(ProblemStream, Transform); // inherit Transform

function ProblemStream () {
    Transform.call(this/*, { "objectMode": true }*/); // invoke Transform's constructor
}

/*
Transform streams have two important methods _transform and _flush.
_transform is invoked whenever data is written to the stream.
_flush is invoked when the transform stream has been notified that nothing else will be written to it. This function is helpful for completing any unfinished tasks.
*/

ProblemStream.prototype._transform = function (line, encoding, processed) {
    this.push(line);
    console.log('MLM: typeof line.id: ',typeof line.id);
    processed();
};

fs.createReadStream(fileName)
.pipe(split())
.pipe(new ProblemStream())
.pipe(process.stdout);
//.on('data',function(line){
//    console.log('MLM: line: ',line);
//});




