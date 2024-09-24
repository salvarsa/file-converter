const officeParser = require('officeparser');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// const processOfficeFile = async (buffer, fileName) => {
//     try {
//         const data = await officeParser.parseOfficeAsync(buffer);
//         if (!data || typeof data.text !== 'string') {
//             throw new Error('El archivo no contiene texto extraíble o el formato no es compatible.');
//         }
//         return { fileName, content: data.text };
//     } catch (err) {
//         console.error("Error procesando archivo de Office:", err);
//         throw err;
//     }
// };

const processOfficeFile = async (buffer, fileName) => {
    try {
      const data = await officeParser.parseOfficeAsync(buffer);
      console.log("data------------------>", data);
      console.log("buffer------------------>", buffer);
      console.log("fileName------------------>", fileName);
  
      // Verificar si data existe y tiene propiedades
      if (!data) {
        throw new Error('El archivo no contiene contenido extraíble o el formato no es compatible.');
      }
  
      // Intentar extraer el texto de diferentes propiedades
      let content = '';
      if (typeof data === 'string') {
        content = data;
      } else if (typeof data.text === 'string') {
        content = data.text;
      } else if (data.value && typeof data.value === 'string') {
        content = data.value;
      } else if (Array.isArray(data.sheets)) {
        // Para archivos Excel
        content = data.sheets.map(sheet => sheet.data.join('\n')).join('\n\n');
      } else if (Array.isArray(data.slides)) {
        // Para archivos PowerPoint
        content = data.slides.map(slide => slide.text).join('\n\n');
      } else if (typeof data.getBody === 'function') {
        // Para algunos tipos de archivos Word
        content = data.getBody().getText();
      } else if (typeof data === 'object') {
        // Si data es un objeto, intentamos convertirlo a string
        content = JSON.stringify(data, null, 2);
      } else {
        // Si no podemos extraer el contenido, usaremos un mensaje genérico
        content = `No se pudo extraer el contenido de ${fileName} en un formato reconocible. Por favor, verifique el archivo.`;
      }
  
      if (content.trim() === '') {
        content = `El archivo ${fileName} parece estar vacío o su contenido no pudo ser extraído.`;
      }
  
      return { fileName, content };
    } catch (err) {
      console.error("=========err======", err);
      // En lugar de lanzar el error, retornamos un objeto con un mensaje de error
      return { fileName, content: `Error al procesar ${fileName}: ${err.message}` };
    }
  };
  
  
  const processTextFile = async (buffer, fileName) => {
    const textContent = buffer.toString('utf8');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    page.drawText(textContent);
    
    const pdfBytes = await pdfDoc.save();
    return { fileName: fileName.replace(/\.[^/.]+$/, ".pdf"), buffer: pdfBytes };
  }
  
  const convertToPdf = async (contentArray) => {
    const pdfDoc = await PDFDocument.create();
  
    for (const { content } of contentArray) {
      const page = pdfDoc.addPage();
      page.drawText(content);
    }
  
    return await pdfDoc.save();
  }
  
//   const convertFilesToPdf = async (files) => {
//     const pdfFiles = [];
  
//     for (let file of files) {
//       const fileExtension = file.originalname.split('.').pop().toLowerCase();
//       let pdfFile;
      
//       switch (fileExtension) {
//         case 'docx':
//           const docsData = await processOfficeFile(file.buffer, file.originalname)
//           const docsBfr = await convertToPdf([{ fileName: docsData.fileName, content: docsData.content }]);
//           pdfFile = { fileName: file.originalname.replace(/\.[^/.]+$/, ".pdf"), buffer: docsBfr };
//           break;
  
//         case 'xlsx':
//         case 'pptx':
//         case 'png':
//         case 'jpg':
//         case 'jpeg':
//         case 'txt':
//         default:
//           throw new Error(`Formato de archivo no soportado: ${file.originalname}`);
//       }
  
//       pdfFiles.push(pdfFile);
//     }
  
//     return pdfFiles;
//   }


