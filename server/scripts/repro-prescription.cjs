require('dotenv').config();
const { readFileSync } = require('node:fs');
const { extractPrescription } = require('../dist/ai/aiService.js');
const { validatePrescriptionUpload } = require('../dist/ai/uploadValidation.js');

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error('Pass the prescription image path as the first argument.');
  const bytes = readFileSync(file);
  const base64 = bytes.toString('base64');
  const checked = validatePrescriptionUpload('image/png', base64);
  if (!checked.valid) throw new Error('The supplied file does not pass PNG upload validation.');
  console.log(`Image accepted (${bytes.length} bytes); calling configured vision model.`);
  const result = await extractPrescription(base64, 'image/png');
  if (!result.drafts) {
    console.log(`Extraction failed: ${result.reason ?? 'PROVIDER_ERROR'}${result.statusCode ? ` (HTTP ${result.statusCode})` : ''}.`);
  } else {
    const completeness = result.drafts.map((draft) => ({ hasName: Boolean(draft.name), hasDose: Boolean(draft.dosage), hasFrequency: Boolean(draft.frequency), timingCount: draft.times.length }));
    console.log(`Extraction succeeded: ${result.drafts.length} medicine drafts.`);
    console.log('Field completeness only:', JSON.stringify(completeness));
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Diagnostic failed.');
  process.exitCode = 1;
});
