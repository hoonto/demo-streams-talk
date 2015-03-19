// Require module references.
var stream = require( "stream" );
var util = require( "util" );
var chalk = require( "chalk" );


// I am a SOURCE stream, providing a stream of Friends, in object mode.
function FriendStream() {

    stream.Readable.call(
        this,
        {
            objectMode: true,
            highWaterMark: 1,
        }
    );

    this._friends = [ "Kim", "Sarah", "Kit", "Tricia", "Libby", "Joanna" ];

}

util.inherits( FriendStream, stream.Readable );


// I read data out of the underlying source and push it only the underlying buffer.
FriendStream.prototype._read = function( size ) {

    // While we still have Friends, and the buffer is not full, keep pushing friends.
    while ( this._friends.length && size-- ) {

        if ( this.push( this._friends.shift() ) === null ) {

            break;

        }

    }

    // If we have no more friends, end the stream.
    if ( ! this._friends.length ) {

        this.push( null );

    }

};


// ---------------------------------------------------------- //
// ---------------------------------------------------------- //


// I am a TRANSFORM stream, decorating each friend with a compliment, in object mode.
function ComplimentStream() {

    stream.Transform.call(
        this,
        {
            objectMode: true
        }
    );

}

util.inherits( ComplimentStream, stream.Transform );


// I transform the input chunk to the output chunk.
ComplimentStream.prototype._transform = function( friend, isEncoded, getNextChunk ) {

    // Issuing an error for the exploration.
    if ( friend === "Kit" ) {

        return( getNextChunk( new Error( "No Kits allowed!" ) ) );

    }

    this.push( friend + ", you are awesome!" );

    getNextChunk();

};


// ---------------------------------------------------------- //
// ---------------------------------------------------------- //


// I am a DESTINATION stream, keeping track of journal line items, in object mode.
function JournalStream() {

    stream.Writable.call(
        this,
        {
            objectMode: true
        }
    );

    this._entries = [];

}

util.inherits( JournalStream, stream.Writable );


// I write the given entry to the internal journal.
JournalStream.prototype._write = function( entry, encoding, done ) {

    this._entries.push( entry );

    done();

};


// ---------------------------------------------------------- //
// ---------------------------------------------------------- //


// Create a new instance of our compliment stream (ie, our TRANSFORM stream). This acts
// as both a Writable and a Readable stream.
var complimentStream = new ComplimentStream()
    .on(
        "unpipe",
        function handleUnpipeEvent( source ) {

            console.log( chalk.bgYellow( "FriendStream unpiped from ComplimentStream." ) );

        }
    )
    .on(
        "error",
        function handleErrorEvent( error ) {

            console.log( chalk.red( "Compliment error:", error ) );

            // When the compliment stream raises an error, the FriendStream is
            // automatically going to unpipe itself from this [ComplimentStream] stream.
            // That's all that Node.js does in the event of an error in a pipe-context.
            // The stream itself is still left open. But, since we know that no more
            // friends are going to be written, we have to explicitly END the Writable
            // aspect of the Transform stream.
            // --
            // NOTE: Sometimes you see people "emit" an "end" event here. That is the
            // wrong approach as it signals the end of the stream _without_ actually
            // ending it, which is poor implementation of intent.

            this.end();
            this.emit('end');

        }
    )
;

// Create our streams and pipe them : FRIENDS -> COMPLIMENT -> JOURNAL.
var journalStream = new FriendStream()
    .pipe( complimentStream )
    .pipe( new JournalStream() )
;

// When the DESTINATION stream is finished, log the state of the journal entries.
journalStream.on(
    "finish",
    function handleEndEvent() {

        console.log( chalk.cyan( "Stream finished." ) );
        console.dir( this._entries );

    }
);
