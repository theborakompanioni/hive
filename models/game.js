var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var GameSchema = Schema({
    user: { type: Schema.ObjectId, ref: 'User' },
    white: String,
    black: String,
    pgn: String,
    result: String
});

mongoose.model('Game', GameSchema);