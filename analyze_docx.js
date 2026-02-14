const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

const filePath = path.resolve('Pre Auth FORMAT (REL).docx');

if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'binary');
const zip = new PizZip(content);
const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
});

const text = doc.getFullText();
console.log('--- EXTRACTED TEXT START ---');
console.log(text);
console.log('--- EXTRACTED TEXT END ---');
