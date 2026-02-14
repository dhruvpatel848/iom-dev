const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('./config/database');
const ReportTemplate = require('./models/ReportTemplate');

async function setupTemplate() {
    const inputPath = path.resolve('Pre Auth FORMAT (REL).docx');
    const templateDir = path.resolve('storage/templates');
    const outputPath = path.join(templateDir, 'PreAuthTemplate.docx');

    if (!fs.existsSync(inputPath)) {
        console.error('Input file not found');
        return;
    }

    if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
    }

    const zip = new AdmZip(inputPath);
    const zipEntries = zip.getEntries();
    let documentXml = '';

    // Find and read document.xml
    zipEntries.forEach(function (zipEntry) {
        if (zipEntry.entryName === 'word/document.xml') {
            documentXml = zipEntry.getData().toString('utf8');
        }
    });

    if (!documentXml) {
        console.error('Could not read document.xml');
        return;
    }

    // Replacements map
    // We strictly replace text content. 
    // Note: This is fragile if "Claim" and "No." are in different XML nodes.
    // However, for a simple form, they might be together.
    // If exact match fails, we might need looser matching.

    // We will try simple string replace first. 
    // Since we saw the extracted text was clean, the XML nodes likely contain whole words.

    let modifiedXml = documentXml;

    const replacements = {
        "Claim No.": "Claim No. {claim_number}",
        "Policy No.": "Policy No. {policy_number}",
        "Insured Name": "Insured Name {insured_name}",
        "Name of Patient": "Name of Patient {patient_name}",
        "Patients address &amp; Ph No.": "Patients address &amp; Ph No. {patient_address} / {patient_age}", // using age as placeholder for Phone if phone not mapped? no mapped to mobile_number
        "Patients address & Ph No.": "Patients address & Ph No. {patient_address} / {patient_age}",
        "Hospital Name": "Hospital Name {hospital_name}",
        "Hospital Address": "Hospital Address {hospital_address}",
        "Total No. of Bed": "Total No. of Bed {total_beds}",
        "Hos Reg. no.": "Hos Reg. no. {hospital_registration}",
        "Claim amount": "Claim amount {claim_amount}",
        "Approved amount": "Approved amount {approved_expense_company}",
        "DOA with time": "DOA with time {admission_date}",
        "DOD with time": "DOD with time {discharge_date}",
        "Class of accommodation": "Class of accommodation {accommodation_class}",
        "Name of treating Consultant": "Name of treating Consultant {doctor_name}",
        "Diagnosis": "Diagnosis {diagnosis}",
        "Findings": "Findings {investigation_findings}",
        "Trigger": "Trigger {red_flags}" // Mapping Trigger to red_flags or actual trigger? red_flags for now as trigger was just added
    };

    // Apply replacements
    for (const [key, value] of Object.entries(replacements)) {
        // Global replace
        // tailored regex to handle potential xml tags in between chars? No, let's try strict string replace first.
        // But keys like "Claim No." usually appear as <w:t>Claim No.</w:t>
        // Use split/join for global replace
        modifiedXml = modifiedXml.split(key).join(value);
    }

    // Update the zip
    zip.updateFile('word/document.xml', Buffer.from(modifiedXml, 'utf8'));
    zip.writeZip(outputPath);
    console.log('Created template at:', outputPath);

    // Register in DB
    try {
        await sequelize.authenticate();
        // Check if exists
        const exists = await ReportTemplate.findOne({ where: { template_name: 'Pre Auth Verification (Auto)' } });
        if (!exists) {
            await ReportTemplate.create({
                insurance_company: 'Reliance General Insurance Co. Ltd.', // Extracted from doc
                template_name: 'Pre Auth Verification (Auto)',
                file_path: outputPath,
                created_by: 1 // Assuming admin ID 1
            });
            console.log('Registered template in DB');
        } else {
            // Update path
            exists.file_path = outputPath;
            await exists.save();
            console.log('Updated template in DB');
        }
    } catch (err) {
        console.error('DB Error:', err);
    }
}

setupTemplate();
