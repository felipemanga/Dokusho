async function main() {
    let binaryPath = settings.embedBinary || args[0];
    let outputPath = settings.embedOutput || './DeltaAI.embedded';
    let dataRoot = settings.embedDataRoot || 'data';
    let tmpZip = settings.embedTempZip || './.embed-data.zip';
    let help = false;
    let flag;

    args.forEach((arg, i) => {
        if (i === 0) return; // skip script name

        if (arg === '--help' || arg === '-h') {
            help = true;
            return;
        }

        if (arg === '--main') {
            // ignore, for compatibility with DeltaAI's --main arg
            return;
        }

        if (arg.startsWith('--binary=')) {
            binaryPath = arg.substring('--binary='.length);
            return;
        } else if (arg === '--binary') {
            flag = 'binary';
            return;
        }

        if (arg.startsWith('--output=')) {
            outputPath = arg.substring('--output='.length);
            return;
        } else if (arg === '--output' || arg === '-o') {
            flag = 'output';
            return;
        }

        if (arg.startsWith('--data=')) {
            dataRoot = arg.substring('--data='.length);
            return;
        } else if (arg === '--data' || arg === '-i') {
            flag = 'data';
            return;
        }

        if (arg.startsWith('--temp-zip=')) {
            tmpZip = arg.substring('--temp-zip='.length);
            return;
        } else if (arg === '--temp-zip') {
            flag = 'temp-zip';
            return;
        }

        if (flag === 'binary') {
            binaryPath = arg;
            flag = null;
            return;
        }
        if (flag === 'output') {
            outputPath = arg;
            flag = null;
            return;
        }
        if (flag === 'data') {
            dataRoot = arg;
            flag = null;
            return;
        }
        if (flag === 'temp-zip') {
            tmpZip = arg;
            flag = null;
            return;
        }

        help = true;
    });

    if (help) {
        console.log('Usage: DeltaAI embedDataIntoBinary.js [options]');
        console.log('Options:');
        console.log('  --binary=PATH       Path to the input binary (default: ./DeltaAI)');
        console.log('  --output=PATH       Path to the output embedded binary (default: ./DeltaAI.embedded)');
        console.log('  --data=DIR          Directory containing data to embed (default: data)');
        console.log('  --temp-zip=PATH     Temporary path for created zip file (default: ./.embed-data.zip)');
        console.log('  -h, --help          Show this help message');
        exit(0);
        return;
    }

    console.log(`Embedding ${dataRoot} into ${outputPath}...`);

    const zipResult = await fs.compress(tmpZip, { zippedPaths: [dataRoot] });
    if (!zipResult || zipResult.error) {
        throw new Error((zipResult && zipResult.error) || 'Failed to create data zip');
    }
    console.log(`Created zip with ${zipResult.files} files`);

    const binStat = await fs.stat(binaryPath);
    const zipStat = await fs.stat(tmpZip);
    if (!binStat || !zipStat) {
        throw new Error('Failed to stat binary or temp zip');
    }
    const zipOffset = BigInt(binStat.size);
    const zipSize = BigInt(zipStat.size);

    function le64Bytes(value) {
        let v = BigInt(value);
        const out = [];
        for (let i = 0; i < 8; i++) {
            out.push(Number(v & 0xffn));
            v >>= 8n;
        }
        return out;
    }

    const footerBytes = [
        0x44, 0x41, 0x49, 0x5a, 0x49, 0x50, 0x30, 0x31,
        ...le64Bytes(zipOffset),
        ...le64Bytes(zipSize)
    ];
    await fs.copyFile(binaryPath, outputPath);
    await fs.copyFile(tmpZip, outputPath, true);
    const outFile = fs.open(outputPath, 'ab');
    if (!outFile) {
        throw new Error(`Failed to open output file for footer append: ${outputPath}`);
    }
    const wrote = outFile.writeBytes(footerBytes);
    outFile.close();
    if (wrote !== footerBytes.length) {
        throw new Error(`Failed to append full footer: expected ${footerBytes.length}, wrote ${wrote}`);
    }
    await fs.chmod(outputPath, 0o755);
    try {
        await fs.deleteFile(tmpZip);
    } catch (e) {
        // ignore if already deleted or doesn't exist
    }

    console.log(`Embedded zip offset: ${zipOffset}`);
    console.log(`Embedded zip size: ${zipSize}`);
    console.log('Done');
    exit();
}

main().catch(err => {
    console.error('embedDataIntoBinary failed:', err + '');
    console.error(err.stack + '');
    exit(1);
});
