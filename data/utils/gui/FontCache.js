import { CommonCache } from './CommonCache.js';

const fontCache = new CommonCache(20);

export const fontPaths = {
    regular: 'data/Lato/Lato-Regular.ttf',
    bold: 'data/Lato/Lato-Bold.ttf',
    italic: 'data/Lato/Lato-Italic.ttf',
    boldItalic: 'data/Lato/Lato-BoldItalic.ttf',
    heavy: 'data/Lato/Lato-Black.ttf',
    mono: 'data/PressStart2P-Regular.ttf',
    system: 'NotoSansCJK-Regular.ttc'
};

export function getFont(path, size) {
    // Accept shorthand: 'system 16px' -> resolves name + size
    if (typeof path === 'string') {
        const m = path.match(/(.+?)\s+(\d+)px\s*$/);
        if (m) {
            path = m[1];
            size = parseInt(m[2]);
        }
        // Resolve named font to file path
        if (path in fontPaths) {
            path = fontPaths[path];
        }
    }

    const key = `${path}:${size}`;
    const font = fontCache.get(key);
    if (font === undefined) {
        fontCache.set(key, new Font(path, size));
        return fontCache.get(key);
    }
    return font;
}

export function getFontCache() {
    return fontCache;
}
