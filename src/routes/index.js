const express = require('express')
const router = express.Router()
const multer = require("multer")();
const fileConverter = require("./../component/convert");


router.post("/convert/convert-to-pdf", multer.any(), fileConverter);

module.exports = router;