const convertFilesToPdf = async (files) => {
  const pdfFiles = [];

  for (let file of files) {
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    let pdfFile;
    
    try {
      switch (fileExtension) {
        case 'docx':
        case 'xlsx':
        case 'pptx':
          const officeData = await processOfficeFile(file.buffer, file.originalname);
          const officePdf = await convertToPdf([{ fileName: officeData.fileName, content: officeData.content }]);
          pdfFile = { fileName: file.originalname.replace(/\.[^/.]+$/, ".pdf"), buffer: officePdf };
          break;

        case 'txt':
          const textContent = file.buffer.toString('utf8');
          const textPdf = await convertToPdf([{ fileName: file.originalname, content: textContent }]);
          pdfFile = { fileName: file.originalname.replace(/\.[^/.]+$/, ".pdf"), buffer: textPdf };
          break;

        case 'png':
        case 'jpg':
        case 'jpeg':
          const img = await sharp(file.buffer).toBuffer();
          const imagePdfDoc = await PDFDocument.create();
          const page = imagePdfDoc.addPage();
          const image = await imagePdfDoc.embedPng(img);
          const { width, height } = image.scale(0.5);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: page.getWidth(),
            height: page.getHeight(),
            fit: { width: page.getWidth(), height: page.getHeight() },
          });
          const imagePdfBuffer = await imagePdfDoc.save();
          pdfFile = { fileName: file.originalname.replace(/\.[^/.]+$/, ".pdf"), buffer: imagePdfBuffer };
          break;

        default:
          throw new Error(`Formato de archivo no soportado: ${file.originalname}`);
      }

      pdfFiles.push(pdfFile);
    } catch (error) {
      console.error(`Error al procesar el archivo ${file.originalname}:`, error);
      // Opcionalmente, puedes decidir si quieres continuar con los demás archivos o detener el proceso
      // throw error; // Descomenta esta línea si quieres que el proceso se detenga al encontrar un error
    }
  }

  return pdfFiles;
};
  
//   const fileConverter = async(req, res) => {
//     try {
//       const files = req.files;
      
  
//       if (!files || files.length === 0) {
//         return res.status(400).json({ error: { name: error.name, message: error.message }});
//       }
  
//       const convertedFiles = await convertFilesToPdf(files);
  
//       const outputDir = req.app.get('convertedFilesDir');
//       await fs.mkdir(outputDir, { recursive: true });
  
//       const savedFiles = await Promise.all(convertedFiles.map(async (file) => {
//         const filePath = path.join(outputDir, file.fileName);
//         await fs.writeFile(filePath, file.buffer);
//         return { fileName: file.fileName, path: filePath };
//       }));
  
  
//       res.status(201).json({
//         code: 201,
//         status: true,
//         message: "Archivos convertidos a PDF correctamente",
//         data: savedFiles,
//       });
//     } catch (err) {
//       console.error("Error en la conversión:", err);
//       res.status(500).json({
//         code: 500,
//         status: false,
//         message: "Error al convertir archivos",
//         error: err.message,
//       });
//     }
//   }

const fileConverter = async (req, res) => {
    try {
      const files = req.files;
  
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No se proporcionaron archivos para convertir" });
      }
  
      const convertedFiles = await convertFilesToPdf(files);
  
      // Asegúrate de que 'convertedFilesDir' esté definido en tu aplicación
      const outputDir = req.app.get('convertedFilesDir') || path.join(__dirname, '../converted_files');
      await fs.mkdir(outputDir, { recursive: true });
  
      const savedFiles = await Promise.all(convertedFiles.map(async (file) => {
        const filePath = path.join(outputDir, file.fileName);
        await fs.writeFile(filePath, file.buffer);
        return { fileName: file.fileName, path: filePath };
      }));
  
      res.status(201).json({
        code: 201,
        status: true,
        message: "Archivos convertidos a PDF correctamente",
        data: savedFiles,
      });
    } catch (err) {
      console.error("Error en la conversión:", err);
      res.status(500).json({
        code: 500,
        status: false,
        message: "Error al convertir archivos",
        error: err.message,
      });
    }
  };
  
  module.exports = fileConverter;