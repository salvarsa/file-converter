const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const routes = require("./routes/index.js");

const app = express()
app.use(bodyParser.json())

app.get('/', (req, res) => {
    res.send('file-transfer')
  })

app.use('/api/v1/', routes)

const port = 3000

app.listen(port, () => {
    console.log(`FILE-TRANSFER READY AT ${port}`);
})