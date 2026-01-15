import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read font files
const regularFont = fs.readFileSync(path.join(__dirname, '../public/fonts/Sarabun-Regular.ttf'));
const boldFont = fs.readFileSync(path.join(__dirname, '../public/fonts/Sarabun-Bold.ttf'));

// Convert to base64
const regularBase64 = regularFont.toString('base64');
const boldBase64 = boldFont.toString('base64');

// Create VFS content
const vfsContent = `// Auto-generated VFS fonts for pdfmake
// Generated on ${new Date().toISOString()}

const pdfMakeFonts = {
  'Sarabun-Regular.ttf': '${regularBase64}',
  'Sarabun-Bold.ttf': '${boldBase64}'
};

export default pdfMakeFonts;
`;

// Ensure directory exists
const outputDir = path.join(__dirname, '../src/utils');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Write to file
const outputPath = path.join(outputDir, 'vfs_fonts.ts');
fs.writeFileSync(outputPath, vfsContent);

console.log('✅ VFS fonts file generated successfully');
console.log('📁 Output:', outputPath);
console.log('📊 Font sizes:');
console.log('   - Sarabun-Regular.ttf:', regularFont.length, 'bytes');
console.log('   - Sarabun-Bold.ttf:', boldFont.length, 'bytes');
