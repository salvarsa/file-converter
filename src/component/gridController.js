const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const multer = require('multer');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs')

let gfsBucket;

// Establece la conexión a MongoDB usando mongoose
const connection = mongoose.connection;
connection.once('open', async () => {
    const db = connection.db; 
    gfsBucket = new GridFSBucket(db, {
        bucketName: 'gridTest', 
        //chunkSizeBytes: 2048 * 2048  // 1MB en bytes
    });
    console.log('GridFSBucket inicializado.');
});

// Configuración de multer para usar almacenamiento en memoria
const storage = multer.memoryStorage();
const uploadFile = multer({ storage: storage });

// Controlador que maneja la conversión y el almacenamiento en GridFS
const upload = (req, res) => {
    if (!gfsBucket) {
        return res.status(500).send('BUCKET_NOT_INITIATED');
    }

    const file = req.files[0];
    //console.log('-------------req.files[0]------------>',req.files[0]);
    
    const uploadStream = gfsBucket.openUploadStream(file.originalname, {
        //chunkSizeBytes: 2048 * 2048  // 1MB en bytes
    });

    uploadStream.on('finish', () => {
        res.status(200).send(file.originalname);
    });

    uploadStream.on('error', (err) => {
        console.error('UPLOAD_ERROR', err);
        res.status(500).send(err);
    });

    uploadStream.write(file.buffer);
    uploadStream.end();
};

// const download = async (req, res) => {
//     const connection = mongoose.connection;

//     if (connection.readyState !== 1) {
//         return res.status(500).send('Conexión a la base de datos no está disponible');
//     }

//     const db = connection.db;
//     const gfsBucket = new GridFSBucket(db, { bucketName: 'gridTest' });

//     // El _id del archivo que quieres descargar
//     const _id = new ObjectId('6717d0147e923c940c89c0d8');  // Reemplaza con el _id real

//     // Especificar la ruta de la carpeta en la que quieres que se descargue el archivo
//     const downloadFolder = path.join(__dirname, '../downloads');  // Ruta absoluta a la carpeta "downloads"
//     const filePath = path.join(downloadFolder, 'sdiPaton.mp4');  // Ruta completa del archivo

//     // Verificar si la carpeta de descarga existe, si no, crearla
//     if (!fs.existsSync(downloadFolder)) {
//         fs.mkdirSync(downloadFolder);
//     }

//     console.log(`Iniciando descarga de archivo con _id: ${_id}`);

//     const downloadStream = gfsBucket.openDownloadStream(_id);
//     const writeStream = fs.createWriteStream(filePath);

//     // Escribir los datos descargados en el archivo dentro de la carpeta especificada
//     downloadStream.pipe(writeStream)
//         .on('error', (err) => {
//             console.error('Error al descargar el archivo:', err);
//             return res.status(500).send('Error al descargar el archivo.');
//         })
//         .on('finish', () => {
//             console.log(`Archivo descargado correctamente. Guardado en: ${filePath}`);
//             res.status(200).send(`Archivo descargado correctamente. Guardado en: ${filePath}`);
//         });

//     // Agregar eventos para asegurarse de que la descarga comienza
//     downloadStream.on('data', (chunk) => {
//         console.log(`Descargando datos... Tamaño del chunk: ${chunk.length}`);
//     });
// };

// Función para descargar un archivo por su ID y guardarlo localmente en el servidor

const download = async (req, res) => {
    const connection = mongoose.connection;

    if (connection.readyState !== 1) {
        return res.status(500).send('Conexión a la base de datos no está disponible');
    }

    const db = connection.db;
    const gfsBucket = new GridFSBucket(db, { bucketName: 'gridTest' });

    try {
        const _id = new ObjectId(req.params.id); 

        const files = await gfsBucket.find({ _id }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).send('Archivo no encontrado');
        }

        const fileName = files[0].filename;

        // Especificar la ruta de la carpeta donde se guardará el archivo
        const downloadFolder = path.join(__dirname, '../downloads');  // Ruta a la carpeta "downloads"
        const filePath = path.join(downloadFolder, fileName);  // Ruta completa con el nombre del archivo

        // Verificar si la carpeta de descarga existe, si no, crearla
        if (!fs.existsSync(downloadFolder)) {
            fs.mkdirSync(downloadFolder);
        }

        console.log(`Iniciando descarga de archivo con _id: ${_id}`);

        // Crear un stream de descarga desde GridFS
        const downloadStream = gfsBucket.openDownloadStream(_id);
        const writeStream = fs.createWriteStream(filePath);

        // Pipe de datos para escribir el archivo descargado localmente
        downloadStream.pipe(writeStream)
            .on('error', (err) => {
                console.error('Error al descargar el archivo:', err);
                return res.status(500).send('Error al descargar el archivo.');
            })
            .on('finish', () => {
                console.log(`Archivo descargado correctamente. Guardado en: ${filePath}`);
                res.status(200).send(`Archivo descargado correctamente. Guardado en: ${filePath}`);
            });

        // Eventos para monitorear el progreso de la descarga
        downloadStream.on('data', (chunk) => {
            console.log(`Descargando datos... Tamaño del chunk: ${chunk.length}`);
        });

    } catch (err) {
        console.error('Error:', err);
        return res.status(400).send('ID no válido');
    }
};

module.exports = {  uploadFile, upload, download };
