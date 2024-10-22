const express = require('express');
const router = express.Router();
const multer = require('multer')();
const { uploadFile, upload, download } = require('../component/gridController.js')
//const { upload, upload } = require('../component/convert.js');

router.get('/download/:id', download);
router.post('/grid', uploadFile.any(), upload);

module.exports = router;