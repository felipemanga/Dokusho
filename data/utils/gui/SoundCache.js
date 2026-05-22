import { CommonCache } from './CommonCache.js';

const soundCache = new CommonCache(50);

export function getSound(path) {
    const sound = soundCache.get(path);
    if (sound === undefined) {
        soundCache.set(path, new Sound(path));
        return soundCache.get(path);
    }
    return sound;
}

export function getSoundCache() {
    return soundCache;
}
