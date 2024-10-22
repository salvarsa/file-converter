const {connect} = require('mongoose')
const mongoose = require('mongoose');

const db = 'mongodb://root:12345abc@localhost:27017/mongo_grid?authSource=admin&directConnection=true'

const connectDb = async () => {
    try {
        await connect(db, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('DB CONNECTED..');
    } catch (error) {
        console.error('DB CONNECTION ERROR:', error);
    }
}

module.exports = { connectDb, connection: mongoose.connection };