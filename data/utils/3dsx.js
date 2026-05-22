// 3DSX file format encoder/decoder
// Decodes to/from an object containing:
//   - header: { magic, headerSize, relocHdrSize, formatVer, flags,
//               codeSegSize, rodataSegSize, dataSegSize, bssSize,
//               smdhOffset, smdhSize, fsOffset }
//   - segments: { code: Uint8Array, rodata: Uint8Array, data: Uint8Array }
//   - smdh: Uint8Array (raw SMDH bytes)
//   - files: { path: Uint8Array, ... }
//   - directories: [path, ...]

export class ThreeDSX {
    // ============================================================
    // Constants
    // ============================================================
    static MAGIC = 0x58534433; // '3DSX'
    static HEADER_SIZE = 44;
    static NUM_SEGMENTS = 3;

    // ============================================================
    // Constructor
    // ============================================================
    constructor() {
        this.header = {
            magic: ThreeDSX.MAGIC,
            headerSize: ThreeDSX.HEADER_SIZE,
            relocHdrSize: 8,
            formatVer: 0,
            flags: 0,
            codeSegSize: 0,
            rodataSegSize: 0,
            dataSegSize: 0,
            bssSize: 0,
            smdhOffset: 0,
            smdhSize: 0,
            fsOffset: 0,
        };
        this.segments = { code: new Uint8Array(0), rodata: new Uint8Array(0), data: new Uint8Array(0) };
        this.smdh = new Uint8Array(0);
        this.relocData = new Uint8Array(0); // relocation counts + entries (passthrough)
        this.files = {}; // path -> Uint8Array
        this.directories = []; // directory paths (for ordering)
    }

    // ============================================================
    // Decode
    // ============================================================
    static decode(data, quiet) {
        const result = new ThreeDSX();
        result._quiet = quiet;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        // Parse header
        const h = result.header;
        h.magic = view.getUint32(0, true);
        h.headerSize = view.getUint16(4, true);
        h.relocHdrSize = view.getUint16(6, true);
        h.formatVer = view.getUint32(8, true);
        h.flags = view.getUint32(12, true);
        h.codeSegSize = view.getUint32(16, true);
        h.rodataSegSize = view.getUint32(20, true);
        h.dataSegSize = view.getUint32(24, true);
        h.bssSize = view.getUint32(28, true);
        h.smdhOffset = view.getUint32(32, true);
        h.smdhSize = view.getUint32(36, true);
        h.fsOffset = view.getUint32(40, true);

        if (!result._quiet)
            console.log('3DSX header: code=' + h.codeSegSize + ' rodata=' + h.rodataSegSize +
            ' data=' + h.dataSegSize + ' bss=' + h.bssSize +
            ' smdh@' + h.smdhOffset + '(' + h.smdhSize + ') fs@' + h.fsOffset);

        // Extract relocation data (counts + entries)
        const relocCountsSize = ThreeDSX.NUM_SEGMENTS * h.relocHdrSize;
        const segmentsStart = h.headerSize + relocCountsSize;
        const dataNonBss = h.dataSegSize - h.bssSize;
        const segmentsEnd = segmentsStart + h.codeSegSize + h.rodataSegSize + dataNonBss;

        // Relocation entries sit between segments end and SMDH
        const relocEntriesStart = segmentsEnd;
        const relocEntriesEnd = h.smdhOffset > 0 ? h.smdhOffset : h.fsOffset > 0 ? h.fsOffset : data.byteLength;
        const relocDataSize = relocCountsSize + (relocEntriesEnd - relocEntriesStart);
        result.relocData = new Uint8Array(relocDataSize);
        // Copy relocation counts
        result.relocData.set(data.subarray(h.headerSize, h.headerSize + relocCountsSize), 0);
        // Copy relocation entries
        if (relocEntriesEnd > relocEntriesStart) {
            result.relocData.set(data.subarray(relocEntriesStart, relocEntriesEnd), relocCountsSize);
        }

        // Extract segments
        let off = segmentsStart;
        result.segments.code = data.subarray(off, off + h.codeSegSize);
        off += h.codeSegSize;
        result.segments.rodata = data.subarray(off, off + h.rodataSegSize);
        off += h.rodataSegSize;
        result.segments.data = dataNonBss > 0 ? data.subarray(off, off + dataNonBss) : new Uint8Array(0);

        // Extract SMDH
        if (h.smdhOffset > 0 && h.smdhSize > 0) {
            result.smdh = data.subarray(h.smdhOffset, h.smdhOffset + h.smdhSize);
        }

        // Extract ROMFS
        if (h.fsOffset > 0 && h.fsOffset < data.byteLength) {
            const romfsData = data.subarray(h.fsOffset);
            result._parseRomfs(romfsData);
        }

        return result;
    }

