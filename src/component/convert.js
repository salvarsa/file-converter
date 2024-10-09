const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');

// Ruta al script de Python
const pythonScriptPath = path.join(__dirname, '..', '..', '..', 'file-converterpy', 'convert.py');

// Ruta al entorno virtual de Python
const venvPath = path.join(__dirname, '..', '..', '..', 'file-converterpy', 'venv');

// Configuración de multer para manejar la carga de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, os.tmpdir())
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.docx', '.xlsx', '.pptx', '.txt', '.svg', '.png', '.jpg', '.jpeg' ];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no soportado'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter

});

// Función para ejecutar el script de Python en el entorno virtual
function convertToPdf(inputFilePath) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const pythonPath = path.join(venvPath, isWindows ? 'Scripts' : 'bin', 'python');
    
    const pythonProcess = spawn(pythonPath, [pythonScriptPath, inputFilePath]);
    
    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(`Error en el script de Python (código ${code}): ${stderrData}`);
      } else {
        resolve(stdoutData.trim());
      }
    });
  });
}

// Controlador principal para la conversión
async function convertController(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ status: false, message: 'No se ha subido ningún archivo' });
    }
    
    
    const inputFilePath = req.file.path;
    const outputFilePath = await convertToPdf(inputFilePath);
    const directoryPath = path.dirname(outputFilePath);

    // Verificar si la ruta de salida es un directorio
    if (!fs.statSync(directoryPath).isDirectory()) {
      throw new Error(`La ruta de salida es un directorio: ${directoryPath}`);
    }
   
    
    // Verificar si el archivo existe
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`El archivo de salida no se encontró: ${directoryPath}`);
    }
    
    // Leer el archivo PDF convertido
    const pdfBuffer = fs.readFileSync(outputFilePath);

    // Eliminar los archivos temporales
    fs.unlinkSync(inputFilePath);
    fs.unlinkSync(outputFilePath);

    // Enviar el PDF como respuesta
    res.contentType('application/pdf');
    res.send(pdfBuffer);

  } catch (err) {
    console.error('Error durante la conversión:', err);
    res.status(500).json({ status: false, message: 'Error durante la conversión', error: err.message });
  }
}

module.exports = {
  convertController,
  upload
};