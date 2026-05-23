// NovelReader shared state: palettes, settings, backgrounds, fonts

import { nodeMap, Root } from '../../utils/gui/GUI.js';

// String specs for GUI attrs (resolved by theme system)
const fontSmall = 'system 10px';
const fontMedium = 'system 12px';
const fontLarge = 'system 20px';
const fontUltra = 'system 50px';

// Mutable state with getters/setters (ESM imports are read-only bindings)
let _textFontSize = 30;
let _textFont = 'system 30px';
export function getTextFontSize() { return _textFontSize; }
export function setTextFontSize(val) { _textFontSize = val; _textFont = 'system ' + val + 'px'; }
export function getTextFont() { return _textFont; }

let _autoTranslateMode = 'off'; // 'off' | 'line' | 'chapter'
export function getAutoTranslateMode() { return _autoTranslateMode; }
export function setAutoTranslateMode(val) { _autoTranslateMode = val; }

let _imgMode = 'cover'; // 'cover' | 'background'
export function getImgMode() { return _imgMode; }
export function setImgMode(val) { _imgMode = val; }

const buttonRowY = 225;

// NovelReader local settings
const SettingsFile = (settings.basePath == 'romfs:/' ? 'sdmc:/' : '') + 'Novels/novelreader-settings.json';
export let nrSettings = {
    imgGenPostfix: '',
    imgGenNegative: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality',
    imgGenWidth: 1024,
    imgGenHeight: 640,
    imgGenSteps: 30,
    musicFolder: 'Novels/music',
    musicVolume: 0.8,
    musicShuffle: false,
    musicRepeat: false,
    musicCurrentTrack: -1
};

export async function loadNrSettings() {
    try {
        const data = await fs.readFile(SettingsFile);
        const loaded = JSON.parse(data);
        if (loaded && typeof loaded === 'object') {
            Object.assign(nrSettings, loaded);
        }
    } catch (ex) {
        // Keep initial defaults
    }
    // Apply loaded settings
    if (nrSettings.textFontSize != null) {
        setTextFontSize(nrSettings.textFontSize);
    }
    if (nrSettings.autoTranslateMode && ['off', 'line', 'chapter'].includes(nrSettings.autoTranslateMode)) {
        setAutoTranslateMode(nrSettings.autoTranslateMode);
    }
    if (nrSettings.musicFolder != null) {
        _musicFolder = nrSettings.musicFolder;
    }
    if (nrSettings.musicVolume != null) {
        _musicVolume = nrSettings.musicVolume;
    }
    if (nrSettings.musicShuffle != null) {
        _musicIsShuffled = !!nrSettings.musicShuffle;
    }
    if (nrSettings.musicRepeat != null) {
        _musicIsRepeating = !!nrSettings.musicRepeat;
    }
    if (nrSettings.musicCurrentTrack != null) {
        _musicCurrentTrack = nrSettings.musicCurrentTrack;
    }
    console.log('Loaded NovelReader settings:', nrSettings);
}

export function getLlmEndpoint() { return nrSettings.llmEndpoint ?? settings.llmServerEndpoint; }
export function getSdEndpoint() { return nrSettings.sdEndpoint ?? settings.sdServerEndpoint; }
export function getBgPath() { return nrSettings.bgPath ?? settings.imageGenPath; }
export function getAltBgPath() { return nrSettings.altBgPath || 'DeltaAI'; }
export function getNovelImageFolder() {
    return (settings.basePath == 'romfs:/' ? 'sdmc:/' : '') + 'Novels';
}

export async function saveNrSettings(llmVal, sdVal, bgVal, altBgVal) {
    nrSettings.textFontSize = getTextFontSize();
    nrSettings.paletteIndex = getCurrentPaletteIndex();
    if (llmVal !== undefined) nrSettings.llmEndpoint = llmVal || null;
    if (sdVal !== undefined) nrSettings.sdEndpoint = sdVal || null;
    if (bgVal !== undefined) nrSettings.bgPath = bgVal || null;
    if (altBgVal !== undefined) nrSettings.altBgPath = altBgVal || null;
    nrSettings.autoTranslateMode = getAutoTranslateMode();
    nrSettings.imgGenPostfix = nrSettings.imgGenPostfix || '';
    nrSettings.imgGenNegative = nrSettings.imgGenNegative || '';
    nrSettings.imgGenWidth = nrSettings.imgGenWidth || 1024;
    nrSettings.imgGenHeight = nrSettings.imgGenHeight || 640;
    nrSettings.imgGenSteps = nrSettings.imgGenSteps || 30;
    nrSettings.musicFolder = getMusicFolder();
    nrSettings.musicVolume = getMusicVolume();
    nrSettings.musicShuffle = getMusicIsShuffled();
    nrSettings.musicRepeat = getMusicIsRepeating();
    nrSettings.musicCurrentTrack = getMusicCurrentTrack();
    try {
        await fs.writeFile(SettingsFile, JSON.stringify(nrSettings, null, 2));
        console.log('Saved NovelReader settings:', nrSettings);
    } catch (ex) {
        console.error('Failed to save settings:', ex);
    }
}