    // ============================================================
    // Encode
    // ============================================================
    encode() {
        const h = this.header;

        // Calculate layout
        const relocCountsSize = ThreeDSX.NUM_SEGMENTS * h.relocHdrSize;
        const dataNonBss = h.dataSegSize - h.bssSize;
        const segmentsSize = h.codeSegSize + h.rodataSegSize + dataNonBss;

        // Build ROMFS if we have files
        let romfsData = new Uint8Array(0);
        if (Object.keys(this.files).length > 0) {
            romfsData = this._buildRomfs();
        }

        // SMDH offset: after header + reloc counts + segments + reloc entries
        const relocEntriesSize = this.relocData.length - relocCountsSize;
        let smdhOffset = h.headerSize + relocCountsSize + segmentsSize + relocEntriesSize;
        // Align SMDH to 4 bytes
        smdhOffset = Math.ceil(smdhOffset / 4) * 4;

        const smdhSize = this.smdh.length;
        let fsOffset = smdhOffset + smdhSize;
        // Align ROMFS to 4 bytes (per 3dstools)
        fsOffset = Math.ceil(fsOffset / 4) * 4;

        // Update header
        h.smdhOffset = smdhOffset;
        h.smdhSize = smdhSize;
        h.fsOffset = fsOffset;

        // Calculate total size
        const totalSize = fsOffset + romfsData.length;
        const output = new Uint8Array(totalSize);
        const view = new DataView(output.buffer);
        let pos = 0;

        // Write header
        view.setUint32(pos, h.magic, true); pos += 4;
        view.setUint16(pos, h.headerSize, true); pos += 2;
        view.setUint16(pos, h.relocHdrSize, true); pos += 2;
        view.setUint32(pos, h.formatVer, true); pos += 4;
        view.setUint32(pos, h.flags, true); pos += 4;
        view.setUint32(pos, h.codeSegSize, true); pos += 4;
        view.setUint32(pos, h.rodataSegSize, true); pos += 4;
        view.setUint32(pos, h.dataSegSize, true); pos += 4;
        view.setUint32(pos, h.bssSize, true); pos += 4;
        view.setUint32(pos, h.smdhOffset, true); pos += 4;
        view.setUint32(pos, h.smdhSize, true); pos += 4;
        view.setUint32(pos, h.fsOffset, true); pos += 4;

        // Pad to headerSize
        while (pos < h.headerSize) { output[pos++] = 0; }

        // Write relocation counts (first part of relocData)
        output.set(this.relocData.subarray(0, relocCountsSize), pos);
        pos += relocCountsSize;

        // Write segments
        output.set(this.segments.code, pos); pos += h.codeSegSize;
        output.set(this.segments.rodata, pos); pos += h.rodataSegSize;
        output.set(this.segments.data, pos); pos += dataNonBss;

        // Write relocation entries (remaining part of relocData)
        const relocEntries = this.relocData.subarray(relocCountsSize);
        output.set(relocEntries, pos);
        pos += relocEntries.length;

        // Pad to SMDH offset
        while (pos < smdhOffset) { output[pos++] = 0; }

        // Write SMDH
        output.set(this.smdh, pos); pos += smdhSize;
        // Pad SMDH to 4 bytes (per 3dstools)
        while (pos % 4 !== 0) { output[pos++] = 0; }

        // Pad to ROMFS offset
        while (pos < fsOffset) { output[pos++] = 0; }

        // Write ROMFS
        output.set(romfsData, pos);

        return output;
    }

