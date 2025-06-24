const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

async function convertSvgToPng(inputPath, outputPath, size) {
    try {
        const svgBuffer = await fs.readFile(inputPath);
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`Converted ${inputPath} to ${outputPath}`);
    } catch (error) {
        console.error(`Error converting ${inputPath}:`, error);
    }
}

async function convertIcons() {
    const sizes = [16, 48, 128];
    const iconsDir = path.join(__dirname, 'icons');
    
    for (const size of sizes) {
        const svgPath = path.join(iconsDir, `icon${size}.svg`);
        const pngPath = path.join(iconsDir, `icon${size}.png`);
        await convertSvgToPng(svgPath, pngPath, size);
    }
}

convertIcons().catch(console.error); 