// Palette definitions: [background, text, highlight]
export const palettes = [
    { name: 'Purple Night', bg: 0xFF555588, text: 0xFFFFFF, hl: 0xFFFF8800 },
    { name: 'Dark Ocean',   bg: 0xFF1A2A3A, text: 0xE0E8F0, hl: 0xFF44DDFF },
    { name: 'Warm Sand',    bg: 0xFF3A2A1A, text: 0xF0E8D8, hl: 0xFFFFCC44 },
    { name: 'Forest',       bg: 0xFF1A3A1A, text: 0xD8F0D8, hl: 0xFF88FF44 },
];
let _currentPaletteIndex = 0;
export function getCurrentPaletteIndex() { return _currentPaletteIndex; }
export function setCurrentPaletteIndex(val) { _currentPaletteIndex = val; }

export function applyPalette(index, win) {
    setCurrentPaletteIndex(index);
    const p = palettes[index];
    setPalette(p.bg, p.text, p.hl);
    // Update progress fill color
    if (nodeMap.progressFill) {
        nodeMap.progressFill.backgroundColor = p.hl;
    }
    if (nodeMap.llmProgressFill) {
        nodeMap.llmProgressFill.backgroundColor = p.hl;
    }

    if (win) {
        console.log('Applying palette:', p.name);
        win.backgroundColor = palette.background;
        Root.getCurrent().backgroundColor = palette.background;
    }
    console.log('Applied palette:', p.name);
}

export const palette = {
    textDim: 0x88FFFFFF >>> 0,
    textNormal: 0xCCFFFFFF >>> 0,
    textBright: 0xFFFFFFFF >>> 0,
    highlight: 0xFFFF8800 >>> 0,
    background: 0xFF555588 >>> 0,
    contrast: 0x33000000 >>> 0
};

export function setPalette(background, text, highlight) {
    text &= 0xFFFFFF;
    palette.background = background >>> 0;
    palette.textNormal = (text | 0xCC000000) >>> 0;
    palette.textDim    = (text | 0x88000000) >>> 0;
    palette.textBright = (text | 0xFF000000) >>> 0;
    palette.highlight = highlight >>> 0;
    palette.contrast = ((text ^ 0xFFFFFF) | 0x33000000) >>> 0;
}

let altMode = false;
export async function setBG(node, image) {
    console.log('SetImage: ', !!image);
    if (!image) {
        node.image = null;
        return;
    }
    node.image = image;
    const w = image.width;
    const h = image.height;
    const s = Math.max(400 / w, 240 / h);
    const sw = w * s;
    const sh = h * s;
    node.anchorX = 0;
    node.anchorY = 0;
    node.width = sw;
    node.height = sh;
    node.x = (400/2 - sw/2) / s;
    node.y = (240/2 - sh/2) / s;
}

export async function rndBG(node) {
    try {
        const dir = altMode ? getAltBgPath() : getBgPath();
        const SaveFolder = (settings.basePath == 'romfs:/' ? 'sdmc:/' : '') + dir;
        const files = (await fs.listDir(SaveFolder))
              .filter(e => e.isFile && /\.png$/i.test(e.name) && !/_thumb\./i.test(e.name))
              .map(e => e.name);
        const pick = files[Math.random() * files.length | 0];
        if (!pick)
            return;
        setBG(node, new Image(SaveFolder + '/' + pick));
    } catch (ex) {
        console.error(ex);
    }
}

export function setAltMode(val) { altMode = val; }
export function getAltMode() { return altMode; }

