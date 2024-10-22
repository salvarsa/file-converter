const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const routes = require("./routes/index.js");
const grids = require('./routes/gridMongo.js')
const {connectDb} = require('./component/mongoConnection.js')

const app = express()
app.use(bodyParser.json())

app.get('/', (req, res) => {
    res.send('file-transfer')
  })

app.use('/api/v1/', routes)
app.use('/api/v1/', grids)

const port = 3000

app.listen(port, () => {
    connectDb()
    console.log(`FILE-TRANSFER READY AT ${port}`);
})