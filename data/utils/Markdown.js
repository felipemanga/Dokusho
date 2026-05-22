import { getFont } from './gui/FontCache.js';

export class Markdown {

    static render(text, options = {}) {
        let {
            regularSize = 16,
            codeSize = 16,
            headerSizes,
            color = 0xFFFFFFFF,
            headerColor = 0xFFFFCC00,
            codeColor = 0xFFAAAAAA,
            codeBgColor = 0xAA222222,
            quoteBarColor = 0xFF666666,
            quoteTextColor = 0xFF333333,
            quoteBgColor = 0x44E0E0E0,
            linkColor = 0xFF0000EE,
            fontPaths = {
                regular: 'data/Lato/Lato-Regular.ttf',
                bold: 'data/Lato/Lato-Bold.ttf',
                italic: 'data/Lato/Lato-Italic.ttf',
                boldItalic: 'data/Lato/Lato-BoldItalic.ttf',
                heavy: 'data/Lato/Lato-Black.ttf',
                mono: 'data/PressStart2P-Regular.ttf'
            }
        } = options;

        if (!headerSizes) {
            headerSizes = [regularSize * 2, regularSize * 1.5 | 0, regularSize * 1.25 | 0];
        }

        const segments = [];
        const lines = text.split('\n');

        let listCounters = []; // For nested ordered lists
        let lastWasEmpty = false;

        let inCodeBlock = false;
        let codeBlockLines = [];
        let codeBlockIndent = 0;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // Handle code blocks
            if (line.trimStart().startsWith('```')) {
                if (!inCodeBlock) {
                    // Start of code block
                    inCodeBlock = true;
                    codeBlockLines = [];
                    const match = line.match(/^(\s*)```(\w*)/);
                    codeBlockIndent = match ? match[1].length : 0;
                    continue;
                } else {
                    // End of code block - render collected lines
                    const monoFont = getFont(fontPaths.mono, codeSize);
                    for (let j = 0; j < codeBlockLines.length; j++) {
                        const codeLine = codeBlockLines[j];
                        if (codeBlockIndent > 0) {
                            segments.push({ width: codeBlockIndent, bgColor: codeBgColor, vAlign: 'middle' });
                        }
                        segments.push({ text: codeLine, font: monoFont, color: codeColor, bgColor: codeBgColor });
                        segments.push({ bgColor: codeBgColor, vAlign: 'middle' }); // Flexible spacer to fill line
                        segments.push({ text: '\n', font: monoFont, color: codeColor, bgColor: codeBgColor });
                    }
                    inCodeBlock = false;
                    codeBlockLines = [];
                    continue;
                }
            }

            if (inCodeBlock) {
                codeBlockLines.push(line);
                continue;
            }

            const trimmed = line.trim();
            if (trimmed === "") {
                if (lastWasEmpty) continue;
                listCounters = [];
                segments.push({ text: '\n', font: getFont(fontPaths.regular, regularSize), color: color });
                lastWasEmpty = true;
                continue;
            }
            lastWasEmpty = false;

            const indentMatch = line.match(/^(\s*)/);
            const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
            const indentStr = "  ".repeat(indentLevel);

            // Handle headers
            if (line.startsWith('# ')) {
                this.parseInline(line.substring(2), segments, fontPaths, { size: headerSizes[0], color: headerColor, linkColor });
                segments.push({ text: '\n', font: getFont(fontPaths.bold, headerSizes[0]), color: headerColor });
                listCounters = [];
                continue;
            } else if (line.startsWith('## ')) {
                this.parseInline(line.substring(3), segments, fontPaths, { size: headerSizes[1], color: headerColor, linkColor });
                segments.push({ text: '\n', font: getFont(fontPaths.bold, headerSizes[1]), color: headerColor });
                listCounters = [];
                continue;
            } else if (line.startsWith('### ')) {
                this.parseInline(line.substring(4), segments, fontPaths, { size: headerSizes[2], color: headerColor, linkColor });
                segments.push({ text: '\n', font: getFont(fontPaths.bold, headerSizes[2]), color: headerColor });
                listCounters = [];
                continue;
            }

            // Handle Blockquotes
            const quoteMatch = line.match(/^(\s*)(>+)\s?(.*)/);
            if (quoteMatch) {
                const quoteLevel = quoteMatch[2].length;
                const quoteContent = quoteMatch[3];
                if (indentStr) {
                    segments.push({ text: indentStr, font: getFont(fontPaths.regular, regularSize), color: color });
                }
                for (let q = 0; q < quoteLevel; q++) {
                    segments.push({ width: 4, bgColor: quoteBarColor, vAlign: 'middle' });
                    segments.push({ width: 4, bgColor: quoteBgColor, vAlign: 'middle' });
                }
                this.parseInline(quoteContent, segments, fontPaths, { size: regularSize, color: quoteTextColor, bgColor: quoteBgColor, linkColor });
                segments.push({ bgColor: quoteBgColor, vAlign: 'middle' }); // Flexible spacer to fill line
                segments.push({ text: '\n', font: getFont(fontPaths.regular, regularSize), color: color });
                listCounters = [];
                continue;
            }

            // Handle Lists
            const unorderedMatch = line.match(/^\s*[*+-]\s+(.*)/);
            const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)/);

            if (unorderedMatch) {
                segments.push({ text: indentStr + "• ", font: getFont(fontPaths.regular, regularSize), color: color });
                this.parseInline(unorderedMatch[1], segments, fontPaths, { size: regularSize, color: color, linkColor });
                segments.push({ text: '\n', font: getFont(fontPaths.regular, regularSize), color: color });
                continue;
            } else if (orderedMatch) {
                if (listCounters.length <= indentLevel) {
                    while (listCounters.length <= indentLevel) listCounters.push(1);
                } else {
                    listCounters.length = indentLevel + 1;
                    listCounters[indentLevel]++;
                }
                const num = listCounters[indentLevel];
                segments.push({ text: indentStr + num + ". ", font: getFont(fontPaths.regular, regularSize), color: color });
                this.parseInline(orderedMatch[2], segments, fontPaths, { size: regularSize, color: color, linkColor });
                segments.push({ text: '\n', font: getFont(fontPaths.regular, regularSize), color: color });
                continue;
            }

            // Reset counters if not a list item
            listCounters = [];

            // Handle regular line
            this.parseInline(line, segments, fontPaths, { size: regularSize, color: color, linkColor });
            if (i < lines.length - 1) {
                segments.push({ text: '\n', font: getFont(fontPaths.regular, regularSize), color: color });
            }
        }

        return segments;
    }

    static parseInline(text, segments, fontPaths, state) {
        const { size, color, bgColor, linkColor, bold = false, italic = false, code = false, linkData = null } = state;

        if (!text) return;

        const common = { bgColor, data: linkData || undefined };

        if (code) {
            segments.push({ text: text, font: getFont(fontPaths.mono, size * 0.8), color: 0xFFAAAAAA, ...common });
            return;
        }

        const patterns = [
            { type: 'image_tag', regex: /<img\s+([^>]*?)>/ },
            { type: 'image', regex: /!\[(.*?)\]\((.*?)\)/ },
            { type: 'link', regex: /\[(.*?)\]\((.*?)\)/ },
            { type: 'code', regex: /`(.*?)`/ },
            { type: 'boldItalic', regex: /\*\*\*(.*?)\*\*\*(?!\*)|___(.*?)___(?!_)/ },
            { type: 'bold', regex: /\*\*(.*?)\*\*|__(.*?)__(?!_)/ },
            { type: 'italic', regex: /\*(.*?)\*(?!\*)|_(.*?)_(?!_)/ }
        ];

        let bestMatch = null;
        for (const p of patterns) {
            const m = p.regex.exec(text);
            if (m && (!bestMatch || m.index < bestMatch.index)) {
                bestMatch = {
                    type: p.type,
                    index: m.index,
                    length: m[0].length,
                    m: m
                };
            }
        }

        if (!bestMatch) {
            let fontPath = fontPaths.regular;
            if (bold && italic) fontPath = fontPaths.boldItalic;
            else if (bold) fontPath = fontPaths.bold;
            else if (italic) fontPath = fontPaths.italic;
            let matchSize = size;
            if (bold && fontPath == fontPaths.regular)
                matchSize = Math.round(matchSize * 1.2);
            segments.push({ text, font: getFont(fontPath, matchSize), color, ...common });
            return;
        }

        // Before match
        if (bestMatch.index > 0) {
            this.parseInline(text.substring(0, bestMatch.index), segments, fontPaths, state);
        }

        // Match
        const m = bestMatch.m;
        if (bestMatch.type === 'image_tag') {
            const attrs = {};
            const attrRegex = /(\w+)\s*=\s*["']([^"']*)["']/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(m[1])) !== null) {
                attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
            }
            if (attrs.src) {
                try {
                    const img = new Image(attrs.src);
                    if (img)  {
                        const w = attrs.width ? parseInt(attrs.width) : 0;
                        const h = attrs.height ? parseInt(attrs.height) : 0;
                        const resized = (w > 0 && h > 0) ? img.resize(w, h) : img;
                        segments.push({ image: resized, vAlign: 'middle', ...common });
                    } else {
                        segments.push({ text: `[Image: ${attrs.alt || attrs.src}]`, font: getFont(fontPaths.mono, size * 0.8), color: 0xFFFF0000, ...common });
                    }
                } catch (e) {
                    console.error("Failed to load img tag:", attrs.src, e);
                }
            }
        } else if (bestMatch.type === 'image') {
            try {
                segments.push({ image: new Image(m[2]), vAlign: 'middle', ...common });
            } catch (e) {
                console.error("Failed to load markdown image:", m[2], e);
                segments.push({ text: `[Image: ${m[1] || m[2]}]`, font: getFont(fontPaths.mono, size * 0.8), color: 0xFFFF0000, ...common });
            }
        } else if (bestMatch.type === 'link') {
            this.parseInline(m[1], segments, fontPaths, { ...state, color: linkColor, linkData: m[2] });
        } else if (bestMatch.type === 'code') {
            this.parseInline(m[1], segments, fontPaths, { ...state, code: true });
        } else if (bestMatch.type === 'boldItalic') {
            this.parseInline(m[1], segments, fontPaths, { ...state, bold: true, italic: true });
        } else if (bestMatch.type === 'bold') {
            this.parseInline(m[1], segments, fontPaths, { ...state, bold: true });
        } else if (bestMatch.type === 'italic') {
            this.parseInline(m[1], segments, fontPaths, { ...state, italic: true });
        }

        // After match
        const nextPos = bestMatch.index + bestMatch.length;
        if (nextPos < text.length) {
            this.parseInline(text.substring(nextPos), segments, fontPaths, state);
        }
    }
}