// Music state
let _musicFolder = nrSettings.musicFolder || 'Novels/music';
let _musicVolume = nrSettings.musicVolume || 0.8;
let _musicPlaylist = [];
let _musicCurrentTrack = -1;
let _musicIsPlaying = false;
let _musicIsShuffled = false;
let _musicIsRepeating = false;
let _musicSound = null;
let _musicTrackOrder = []; // indices for shuffle/sequential order

export function getMusicFolder() { return _musicFolder; }
export function setMusicFolder(val) { _musicFolder = val; }
export function getMusicVolume() { return _musicVolume; }
export function setMusicVolume(val) { _musicVolume = val; }
export function getMusicPlaylist() { return _musicPlaylist; }
export function getMusicCurrentTrack() { return _musicCurrentTrack; }
export function getMusicIsPlaying() { return _musicIsPlaying; }
export function getMusicIsShuffled() { return _musicIsShuffled; }
export function getMusicIsRepeating() { return _musicIsRepeating; }
export function getMusicSound() { return _musicSound; }
export function getMusicTrackOrder() { return _musicTrackOrder; }

export function setMusicPlaylist(playlist) {
    _musicPlaylist = playlist;
    _musicTrackOrder = playlist.map((_, i) => i);
    _musicCurrentTrack = -1;
    _musicIsPlaying = false;
    _musicSound = null;
}

export function setMusicCurrentTrack(idx) {
    _musicCurrentTrack = idx;
}

export function setMusicIsPlaying(val) {
    _musicIsPlaying = val;
}

export function setMusicIsShuffled(val) {
    _musicIsShuffled = val;
}

export function setMusicIsRepeating(val) {
    _musicIsRepeating = val;
}

export function setMusicSound(sound) {
    _musicSound = sound;
}

// Build track order based on shuffle state
export function updateMusicTrackOrder() {
    if (_musicIsShuffled) {
        _musicTrackOrder = [...Array(_musicPlaylist.length).keys()];
        // Fisher-Yates shuffle
        for (let i = _musicTrackOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [_musicTrackOrder[i], _musicTrackOrder[j]] = [_musicTrackOrder[j], _musicTrackOrder[i]];
        }
    } else {
        _musicTrackOrder = [...Array(_musicPlaylist.length).keys()];
    }
}

// Get the next track index in the current order
export function getNextTrackIndex() {
    if (_musicTrackOrder.length === 0) return -1;
    const currentPos = _musicTrackOrder.indexOf(_musicCurrentTrack);
    if (currentPos === -1) return _musicTrackOrder[0];
    let nextPos = currentPos + 1;
    if (nextPos >= _musicTrackOrder.length) {
        if (_musicIsRepeating) {
            nextPos = 0;
        } else {
            return -1; // No more tracks
        }
    }
    return _musicTrackOrder[nextPos];
}

// Get the previous track index
export function getPrevTrackIndex() {
    if (_musicTrackOrder.length === 0) return -1;
    const currentPos = _musicTrackOrder.indexOf(_musicCurrentTrack);
    if (currentPos === -1) return _musicTrackOrder[0];
    let prevPos = currentPos - 1;
    if (prevPos < 0) {
        prevPos = _musicIsRepeating ? _musicTrackOrder.length - 1 : 0;
    }
    return _musicTrackOrder[prevPos];
}

// Get the full path to a music file
export function getMusicFilePath(trackIndex) {
    if (trackIndex < 0 || trackIndex >= _musicPlaylist.length) return '';
    const basePath = settings.basePath == 'romfs:/' ? 'sdmc:/' : '';
    return basePath + _musicFolder + '/' + _musicPlaylist[trackIndex];
}

// Load dedicated background image for a chapter, fallback to random
export async function loadChapterBG(node, ncode, chapterIdx) {
    const novelFolder = getNovelImageFolder();
    // Try generated images in NovelFolder first
    const candidates = [
        `${novelFolder}/${ncode}_bg_ch${chapterIdx}_top.png`,
        `${novelFolder}/${ncode}_bg_ch${chapterIdx}.png`,
        `${novelFolder}/${ncode}_cover_top.png`,
        `${novelFolder}/${ncode}_cover.png`,
    ];

    for (const fname of candidates) {
        try {
            let image = new Image(fname);
            if (image) {
                setBG(node, image);
                return;
            }
        } catch (ex) {
            console.log(ex);
        }
    }

    // Fallback to random user-provided background
    rndBG(node);
}

// Re-export for consumer convenience
export { fontSmall, fontMedium, fontLarge, fontUltra, buttonRowY };
