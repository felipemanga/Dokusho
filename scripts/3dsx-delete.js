// Delete file(s) from a 3DSX
import { ThreeDSX } from '../data/utils/3dsx.js';

let threePath = null;
let pattern = null;
let outputPath = null;
let regex = false;
let help = false;

for (let i = 1; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') { help = true; break; }
    if (args[i] === '-o' || args[i] === '--output') { i++; outputPath = args[i]; continue; }
    if (args[i] === '-r' || args[i] === '--regex') { regex = true; continue; }
    if (!args[i].startsWith('-')) {
        if (!threePath) threePath = args[i];
        else if (!pattern) pattern = args[i];
    }
}

if (help || !threePath || !pattern) {
    console.log('Usage: DeltaAI --main scripts/3dsx-delete.js <file.3dsx> <pattern> [-o output.3dsx] [-r]');
    console.log('  -r  Treat pattern as regex (deletes all matching files)');
    console.log('  -o  Output 3DSX (default: overwrites input)');
    exit(help ? 0 : 1);
}

if (!outputPath) outputPath = threePath;

try {
    const data = await fs.readFile(threePath, { binary: true });
    const three = ThreeDSX.decode(data, true);

    const allKeys = Object.keys(three.files);
    let matches;
    if (regex) {
        const re = new RegExp(pattern);
        matches = allKeys.filter(p => re.test(p));
    } else {
        matches = three.files[pattern] ? [pattern] : [];
    }

    if (matches.length === 0) {
        console.error('No files matched: ' + pattern);
        exit(1);
    }

    for (const key of matches) {
        delete three.files[key];
        console.log('Deleted: ' + key);
    }

    const encoded = three.encode();
    const wrote = await fs.writeFile(outputPath, encoded);
    console.log(matches.length + ' file' + (matches.length > 1 ? 's' : '') + ' removed');
    console.log('Written: ' + outputPath + ' (' + encoded.length + 'B, was ' + data.length + 'B)');
    exit(0);
} catch (e) {
    console.error('Error: ' + e);
    exit(1);
}
