const express = require('express');
const router = express.Router();
const { convertController, upload } = require('../component/convert.js');

router.post('/convert/convert-to-pdf', upload.single('file'), convertController);

module.exports = router;