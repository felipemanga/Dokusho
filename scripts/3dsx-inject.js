// Add or replace files in a 3DSX
import { ThreeDSX } from '../data/utils/3dsx.js';

async function walkDir(dir) {
    const entries = await fs.listDir(dir);
    const result = [];
    for (const e of entries) {
        const fullPath = dir + '/' + e.name;
        if (e.isDirectory) {
            const sub = await walkDir(fullPath);
            for (const f of sub) result.push(f);
        } else if (e.isFile && !e.name.endsWith('~')) {
            result.push(fullPath);
        }
    }
    return result;
}

let threePath = null;
let sourcePath = null;
let dirPath = null;
let destPath = null;
let outputPath = null;
let help = false;

for (let i = 1; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') { help = true; break; }
    if (args[i] === '-o' || args[i] === '--output') {
        i++;
        outputPath = args[i];
        continue;
    }
    if (args[i] === '--as') {
        i++;
        destPath = args[i];
        continue;
    }
    if (args[i] === '--dir') {
        i++;
        dirPath = args[i];
        continue;
    }
    if (!args[i].startsWith('-')) {
        if (!threePath) threePath = args[i];
        else if (!sourcePath) sourcePath = args[i];
    }
}

if (help) {
    console.log('Usage:');
    console.log('  Single: DeltaAI --main scripts/3dsx-inject.js <file.3dsx> <source> [--as path/in/romfs] [-o output.3dsx]');
    console.log('  Batch:  DeltaAI --main scripts/3dsx-inject.js <file.3dsx> --dir <folder> [-o output.3dsx]');
    console.log('  --dir  Walk folder, inject all files (excludes *~)');
    console.log('  -o     Output 3DSX (default: overwrites input)');
    exit(0);
}

if (!threePath || (!sourcePath && !dirPath)) {
    console.error('Error: provide a source file or --dir path');
    exit(1);
}

if (!outputPath) outputPath = threePath;

try {
    const data = await fs.readFile(threePath, { binary: true });
    const three = ThreeDSX.decode(data, true);

    if (dirPath) {
        // Batch mode: walk directory
        const files = await walkDir(dirPath);
        let count = 0;
        let totalBytes = 0;
        for (const f of files) {
            const rel = f.substring(dirPath.length + 1);
            const fileData = await fs.readFile(f, { binary: true });
            three.files[rel] = fileData;
            console.log('  ' + rel + ' (' + fileData.length + 'B)');
            count++;
            totalBytes += fileData.length;
        }
        const encoded = three.encode();
        await fs.writeFile(outputPath, encoded);
        console.log('Injected ' + count + ' files (' + totalBytes + 'B) into ' + outputPath);
    } else {
        // Single file mode
        if (!destPath) destPath = sourcePath.substring(sourcePath.lastIndexOf('/') + 1);

        const fileData = await fs.readFile(sourcePath, { binary: true });
        three.files[destPath] = fileData;

        const encoded = three.encode();
        await fs.writeFile(outputPath, encoded);
        console.log('Injected: ' + sourcePath + ' -> ' + destPath + ' (' + fileData.length + 'B)');
    }

    exit(0);
} catch (e) {
    console.error('Error: ' + e);
    exit(1);
}