    // ============================================================
    // ROMFS parsing
    // ============================================================
    _parseRomfs(data) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        // Parse ROMFS header (40 bytes)
        const romfs = {
            headerLength: view.getUint32(0, true),
            dirHashTable: { offset: view.getUint32(4, true), length: view.getUint32(8, true) },
            dirMetaTable: { offset: view.getUint32(12, true), length: view.getUint32(16, true) },
            fileHashTable: { offset: view.getUint32(20, true), length: view.getUint32(24, true) },
            fileMetaTable: { offset: view.getUint32(28, true), length: view.getUint32(32, true) },
            fileDataOffset: view.getUint32(36, true),
        };

        if (!this._quiet)
            console.log('ROMFS header: dirHash@' + romfs.dirHashTable.offset + '(' + romfs.dirHashTable.length +
            ') dirMeta@' + romfs.dirMetaTable.offset + '(' + romfs.dirMetaTable.length +
            ') fileHash@' + romfs.fileHashTable.offset + '(' + romfs.fileHashTable.length +
            ') fileMeta@' + romfs.fileMetaTable.offset + '(' + romfs.fileMetaTable.length +
            ') data@' + romfs.fileDataOffset);

        // Read directory hash table (u32 array)
        const dirHashCount = romfs.dirHashTable.length / 4;
        const dirHash = new Array(dirHashCount);
        for (let i = 0; i < dirHashCount; i++) {
            dirHash[i] = view.getUint32(romfs.dirHashTable.offset + i * 4, true);
        }

        // Read file hash table (u32 array)
        const fileHashCount = romfs.fileHashTable.length / 4;
        const fileHash = new Array(fileHashCount);
        for (let i = 0; i < fileHashCount; i++) {
            fileHash[i] = view.getUint32(romfs.fileHashTable.offset + i * 4, true);
        }

        // DirectoryMetadata: 24 bytes + UTF-16 name (aligned to 4)
        //   u32 parent, u32 nextSibling, u32 firstChild, u32 firstFile, u32 hashBucketNext, u32 nameLength
        const DIR_META_SIZE = 24;
        // FileMetadata: 32 bytes + UTF-16 name (aligned to 4)
        //   u32 parent, u32 nextSibling, u64 fileDataOffset, u64 fileDataLength, u32 hashBucketNext, u32 nameLength
        const FILE_META_SIZE = 32;

        // Parse all directories (root is at offset 0 in dirMetaTable)
        const directories = [];
        const _readRomfsName = (baseOffset, nameLength) => {
            const charCount = nameLength / 2;
            let name = '';
            for (let i = 0; i < charCount; i++) {
                const cp = view.getUint16(baseOffset + i * 2, true);
                if (cp === 0) break;
                name += String.fromCharCode(cp);
            }
            return name;
        };

        // Preserve original table order for byte-identical re-encoding
        this._dirTableOrder = [];
        this._fileTableOrder = [];

        // Linear scan dirMeta table to capture original directory order
        {
            let pos = 0;
            while (pos < romfs.dirMetaTable.length) {
                const dMetaPos = romfs.dirMetaTable.offset + pos;
                const nameLength = view.getUint32(dMetaPos + 20, true);
                const dName = _readRomfsName(dMetaPos + DIR_META_SIZE, nameLength);
                this._dirTableOrder.push({ offset: pos, name: dName });
                const pad = (4 - nameLength % 4) % 4;
                pos += DIR_META_SIZE + nameLength + pad;
            }
        }

