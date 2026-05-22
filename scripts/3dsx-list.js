// List files in a 3DSX
import { ThreeDSX } from '../data/utils/3dsx.js';

let path = null;
let help = false;

for (let i = 1; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') { help = true; break; }
    if (!args[i].startsWith('-')) path = args[i];
}

if (help || !path) {
    console.log('Usage: DeltaAI --main scripts/3dsx-list.js <file.3dsx>');
    exit(help ? 0 : 1);
}

try {
    const data = await fs.readFile(path, { binary: true });
    const three = ThreeDSX.decode(data, true);

    console.log('\nSMDH: ' + three.smdh.length + 'B');
    console.log('Segments: code=' + three.header.codeSegSize + ' rodata=' + three.header.rodataSegSize + ' data=' + three.header.dataSegSize);
    console.log('\nDirectories (' + three.directories.length + '):');
    for (const d of three.directories) {
        console.log('  ' + (d === '' ? '/' : d));
    }

    console.log('\nFiles (' + Object.keys(three.files).length + '):');
    let totalSize = 0;
    const paths = Object.keys(three.files).sort();
    for (const p of paths) {
        const sz = three.files[p].length;
        totalSize += sz;
        const pad = ' '.repeat(Math.max(1, 10 - sz.toString().length));
        console.log('  ' + pad + sz + 'B  ' + p);
    }
    console.log('\nTotal: ' + totalSize + 'B');
    exit(0);
} catch (e) {
    console.error('Error: ' + e);
    exit(1);
}
