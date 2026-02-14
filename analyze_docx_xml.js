const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const filePath = path.resolve('Pre Auth FORMAT (REL).docx');

if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
}

const zip = new AdmZip(filePath);
const zipEntries = zip.getEntries();

zipEntries.forEach(function (zipEntry) {
    if (zipEntry.entryName === 'word/document.xml') {
        const xmlContent = zipEntry.getData().toString('utf8');
        // Simple regex to extract text between tags to avoid printing huge XML
        const textParts = xmlContent.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
        if (textParts) {
            console.log(textParts.map(t => t.replace(/<[^>]+>/g, '')).join(' '));
        } else {
            console.log('No text found in document.xml');
        }
    }
});
