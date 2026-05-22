import { CommonCache } from './CommonCache.js';

const imageCache = new CommonCache(50);

export function getImage(path) {
    if (path.substr(0, 5) == 'data:') {
        console.log('not caching data url');
        return new Image(path);
    }
    const image = imageCache.get(path);
    if (image === undefined) {
        imageCache.set(path, new Image(path));
        return imageCache.get(path);
    }
    return image;
}

export function getImageCache() {
    return imageCache;
}
