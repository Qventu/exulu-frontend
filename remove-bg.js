const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const API_KEY = process.env.PHOTOROOM_API_KEY || "sk_pr_default_a33a0ab352b7ec833b58da700b9e6138d6d35b21";
const TINYPNG_API_KEY = "vF5yRvMnyxYxTXtBsCS2pZXgh5NY4Twz";

if (API_KEY === "YOUR_API_KEY") {
    console.log("❌ Please set your PHOTOROOM_API_KEY environment variable");
    process.exit(1);
}

async function removeBackground(base64Data) {
    return new Promise((resolve, reject) => {
        // Remove the data:image/jpeg;base64, prefix if present
        const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(cleanBase64, 'base64');
        
        // Create boundary for multipart form data
        const boundary = `----${crypto.randomUUID().replace(/-/g, '')}`;
        const CRLF = '\r\n';
        
        // Build multipart form data
        const formData = [
            `--${boundary}${CRLF}`,
            `Content-Disposition: form-data; name="image_file"; filename="image.jpg"${CRLF}`,
            `Content-Type: image/jpeg${CRLF}${CRLF}`
        ].join('');
        
        const endBoundary = `${CRLF}--${boundary}--${CRLF}`;
        
        const body = Buffer.concat([
            Buffer.from(formData, 'utf8'),
            imageBuffer,
            Buffer.from(endBoundary, 'utf8')
        ]);
        
        const options = {
            hostname: 'sdk.photoroom.com',
            path: '/v1/segment',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'x-api-key': API_KEY,
                'Content-Length': body.length
            }
        };
        
        const req = https.request(options, (res) => {
            let data = [];
            
            res.on('data', (chunk) => {
                data.push(chunk);
            });
            
            res.on('end', () => {
                const responseBuffer = Buffer.concat(data);
                
                if (res.statusCode === 200) {
                    // Convert PNG buffer to base64
                    const pngBase64 = `data:image/png;base64,${responseBuffer.toString('base64')}`;
                    resolve(pngBase64);
                } else {
                    reject(new Error(`API Error: ${res.statusCode} ${res.statusMessage} - ${responseBuffer.toString()}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(body);
        req.end();
    });
}

async function compressPng(base64Data) {
    return new Promise((resolve, reject) => {
        // Remove the data:image/png;base64, prefix if present
        const cleanBase64 = base64Data.replace(/^data:image\/png;base64,/, '');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(cleanBase64, 'base64');
        
        const options = {
            hostname: 'api.tinify.com',
            path: '/shrink',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`api:${TINYPNG_API_KEY}`).toString('base64')}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': imageBuffer.length
            }
        };
        
        const req = https.request(options, (res) => {
            let data = [];
            
            res.on('data', (chunk) => {
                data.push(chunk);
            });
            
            res.on('end', () => {
                const responseBuffer = Buffer.concat(data);
                
                if (res.statusCode === 201) {
                    const response = JSON.parse(responseBuffer.toString());
                    const outputLocation = res.headers.location;
                    
                    // Download the compressed image
                    const downloadOptions = {
                        hostname: 'api.tinify.com',
                        path: outputLocation.replace('https://api.tinify.com', ''),
                        method: 'GET',
                        headers: {
                            'Authorization': `Basic ${Buffer.from(`api:${TINYPNG_API_KEY}`).toString('base64')}`
                        }
                    };
                    
                    const downloadReq = https.request(downloadOptions, (downloadRes) => {
                        let downloadData = [];
                        
                        downloadRes.on('data', (chunk) => {
                            downloadData.push(chunk);
                        });
                        
                        downloadRes.on('end', () => {
                            const compressedBuffer = Buffer.concat(downloadData);
                            
                            if (downloadRes.statusCode === 200) {
                                // Convert compressed PNG buffer to base64
                                const compressedBase64 = `data:image/png;base64,${compressedBuffer.toString('base64')}`;
                                resolve(compressedBase64);
                            } else {
                                reject(new Error(`TinyPNG Download Error: ${downloadRes.statusCode} ${downloadRes.statusMessage}`));
                            }
                        });
                    });
                    
                    downloadReq.on('error', (error) => {
                        reject(error);
                    });
                    
                    downloadReq.end();
                } else {
                    reject(new Error(`TinyPNG API Error: ${res.statusCode} ${res.statusMessage} - ${responseBuffer.toString()}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(imageBuffer);
        req.end();
    });
}

async function processLottieFile(filePath) {
    console.log(`📖 Reading ${filePath}...`);
    
    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!jsonData.assets || !Array.isArray(jsonData.assets)) {
        console.log("❌ No assets array found in the file");
        return;
    }
    
    console.log(`🔍 Found ${jsonData.assets.length} assets to process`);
    
    // Process each asset
    for (let i = 0; i < jsonData.assets.length; i++) {
        const asset = jsonData.assets[i];
        
        if (asset.p && asset.p.startsWith('data:image/jpeg;base64,')) {
            console.log(`🔄 Processing asset ${i + 1}/${jsonData.assets.length} (${asset.id || 'unnamed'})...`);
            
            try {
                // Remove background and get PNG
                console.log(`🔄 Removing background for asset ${i + 1}/${jsonData.assets.length}...`);
                const pngBase64 = await removeBackground(asset.p);
                
                // Compress the PNG
                console.log(`🗜️  Compressing PNG for asset ${i + 1}/${jsonData.assets.length}...`);
                const compressedPngBase64 = await compressPng(pngBase64);
                
                // Update the asset with the compressed PNG data
                jsonData.assets[i].p = compressedPngBase64;
                
                console.log(`✅ Processed and compressed asset ${i + 1}/${jsonData.assets.length}`);
                
                // Add a small delay to avoid overwhelming the APIs
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`❌ Failed to process asset ${i + 1}: ${error.message}`);
            }
        } else {
            console.log(`⏭️  Skipping asset ${i + 1} (not a JPEG base64 image)`);
        }
    }
    
    // Create backup of original file
    const backupPath = filePath.replace('.json', '.backup.json');
    fs.copyFileSync(filePath, backupPath);
    console.log(`💾 Created backup: ${backupPath}`);
    
    // Write updated JSON back to file
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
    console.log(`✅ Updated ${filePath} with background-removed and compressed images`);
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log("Usage: node remove-bg.js [file1.json] [file2.json] ...");
        console.log("Or run without arguments to process both default files:");
        console.log("  node remove-bg.js");
        return;
    }
    
    // If no files specified, process default files
    let filesToProcess = args;
    if (args.length === 0) {
        filesToProcess = [
            './public/agent-idle.json',
            './public/agent-responding.json'
        ];
    }
    
    // Validate API key
    if (!API_KEY || API_KEY === "YOUR_API_KEY") {
        console.log("❌ Please set your PHOTOROOM_API_KEY environment variable");
        console.log("Example: PHOTOROOM_API_KEY=your_actual_key node remove-bg.js");
        return;
    }
    
    // Process each file
    for (const filePath of filesToProcess) {
        if (!fs.existsSync(filePath)) {
            console.log(`❌ File not found: ${filePath}`);
            continue;
        }
        
        try {
            await processLottieFile(filePath);
            console.log(`🎉 Completed processing ${filePath}\n`);
        } catch (error) {
            console.log(`❌ Error processing ${filePath}: ${error.message}\n`);
        }
    }
    
    console.log("🏁 All files processed!");
}

// Run the script
main().catch(console.error);