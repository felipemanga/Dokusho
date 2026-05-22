// Extract file(s) from a 3DSX
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
    console.log('Usage: DeltaAI --main scripts/3dsx-extract.js <file.3dsx> <pattern> [-o dir] [-r]');
    console.log('  -r  Treat pattern as regex (matches all files)');
    console.log('  -o  Output directory (default: current directory)');
    exit(help ? 0 : 1);
}

try {
    const data = await fs.readFile(threePath, { binary: true });
    const three = ThreeDSX.decode(data, true);

    let matches;
    if (regex) {
        const re = new RegExp(pattern);
        matches = Object.keys(three.files).filter(p => re.test(p));
    } else {
        matches = three.files[pattern] ? [pattern] : [];
    }

    if (matches.length === 0) {
        console.error('No files matched: ' + pattern);
        exit(1);
    }

    const outDir = outputPath || '.';
    let count = 0;
    for (const key of matches.sort()) {
        const outPath = outDir + '/' + key;
        const wrote = await fs.writeFile(outPath, three.files[key]);
        console.log('Extracted: ' + key + ' (' + three.files[key].length + 'B)');
        count++;
    }
    console.log(count + ' file' + (count > 1 ? 's' : '') + ' extracted');
    exit(0);
} catch (e) {
    console.error('Error: ' + e);
    exit(1);
}
