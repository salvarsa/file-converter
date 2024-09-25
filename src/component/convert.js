const officeParser = require('officeparser');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');


const processOfficeFile = async (buffer, fileName) => {
    try {
      const data = await officeParser.parseOfficeAsync(buffer);
      console.log("data------------------>", data);
      console.log("buffer------------------>", buffer);
      console.log("fileName------------------>", fileName);
  
      if (!data) {
        throw new Error('El archivo no contiene contenido extraíble o el formato no es compatible.');
      }
  
      // Intentar extraer el texto de diferentes propiedades
      let content = '';
      if (typeof data === 'string') {
        content = data;
        console.log('------data-------->',data);
      } 
      
      else if (typeof data.text === 'string') {
        content += data.text;
        console.log('------data.text-------->',data.text);
      }
      
      else if (data.value && typeof data.value === 'string') {
        content = data.value;
        console.log('------data.value-------->',data.value);
      }
      
      else if (data.tables && data.tables.length > 0) {
        content = data.tables
        data.tables.forEach((table, index) => {
          content += `Tabla ${index + 1}:\n`;
          table.forEach((row) => {
            content += row.join(' | ') + '\n'; // Simulamos la representación de tablas
          });
          content += '\n';
        });
      }
  
        else if (Array.isArray(data.slides)) {
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
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  
    let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 12;
  const margin = 50;
  let yPosition = height - margin;

  for (const { content } of contentArray) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (yPosition < margin) {
        page = pdfDoc.addPage();  // Añadimos una nueva página si se llena
        yPosition = height - margin;
      }
      page.drawText(line, {
        x: margin,
        y: yPosition,
        size: fontSize,
        font: timesRomanFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= fontSize * 1.2;
    }
  }

  return await pdfDoc.save();
};

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
          const fileData = await processOfficeFile(file.buffer, file.originalname);
          const pdfBuffer = await convertToPdf([{ content: fileData.content }]);
          pdfFile = { fileName: file.originalname.replace(/\.[^/.]+$/, ".pdf"), buffer: pdfBuffer };
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
    }
  }

  return pdfFiles;
};
  

const fileConverter = async (req, res) => {
    try {
      const files = req.files;
  
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No se proporcionaron archivos para convertir" });
      }
  
      const convertedFiles = await convertFilesToPdf(files);
  
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