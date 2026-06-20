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
    musicRandomBgOnEnd: false,
    bgAutoRandomInterval: 0,
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
    if (nrSettings.bgAutoRandomInterval != null) {
        _bgAutoRandomInterval = nrSettings.bgAutoRandomInterval;
        restartBgAutoRandomTimer();
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
    nrSettings.musicRandomBgOnEnd = getMusicRandomBgOnEnd();
    nrSettings.bgAutoRandomInterval = getBgAutoRandomInterval();
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
let altBGMode = false;

export function updateAltBGMode() {
    altBGMode = altMode;
}

// BG pan + zoom state
const BG_VIEWPORT_W = 400;
const BG_VIEWPORT_H = 240;
export const BG_PAN_SPEED = 8;
export const BG_ZOOM_STEP = 0.05;
const BG_ZOOM_MAX = 4;
let _bgPanOffsetX = 0;
let _bgPanOffsetY = 0;
let _bgImageWidth = 0;
let _bgImageHeight = 0;
let _bgBaseScale = 1;     // cover scale from setBG
let _bgZoomLevel = 1;     // multiplier on top of base scale
let _coverWidth = 0;      // image width at zoom=1 (cover scale)
let _coverHeight = 0;     // image height at zoom=1 (cover scale)
let _bgPanFrameId = 0;    // rAF id for continuous pan
let _bgPanDir = { dx: 0, dy: 0, zoomIn: false, zoomOut: false };

export function getBgPanOffsetX() { return _bgPanOffsetX; }
export function getBgPanOffsetY() { return _bgPanOffsetY; }
export function getBgImageWidth() { return _bgImageWidth; }
export function getBgImageHeight() { return _bgImageHeight; }
export function getBgZoomLevel() { return _bgZoomLevel; }

// Minimum zoom that keeps both dimensions >= viewport.
// At zoom z: scaledW = coverW * z, scaledH = coverH * z.
// Need scaledW >= 400 AND scaledH >= 240.
function getMinZoom() {
    if (_coverWidth === 0 || _coverHeight === 0) return 1;
    return Math.max(BG_VIEWPORT_W / _coverWidth, BG_VIEWPORT_H / _coverHeight);
}

// Re-apply current scale + zoom + pan to the BG node
function applyBgTransform(ctrl) {
    const node = ctrl.node;
    const s = _bgBaseScale * _bgZoomLevel;
    const img = node.image;
    if (!img) return;
    const sw = img.width * s;
    const sh = img.height * s;
    _bgImageWidth = sw;
    _bgImageHeight = sh;
    ctrl.width = sw;
    ctrl.height = sh;
    // Clamp pan: image must always cover viewport
    const maxOffX = Math.max(0, (sw - BG_VIEWPORT_W) / 2);
    const maxOffY = Math.max(0, (sh - BG_VIEWPORT_H) / 2);
    _bgPanOffsetX = Math.max(-maxOffX, Math.min(maxOffX, _bgPanOffsetX));
    _bgPanOffsetY = Math.max(-maxOffY, Math.min(maxOffY, _bgPanOffsetY));
    ctrl.position = {
        x: BG_VIEWPORT_W / 2 + _bgPanOffsetX,
        y: BG_VIEWPORT_H / 2 + _bgPanOffsetY
    };
}

// Zoom BG in/out. factor > 1 zooms in, < 1 zooms out.
// Clamped so image always covers the full viewport.
export function zoomBG(factor) {
    const bg = nodeMap.bg;
    if (!bg || !bg.node.image) return;
    const minZoom = getMinZoom();
    _bgZoomLevel = Math.max(minZoom, Math.min(BG_ZOOM_MAX, _bgZoomLevel * factor));
    applyBgTransform(bg);
    resetBgAutoRandomTimer();
}

// Pan BG by dx/dy, clamped so image always covers viewport.
export function panBG(dx, dy) {
    const bg = nodeMap.bg;
    if (!bg || !bg.node.image) return;

    const maxOffX = Math.max(0, (_bgImageWidth - BG_VIEWPORT_W) / 2);
    const maxOffY = Math.max(0, (_bgImageHeight - BG_VIEWPORT_H) / 2);
    if (maxOffX === 0 && maxOffY === 0) return;

    _bgPanOffsetX = Math.max(-maxOffX, Math.min(maxOffX, _bgPanOffsetX + dx));
    _bgPanOffsetY = Math.max(-maxOffY, Math.min(maxOffY, _bgPanOffsetY + dy));

    bg.node.position = {
        x: BG_VIEWPORT_W / 2 + _bgPanOffsetX,
        y: BG_VIEWPORT_H / 2 + _bgPanOffsetY
    };
    resetBgAutoRandomTimer();
}

// Continuous pan/zoom loop driven by requestAnimationFrame.
// Starts on stick keydown, stops on keyup.
function bgPanTick() {
    const { dx, dy, zoomIn, zoomOut } = _bgPanDir;
    if (zoomIn) zoomBG(1 + BG_ZOOM_STEP);
    if (zoomOut) zoomBG(1 - BG_ZOOM_STEP);
    if (dx !== 0 || dy !== 0) {
        panBG(dx, dy);
    }
    // Keep looping as long as there's active direction
    if (_bgPanDir.dx !== 0 || _bgPanDir.dy !== 0 || _bgPanDir.zoomIn || _bgPanDir.zoomOut) {
        _bgPanFrameId = requestAnimationFrame(bgPanTick);
    } else {
        _bgPanFrameId = 0;
    }
}

export function startBgPan(dx, dy, zoomIn, zoomOut) {
    if (dx !== 0) _bgPanDir.dx = dx;
    if (dy !== 0) _bgPanDir.dy = dy;
    if (zoomIn) _bgPanDir.zoomIn = true;
    if (zoomOut) _bgPanDir.zoomOut = true;
    if (_bgPanFrameId === 0) {
        _bgPanFrameId = requestAnimationFrame(bgPanTick);
    }
}

export function stopBgPan(direction) {
    // direction: 'left' | 'right' | 'up' | 'down'
    switch (direction) {
        case 'right':  _bgPanDir.dx = Math.max(0, _bgPanDir.dx); break;
        case 'left': _bgPanDir.dx = Math.min(0, _bgPanDir.dx); break;
        case 'up':
            _bgPanDir.zoomIn = false;
            _bgPanDir.dy = Math.max(0, _bgPanDir.dy);
            break;
        case 'down':
            _bgPanDir.zoomOut = false;
            _bgPanDir.dy = Math.min(0, _bgPanDir.dy);
            break;
    }
    // If nothing active, clear frame id (next tick will stop)
    if (_bgPanDir.dx === 0 && _bgPanDir.dy === 0 && !_bgPanDir.zoomIn && !_bgPanDir.zoomOut) {
        if (_bgPanFrameId) {
            cancelAnimationFrame(_bgPanFrameId);
            _bgPanFrameId = 0;
        }
    }
    console.log('stop', direction, _bgPanDir);
}

// Reset pan dir on BG change
function resetBgPanDir() {
    _bgPanDir = { dx: 0, dy: 0, zoomIn: false, zoomOut: false };
    if (_bgPanFrameId) {
        cancelAnimationFrame(_bgPanFrameId);
        _bgPanFrameId = 0;
    }
}

export async function setBG(ctrl, image) {
    console.log('SetImage: ', !!image);
    resetBgPanDir();
    if (!image) {
        ctrl.image = null;
        _bgImageWidth = 0;
        _bgImageHeight = 0;
        _coverWidth = 0;
        _coverHeight = 0;
        _bgPanOffsetX = 0;
        _bgPanOffsetY = 0;
        _bgZoomLevel = 1;
        _bgBaseScale = 1;
        return;
    }
    ctrl.image = image;
    const w = image.width;
    const h = image.height;
    _bgBaseScale = Math.max(BG_VIEWPORT_W / w, BG_VIEWPORT_H / h);
    _coverWidth = w * _bgBaseScale;
    _coverHeight = h * _bgBaseScale;
    _bgZoomLevel = 1;
    _bgPanOffsetX = 0;
    _bgPanOffsetY = 0;
    ctrl.anchorX = 0.5;
    ctrl.anchorY = 0.5;
    applyBgTransform(ctrl);
    resetBgAutoRandomTimer();
}

export async function rndBG() {
    const ctrl = nodeMap.bg;
    if (!ctrl) return;
    try {
        const dir = altBGMode ? getAltBgPath() : getBgPath();
        const SaveFolder = (settings.basePath == 'romfs:/' ? 'sdmc:/' : '') + dir;
        const files = (await fs.listDir(SaveFolder))
              .filter(e => e.isFile && /\.png$/i.test(e.name) && !/_thumb\./i.test(e.name))
              .map(e => e.name);
        const pick = files[Math.random() * files.length | 0];
        if (!pick)
            return;
        setBG(ctrl, new Image(SaveFolder + '/' + pick));
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

let _musicRandomBgOnEnd = nrSettings.musicRandomBgOnEnd || false;
export function getMusicRandomBgOnEnd() { return _musicRandomBgOnEnd; }
export function setMusicRandomBgOnEnd(val) { _musicRandomBgOnEnd = !!val; }

let _bgAutoRandomInterval = nrSettings.bgAutoRandomInterval || 0;
let _bgAutoRandomTimer = null;
export function getBgAutoRandomInterval() { return _bgAutoRandomInterval; }
export function setBgAutoRandomInterval(val) {
    const newVal = Math.max(0, parseInt(val) || 0);
    if (newVal !== _bgAutoRandomInterval) {
        _bgAutoRandomInterval = newVal;
        restartBgAutoRandomTimer();
    }
}
export function resetBgAutoRandomTimer() {
    if (_bgAutoRandomInterval > 0 && _bgAutoRandomTimer !== null) {
        clearInterval(_bgAutoRandomTimer);
        _bgAutoRandomTimer = setInterval(() => rndBG(), _bgAutoRandomInterval * 1000);
    }
}
function restartBgAutoRandomTimer() {
    if (_bgAutoRandomTimer !== null) {
        clearInterval(_bgAutoRandomTimer);
        _bgAutoRandomTimer = null;
    }
    if (_bgAutoRandomInterval > 0) {
        _bgAutoRandomTimer = setInterval(() => rndBG(), _bgAutoRandomInterval * 1000);
    }
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
    rndBG();
}

// Re-export for consumer convenience
export { fontSmall, fontMedium, fontLarge, fontUltra, buttonRowY };
