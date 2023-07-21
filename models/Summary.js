const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const summarySchema = new Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  summary: {
    type: String,
    required: false  
  }
});

const Summary = mongoose.model('Summary', summarySchema);

module.exports = Summary;