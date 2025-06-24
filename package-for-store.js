#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Packaging Gloco extension for Chrome Web Store...\n');

// Files to include in the package
const filesToInclude = [
    'manifest.json',
    'background.js',
    'content.js',
    'content.css',
    'popup.html',
    'popup.js',
    'popup.css',
    'icons/'
];

// Files to exclude
const filesToExclude = [
    'package.json',
    'package-lock.json',
    'convert_icons.js',
    'store-submission-details.md',
    'privacy-policy.md',
    'package-for-store.js',
    'node_modules/',
    '.git/',
    '.DS_Store',
    'gloco-extension.zip'
];

// Create a temporary directory for packaging
const tempDir = 'temp-package';
const outputZip = 'gloco-extension.zip';

try {
    // Clean up any existing temp directory
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });
    
    console.log('📋 Copying extension files...');
    
    // Copy files to temp directory
    filesToInclude.forEach(file => {
        const sourcePath = path.join('.', file);
        const destPath = path.join(tempDir, file);
        
        if (fs.existsSync(sourcePath)) {
            const stat = fs.statSync(sourcePath);
            
            if (stat.isDirectory()) {
                // Copy directory recursively
                fs.mkdirSync(destPath, { recursive: true });
                const files = fs.readdirSync(sourcePath);
                files.forEach(f => {
                    if (!filesToExclude.some(exclude => f.includes(exclude.replace('/', '')))) {
                        fs.copyFileSync(
                            path.join(sourcePath, f), 
                            path.join(destPath, f)
                        );
                    }
                });
                console.log(`  ✅ Copied directory: ${file}`);
            } else {
                // Copy file
                fs.copyFileSync(sourcePath, destPath);
                console.log(`  ✅ Copied file: ${file}`);
            }
        } else {
            console.log(`  ⚠️  File not found: ${file}`);
        }
    });
    
    // Remove existing zip if it exists
    if (fs.existsSync(outputZip)) {
        fs.unlinkSync(outputZip);
    }
    
    console.log('\n🗜️  Creating ZIP package...');
    
    // Create ZIP file
    process.chdir(tempDir);
    execSync(`zip -r ../${outputZip} ./*`, { stdio: 'inherit' });
    process.chdir('..');
    
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Get file size
    const stats = fs.statSync(outputZip);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n🎉 Package created successfully!');
    console.log(`📦 File: ${outputZip}`);
    console.log(`📏 Size: ${fileSizeInMB} MB`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Go to https://chrome.google.com/webstore/devconsole/');
    console.log('2. Click "New Item" and upload gloco-extension.zip');
    console.log('3. Fill in the store listing details from store-submission-details.md');
    console.log('4. Add screenshots and promotional images');
    console.log('5. Submit for review');
    
    console.log('\n💡 Tips:');
    console.log('- Review process typically takes 1-3 business days');
    console.log('- Make sure to test the extension thoroughly before submission');
    console.log('- Have promotional images ready (see store-submission-details.md)');
    
} catch (error) {
    console.error('❌ Error packaging extension:', error.message);
    
    // Clean up on error
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    process.exit(1);
} 