        // Linear scan fileMeta table to capture original file order
        {
            let pos = 0;
            while (pos < romfs.fileMetaTable.length) {
                const fMetaPos = romfs.fileMetaTable.offset + pos;
                const fNameLength = view.getUint32(fMetaPos + 28, true);
                const fName = _readRomfsName(fMetaPos + FILE_META_SIZE, fNameLength);
                const parentOff = view.getUint32(fMetaPos, true);
                this._fileTableOrder.push({ offset: pos, name: fName, parentOff: parentOff });
                const pad = (4 - fNameLength % 4) % 4;
                pos += FILE_META_SIZE + fNameLength + pad;
            }
        }

        // Traverse directory tree starting from root (offset 0)
        // Mirrors azahar's LoadDirectory: returns nextSibling offset, caller chains
        const dirOffsetToPath = new Map(); // dir table offset -> full path
        const _parseDir = (dirOffset, parentPath) => {
            if (dirOffset === 0xFFFFFFFF || dirOffset === 0xFFFFFFFE) return 0xFFFFFFFF;

            const metaPos = romfs.dirMetaTable.offset + dirOffset;
            const nextSibling = view.getUint32(metaPos + 4, true);
            const firstChild = view.getUint32(metaPos + 8, true);
            const firstFile = view.getUint32(metaPos + 12, true);
            const nameLength = view.getUint32(metaPos + 20, true);

            const name = _readRomfsName(metaPos + DIR_META_SIZE, nameLength);
            const path = parentPath + (name ? name + '/' : '');
            dirOffsetToPath.set(dirOffset, path);
            directories.push(path);
            this.directories.push(path);

            // Parse files in this directory
            let fileOff = firstFile;
            while (fileOff !== 0xFFFFFFFF && fileOff !== 0xFFFFFFFE) {
                const fMetaPos = romfs.fileMetaTable.offset + fileOff;
                const fDataOffset = view.getBigUint64(fMetaPos + 8, true);
                const fDataLength = view.getBigUint64(fMetaPos + 16, true);
                const fNameLength = view.getUint32(fMetaPos + 28, true);
                const fName = _readRomfsName(fMetaPos + FILE_META_SIZE, fNameLength);

                const fullPath = path + fName;
                const absOffset = romfs.fileDataOffset + Number(fDataOffset);
                const fileData = data.subarray(absOffset, absOffset + Number(fDataLength));
                this.files[fullPath] = fileData;
                if (!this._quiet)
                    console.log('  ROMFS file: ' + fullPath + ' (' + fileData.length + 'B)');

                fileOff = view.getUint32(fMetaPos + 4, true); // nextSibling
            }

            // Parse child directories (each returns its next sibling)
            let childOff = firstChild;
            while (childOff !== 0xFFFFFFFF && childOff !== 0xFFFFFFFE) {
                childOff = _parseDir(childOff, path);
            }

            return nextSibling;
        };

        _parseDir(0, '');

        // Resolve directory table order entries to full paths (strip trailing /)
        for (const entry of this._dirTableOrder) {
            let p = dirOffsetToPath.get(entry.offset) || '';
            if (p.endsWith('/')) p = p.slice(0, -1);
            entry.path = p;
        }

        // Resolve file table order entries to full paths
        for (const entry of this._fileTableOrder) {
            const parentPath = dirOffsetToPath.get(entry.parentOff) || '';
            entry.path = parentPath + entry.name;
        }

