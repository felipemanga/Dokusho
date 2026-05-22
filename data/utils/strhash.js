
export function strhash(str) {
    let hash = 0;
    if (typeof str != 'string' || str.length == 0)
        return '';
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash == 0 ? '' : '_' + Math.abs(hash).toString(16);
}