        if (!this._quiet)
            console.log('ROMFS: ' + Object.keys(this.files).length + ' files, ' + directories.length + ' directories');
    }

    // ============================================================
    // ROMFS building
    // ============================================================
    _buildRomfs() {
        const _romfsHash = (name, parentOffset) => {
            let hash = parentOffset ^ 0x075BCD15;
            for (let i = 0; i < name.length; i++) {
                const cp = name.charCodeAt(i);
                hash = ((hash >>> 5) | ((hash & 0x1FFFFFFF) << 27)) >>> 0;
                hash = (hash ^ cp) >>> 0;
            }
            return hash;
        };

        const _getTableSize = (count) => {
            if (count < 3) return 3;
            if (count < 19) return count | 1;
            let n = count;
            while (n % 2 === 0 || n % 3 === 0 || n % 5 === 0 || n % 7 === 0 ||
                   n % 11 === 0 || n % 13 === 0 || n % 17 === 0) {
                n++;
            }
            return n;
        };

        const _writeName = (name, buffer, offset) => {
            // Write UTF-16LE name
            let written = 0;
            for (let i = 0; i < name.length; i++) {
                const cp = name.charCodeAt(i);
                buffer[offset + written] = cp & 0xFF;
                buffer[offset + written + 1] = (cp >> 8) & 0xFF;
                written += 2;
            }
            // Pad to 4-byte alignment
            while (written % 4 !== 0) {
                buffer[offset + written] = 0;
                buffer[offset + written + 1] = 0;
                written += 2;
            }
            return written;
        };

        // Collect directories and files, preserving original table order
        let dirEntries, fileEntries;
        if (this._dirTableOrder && this._fileTableOrder) {
            // Use saved table order, filtering out deleted entries
            dirEntries = this._dirTableOrder
                .filter(e => e.path !== undefined)
                .map(e => e.path);
            // Ensure all parent dirs exist for current files
            const dirSet = new Set(dirEntries);
            const allFiles = Object.keys(this.files);
            for (const p of allFiles) {
                let parts = p;
                while ((parts = parts.substring(0, parts.lastIndexOf('/'))) !== '') {
                    if (!dirSet.has(parts)) { dirSet.add(parts); dirEntries.push(parts); }
                }
            }
            // Prune empty directories (no files, no subdirs)
            const dirsWithFiles = new Set();
            for (const p of allFiles) {
                let d = '';
                dirsWithFiles.add(d);
                let parts = p;
                while ((parts = parts.substring(0, parts.lastIndexOf('/'))) !== '') {
                    dirsWithFiles.add(parts);
                    d = parts;
                }
            }
            dirEntries = dirEntries.filter(d => dirsWithFiles.has(d));
            // File entries: use saved order for existing files, append new ones at end
            const savedPaths = new Set(this._fileTableOrder.map(e => e.path));
            fileEntries = this._fileTableOrder
                .filter(e => this.files[e.path] !== undefined)
                .map(e => ({ path: e.path, data: this.files[e.path] }));
            for (const p of allFiles) {
                if (!savedPaths.has(p)) fileEntries.push({ path: p, data: this.files[p] });
            }
        } else {
            // No saved order (first build), compute from scratch
            fileEntries = Object.keys(this.files).map(p => ({ path: p, data: this.files[p] }));
            const dirSet = new Set(['']);
            for (const f of fileEntries) {
                let parts = f.path;
                while ((parts = parts.substring(0, parts.lastIndexOf('/'))) !== '') {
                    dirSet.add(parts);
                }
            }
            dirEntries = Array.from(dirSet).sort((a, b) => a.length - b.length);
        }

        // Assign offsets
        const dirOffsetMap = new Map();
        let dirMetaPos = 0;
        for (const d of dirEntries) {
            dirOffsetMap.set(d, dirMetaPos);
            const nameLen = _writeName(d === '' ? '' : d.substring(d.lastIndexOf('/') + 1), new Uint8Array(1024), 0);
            dirMetaPos += 24 + Math.ceil(nameLen / 4) * 4;
        }

        const fileOffsetMap = new Map();
        let fileMetaPos = 0;
        for (const f of fileEntries) {
            fileOffsetMap.set(f.path, fileMetaPos);
            const nameLen = _writeName(f.path.substring(f.path.lastIndexOf('/') + 1), new Uint8Array(1024), 0);
            fileMetaPos += 32 + Math.ceil(nameLen / 4) * 4;
        }

        // Build hash tables
        const dirHashSize = _getTableSize(dirEntries.length);
        const dirHash = new Array(dirHashSize).fill(0xFFFFFFFF);
        const fileHashSize = _getTableSize(fileEntries.length);
        const fileHash = new Array(fileHashSize).fill(0xFFFFFFFF);

        // Build directory metadata
        const dirMetaBuffer = new Uint8Array(dirMetaPos);
        const dirMetaView = new DataView(dirMetaBuffer.buffer);

        // Group directories by parent for sibling chaining (LIFO per 3dstools)
        const childrenOf = new Map(); // parent -> [child paths]
        for (const d of dirEntries) {
            if (d === '') continue; // root has no parent
            const parent = d.substring(0, d.lastIndexOf('/')) || '';
            if (!childrenOf.has(parent)) childrenOf.set(parent, []);
            childrenOf.get(parent).unshift(d); // prepend (LIFO: last scanned = first child)
        }

        for (const d of dirEntries) {
            const off = dirOffsetMap.get(d);
            const parent = d === '' ? '' : d.substring(0, d.lastIndexOf('/'));
            const parentOff = dirOffsetMap.get(parent);

            dirMetaView.setUint32(off, parentOff, true); // parent
            dirMetaView.setUint32(off + 4, 0xFFFFFFFF, true); // nextSibling
            dirMetaView.setUint32(off + 8, 0xFFFFFFFF, true); // firstChild
            dirMetaView.setUint32(off + 12, 0xFFFFFFFF, true); // firstFile
            dirMetaView.setUint32(off + 16, 0xFFFFFFFF, true); // hashBucketNext

            const dirName = d === '' ? '' : d.substring(d.lastIndexOf('/') + 1);
            const nameLen = dirName.length * 2;
            dirMetaView.setUint32(off + 20, nameLen, true); // nameLength
            _writeName(dirName, dirMetaBuffer, off + 24);

            // Insert into hash table (hashBucketNext chains collisions)
            const hash = _romfsHash(dirName, parentOff);
            const bucket = hash % dirHashSize;
            dirMetaView.setUint32(off + 16, dirHash[bucket], true);
            dirHash[bucket] = off;
        }

        // Chain siblings via nextSibling and set firstChild on parents
        for (const [parent, children] of childrenOf) {
            const parentOff = dirOffsetMap.get(parent);
            // first child = children[0], chain: children[0] -> children[1] -> ... -> children[n]
            dirMetaView.setUint32(parentOff + 8, dirOffsetMap.get(children[0]), true);
            for (let i = 0; i < children.length; i++) {
                const childOff = dirOffsetMap.get(children[i]);
                const nextSibling = i < children.length - 1 ? dirOffsetMap.get(children[i + 1]) : 0xFFFFFFFF;
                dirMetaView.setUint32(childOff + 4, nextSibling, true);
            }
        }

        // Group files by parent directory for sibling chaining (LIFO per 3dstools)
        const filesOf = new Map(); // parent -> [file entry objects]
        for (const f of fileEntries) {
            const fileDir = f.path.substring(0, f.path.lastIndexOf('/')) || '';
            if (!filesOf.has(fileDir)) filesOf.set(fileDir, []);
            filesOf.get(fileDir).unshift(f); // prepend (LIFO: last scanned = first file)
        }

        // Chain file siblings and set firstFile on parents
        for (const [parent, files] of filesOf) {
            const parentOff = dirOffsetMap.get(parent);
            // first file = files[0], chain: files[0] -> files[1] -> ... -> files[n]
            dirMetaView.setUint32(parentOff + 12, fileOffsetMap.get(files[0].path), true);
        }

        // Build file metadata
        const fileMetaBuffer = new Uint8Array(fileMetaPos);
        const fileMetaView = new DataView(fileMetaBuffer.buffer);
        // Align file data start to 4 bytes (per 3dstools)
        const totalMetaSize = 40 + (dirHashSize * 4) + dirMetaBuffer.length + (fileHashSize * 4) + fileMetaBuffer.length;
        const fileDataRegionStart = Math.ceil(totalMetaSize / 4) * 4;

        // fileDataOffsetMap stores RELATIVE offsets (relative to fileDataRegionStart)
        // Each file is 4-byte aligned per 3dstools
        const fileDataOffsetMap = new Map();
        let fileDataRegionSize = 0;
        for (const f of fileEntries) {
            fileDataOffsetMap.set(f.path, fileDataRegionSize);
            fileDataRegionSize += Math.ceil(f.data.length / 4) * 4;
        }

        for (const f of fileEntries) {
            const off = fileOffsetMap.get(f.path);
            const parent = f.path.substring(0, f.path.lastIndexOf('/')) || '';
            const parentOff = dirOffsetMap.get(parent);
            const fileName = f.path.substring(f.path.lastIndexOf('/') + 1);
            const nameLen = fileName.length * 2;

            fileMetaView.setUint32(off, parentOff, true); // parent
            fileMetaView.setUint32(off + 4, 0xFFFFFFFF, true); // nextSibling
            fileMetaView.setBigUint64(off + 8, BigInt(fileDataOffsetMap.get(f.path)), true); // fileDataOffset (relative)
            fileMetaView.setBigUint64(off + 16, BigInt(f.data.length), true); // fileDataLength
            fileMetaView.setUint32(off + 24, 0xFFFFFFFF, true); // hashBucketNext
            fileMetaView.setUint32(off + 28, nameLen, true); // nameLength
            _writeName(fileName, fileMetaBuffer, off + 32);

            // Insert into hash table
            const hash = _romfsHash(fileName, parentOff);
            const bucket = hash % fileHashSize;
            fileMetaView.setUint32(off + 24, fileHash[bucket], true);
            fileHash[bucket] = off;
        }

        // Chain file siblings via nextSibling
        for (const [parent, files] of filesOf) {
            for (let i = 0; i < files.length; i++) {
                const fileOff = fileOffsetMap.get(files[i].path);
                const nextSibling = i < files.length - 1 ? fileOffsetMap.get(files[i + 1].path) : 0xFFFFFFFF;
                fileMetaView.setUint32(fileOff + 4, nextSibling, true);
            }
        }

        // Assemble ROMFS
        const romfsSize = fileDataRegionStart + fileDataRegionSize;
        const romfs = new Uint8Array(romfsSize);
        const romfsView = new DataView(romfs.buffer);

        // Write ROMFS header (40 bytes, per azahar RomFSHeader)
        romfsView.setUint32(0, 40, true); // headerLength
        romfsView.setUint32(4, 40, true); // dirHashTable offset
        romfsView.setUint32(8, dirHashSize * 4, true); // dirHashTable length
        romfsView.setUint32(12, 40 + dirHashSize * 4, true); // dirMetaTable offset
        romfsView.setUint32(16, dirMetaBuffer.length, true); // dirMetaTable length
        romfsView.setUint32(20, 40 + dirHashSize * 4 + dirMetaBuffer.length, true); // fileHashTable offset
        romfsView.setUint32(24, fileHashSize * 4, true); // fileHashTable length
        romfsView.setUint32(28, 40 + dirHashSize * 4 + dirMetaBuffer.length + fileHashSize * 4, true); // fileMetaTable offset
        romfsView.setUint32(32, fileMetaBuffer.length, true); // fileMetaTable length
        romfsView.setUint32(36, fileDataRegionStart, true); // fileDataOffset

        // Write hash tables
        let pos = 40;
        for (let i = 0; i < dirHashSize; i++) { romfsView.setUint32(pos, dirHash[i], true); pos += 4; }
        romfs.set(dirMetaBuffer, pos); pos += dirMetaBuffer.length;
        for (let i = 0; i < fileHashSize; i++) { romfsView.setUint32(pos, fileHash[i], true); pos += 4; }
        romfs.set(fileMetaBuffer, pos); pos += fileMetaBuffer.length;

        // Write file data
        for (const f of fileEntries) {
            const absOff = fileDataRegionStart + fileDataOffsetMap.get(f.path);
            romfs.set(f.data, absOff);
        }

        return romfs;
    }
}
