import { nodeMap, Group, Label, Button, RichText, ImageCtrl } from '../../utils/gui/GUI.js';
import { fontSmall, fontMedium, fontLarge, buttonRowY, palette,
    getMusicFolder, getMusicPlaylist, getMusicCurrentTrack, getMusicIsPlaying,
    getMusicIsShuffled, getMusicIsRepeating,
    setMusicPlaylist, setMusicCurrentTrack, setMusicIsPlaying,
    setMusicIsShuffled, setMusicIsRepeating, updateMusicTrackOrder,
    getNextTrackIndex, getPrevTrackIndex, getMusicFilePath,
    getMusicSound, setMusicSound, getMusicTrackOrder,
    saveNrSettings, getLlmEndpoint, getSdEndpoint, getBgPath, nrSettings,
    getAltMode } from './Shared.js';

// Icon size for transport buttons
const iconSize = 32;
const iconSizeLarge = 40;
const iconColor = 0x11000000;

const btnW = 37;
const btnStride = btnW + 15;

// Pre-generated icon images (set during init)
let _iconPrev = null;
let _iconPlay = null;
let _iconPause = null;
let _iconStop = null;
let _iconNext = null;
let _iconShuffle = null;
let _iconRepeat = null;
let _iconDelete = null;

function makeIcon(size, points) {
    const img = new Image(size, size);
    const nodes = [
        {
            id: 'bg',
            type: 'fillCircle',
            params: { image: img, x: size / 2, y: size / 2, radius: size / 2, color: 0xFFFFFFFF, antialias: true }
        }
    ];
    let lastId = 'bg';
    points.forEach((pts, i) => {
        const id = 'p' + i;
        nodes.push({
            id,
            type: 'polygon',
            params: {
                image: { node: lastId, output: 'image' },
                points: pts,
                color: iconColor
            }
        });
        lastId = id;
    });
    runGraph({
        nodes,
        pipelineOutputs: { image: { node: lastId, output: 'image' } }
    });
    return img;
}

function initTransportIcons() {
    // Previous: <<  (two left triangles, centered, wider)
    _iconPrev = makeIcon(iconSize, [
        [{ x: 12, y: 7 }, { x: 3, y: 16 }, { x: 12, y: 25 }],
        [{ x: 22, y: 7 }, { x: 13, y: 16 }, { x: 22, y: 25 }]
    ]);

    // Play: ▶ (right-pointing triangle, larger canvas, smaller shape)
    _iconPlay = makeIcon(iconSizeLarge, [
        [{ x: 13, y: 10 }, { x: 13, y: 30 }, { x: 29, y: 20 }]
    ]);

    // Pause: || (two vertical bars, larger canvas, smaller shape)
    _iconPause = makeIcon(iconSizeLarge, [
        [{ x: 13, y: 9 }, { x: 17, y: 9 }, { x: 17, y: 31 }, { x: 13, y: 31 }],
        [{ x: 23, y: 9 }, { x: 27, y: 9 }, { x: 27, y: 31 }, { x: 23, y: 31 }]
    ]);

    // Stop: square (smaller)
    _iconStop = makeIcon(iconSize, [
        [{ x: 9, y: 9 }, { x: 23, y: 9 }, { x: 23, y: 23 }, { x: 9, y: 23 }]
    ]);

    // Next: >>  (two right triangles, centered, wider)
    _iconNext = makeIcon(iconSize, [
        [{ x: 10, y: 7 }, { x: 19, y: 16 }, { x: 10, y: 25 }],
        [{ x: 19, y: 7 }, { x: 28, y: 16 }, { x: 19, y: 25 }]
    ]);

    // Shuffle: die face (5 diamonds in quincunx pattern)
    _iconShuffle = makeIcon(iconSize, [
        [{ x: 10, y: 7.17 }, { x: 12.83, y: 10 }, { x: 10, y: 12.83 }, { x: 7.17, y: 10 }],
        [{ x: 22, y: 7.17 }, { x: 24.83, y: 10 }, { x: 22, y: 12.83 }, { x: 19.17, y: 10 }],
        [{ x: 16, y: 13.17 }, { x: 18.83, y: 16 }, { x: 16, y: 18.83 }, { x: 13.17, y: 16 }],
        [{ x: 10, y: 19.17 }, { x: 12.83, y: 22 }, { x: 10, y: 24.83 }, { x: 7.17, y: 22 }],
        [{ x: 22, y: 19.17 }, { x: 24.83, y: 22 }, { x: 22, y: 24.83 }, { x: 19.17, y: 22 }]
    ]);

    // Repeat: two crossed arrows
    _iconRepeat = makeIcon(iconSize, [
        [{ x: 7, y: 10 }, { x: 22, y: 10 }, { x: 22, y: 13 }, { x: 7, y: 13 }],
        [{ x: 22, y: 8 }, { x: 26, y: 11.5 }, { x: 22, y: 15 }],
        [{ x: 9, y: 19 }, { x: 24, y: 19 }, { x: 24, y: 22 }, { x: 9, y: 22 }],
        [{ x: 10, y: 17 }, { x: 6, y: 20.5 }, { x: 10, y: 24 }]
    ]);

    // Delete: trash can (body + lid + handle)
    _iconDelete = makeIcon(iconSize, [
        [{ x: 9, y: 14 }, { x: 23, y: 14 }, { x: 23, y: 26 }, { x: 9, y: 26 }],
        [{ x: 7, y: 10 }, { x: 25, y: 10 }, { x: 25, y: 14 }, { x: 7, y: 14 }],
        [{ x: 13, y: 7 }, { x: 19, y: 7 }, { x: 19, y: 10 }, { x: 13, y: 10 }]
    ]);

    console.log('MusicView: transport icons initialized');
}

function applyTransportIcons() {
    if (!_iconPrev || !_iconPlay || !_iconPause || !_iconStop || !_iconNext || !_iconShuffle || !_iconRepeat || !_iconDelete) return;

    if (nodeMap.musicPrevIcon) nodeMap.musicPrevIcon.image = _iconPrev;
    if (nodeMap.musicPlayPauseIcon) nodeMap.musicPlayPauseIcon.image = _iconPlay;
    if (nodeMap.musicStopIcon) nodeMap.musicStopIcon.image = _iconStop;
    if (nodeMap.musicNextIcon) nodeMap.musicNextIcon.image = _iconNext;
    if (nodeMap.shuffleIcon) nodeMap.shuffleIcon.image = _iconShuffle;
    if (nodeMap.repeatIcon) nodeMap.repeatIcon.image = _iconRepeat;
    if (nodeMap.deleteIcon) nodeMap.deleteIcon.image = _iconDelete;
}

// Keep 3DS main loop running while music plays (prevents lid-close sleep blocking aptMainLoop)
function updateSleepPrevention() {
    if (typeof n3dsSetSleepAllowed === 'function') {
        n3dsSetSleepAllowed(!getMusicIsPlaying());
    }
}

const trackRowY = 8;
const trackRowH = 18;
const trackListY = 5;
const trackListHeight = 200;
const visibleRowCount = Math.floor(trackListHeight / trackRowH); // 11
const highlightY = 0;

// Music player state
let _isLoading = false;
let _tracksLoaded = false;
let _scrollOffset = 0; // first visible track index
let _selectedDisplayIdx = 0; // cursor position in the display order (trackOrder index)
let _rowPool = []; // fixed pool of Labels
let _selectionHighlight = null; // highlight box for cursor
let _playingHighlight = null; // highlight box for currently playing track
let _playbackPoller = null; // interval ID for checking sound end

export function createMusicView(app) {
    // Top screen: track list
    const topScreen = new Group({
        y: 0,
        x: 0,
        width: 400,
        height: 240,
        noFrame: true,
        children: [
            new Label({
                id: 'musicStatus',
                text: 'Loading tracks...',
                x: 10,
                y: trackListY,
                font: fontSmall,
                color: palette.textDim
            }),
            new Group({
                id: 'trackList',
                x: 5,
                y: trackListY + 20,
                width: 390,
                height: trackListHeight,
                overflow: 'hidden',
                backgroundColor: 0x22000000,
                children: []
            })
        ]
    });

    // Bottom screen: transport controls
    const bottomScreen = new Group({
        y: 240,
        width: 320,
        height: 240,
        noFrame: true,
        children: [
            // Current track info
            new Label({
                id: 'musicTrackInfo',
                text: 'No track selected',
                x: 10,
                y: 10,
                font: fontMedium,
                color: palette.textNormal
            }),
            // Shuffle/Repeat toggles (icon buttons)
            new ImageCtrl({
                id: 'shuffleIcon',
                x: 10,
                y: 40,
                width: iconSize,
                height: iconSize,
                onClick() { toggleShuffle(); }
            }),
            new ImageCtrl({
                id: 'repeatIcon',
                x: 52,
                y: 40,
                width: iconSize,
                height: iconSize,
                onClick() { toggleRepeat(); }
            }),
            // Delete selected track
            new ImageCtrl({
                id: 'deleteIcon',
                x: 94,
                y: 40,
                width: iconSize,
                height: iconSize,
                color: 0xFFFF4444,
                onClick() { deleteSelectedTrack(); }
            }),
            // Transport controls (polygon icon buttons, centered on 320px, centers at y=120)
            // prev(32) + gap(10) + play(40) + gap(10) + stop(32) + gap(10) + next(32) = 166, start=77
            new ImageCtrl({
                id: 'musicPrevIcon',
                x: 77,
                y: 104,
                width: iconSize,
                height: iconSize,
                onClick() { prevTrack(); }
            }),
            new ImageCtrl({
                id: 'musicPlayPauseIcon',
                x: 119,
                y: 100,
                width: iconSizeLarge,
                height: iconSizeLarge,
                onClick() { togglePlayPause(); }
            }),
            new ImageCtrl({
                id: 'musicStopIcon',
                x: 169,
                y: 104,
                width: iconSize,
                height: iconSize,
                onClick() { stopMusic(); }
            }),
            new ImageCtrl({
                id: 'musicNextIcon',
                x: 211,
                y: 104,
                width: iconSize,
                height: iconSize,
                onClick() { nextTrack(); }
            }),
            // Back button
            new Button({
                id: 'musicBack',
                text: 'Back',
                font: fontMedium,
                width: btnW,
                x: 320 - (btnStride) * 1,
                y: buttonRowY,
                onClick() { app.popState(); }
            }),
            // Title
            new Label({
                id: 'musicTitle',
                text: 'Music Player',
                x: 15,
                y: 220,
                font: fontLarge,
                color: palette.highlight
            })
        ]
    });

    const musicView = new Group({
        id: 'musicView',
        x: 0,
        y: 0,
        width: 400,
        height: 480,
        noFrame: true,
        visible: false,
        children: [topScreen, bottomScreen]
    });

    return musicView;
}

// ===== Module-level functions (accessible from handleMusicKeyDown) =====

export async function loadTracks() {
    if (_isLoading) return;

    // Initialize transport icons (synchronous)
    if (!_iconPrev) {
        initTransportIcons();
    }

    if (_tracksLoaded) {
        applyTransportIcons();
        updateTrackList();
        updateTrackInfo();
        return;
    }
    _isLoading = true;
    nodeMap.musicStatus.text = 'Loading tracks...';

    try {
        const folder = getMusicFolder();
        const basePath = settings.basePath == 'romfs:/' ? 'sdmc:/' : '';
        const fullPath = basePath + folder;

        console.log('Loading music from:', fullPath);
        const files = await fs.listDir(fullPath);
        const mp3Files = files
              .filter(e => e.isFile && /\.mp3$|\.opus$/i.test(e.name))
              .map(e => e.name)
              .sort((a, b) => a.localeCompare(b));

        console.log('Found', mp3Files.length, 'MP3 files');
        nodeMap.musicStatus.text = mp3Files.length + ' tracks found';
        setMusicPlaylist(mp3Files);
        updateMusicTrackOrder();
        _scrollOffset = 0;
        _selectedDisplayIdx = 0;
        const trackList = nodeMap.trackList;
        if (trackList) {
            trackList.clearChildren();
        }
        _rowPool = [];
        _selectionHighlight = null;
        _playingHighlight = null;
        applyTransportIcons();
        updateTrackList();
        updateTrackInfo();
    } catch (ex) {
        console.error('Failed to load music tracks:', ex);
        nodeMap.musicStatus.text = 'Error: ' + ex.message;
        setMusicPlaylist([]);
        _scrollOffset = 0;
        _selectedDisplayIdx = 0;
        const trackList = nodeMap.trackList;
        if (trackList) {
            trackList.clearChildren();
        }
        _rowPool = [];
        _selectionHighlight = null;
        _playingHighlight = null;
        updateTrackList();
    } finally {
        _isLoading = false;
        _tracksLoaded = true;
    }
}

function initRowPool() {
    const trackList = nodeMap.trackList;
    if (!trackList || _rowPool.length > 0) return;

    // Add highlight boxes first so they render behind labels
    _selectionHighlight = new Group({
        x: 5,
        y: trackRowY - trackRowH + highlightY,
        width: 380,
        height: trackRowH - 10,
        backgroundColor: 0x00000000,
        visible: false
    });
    trackList.addChild(_selectionHighlight);

    _playingHighlight = new Group({
        x: 5,
        y: trackRowY - trackRowH + highlightY,
        width: 380,
        height: trackRowH - 10,
        backgroundColor: 0x00000000,
        visible: false
    });
    trackList.addChild(_playingHighlight);

    // Create label pool
    for (let i = 0; i < visibleRowCount; i++) {
        const label = new Label({
            x: 5,
            y: trackRowY + i * trackRowH,
            font: fontLarge,
            color: palette.textNormal,
            text: ''
        });
        _rowPool.push(label);
        trackList.addChild(label);
    }
    console.log('MusicView: initialized row pool with', visibleRowCount, 'labels');
}

function renderVisibleRows() {
    const playlist = getMusicPlaylist();
    const currentTrack = getMusicCurrentTrack();
    const trackOrder = getMusicTrackOrder();
    const totalTracks = playlist.length;

    // Clamp scroll offset
    if (totalTracks <= visibleRowCount) {
        _scrollOffset = 0;
    } else {
        _scrollOffset = Math.max(0, Math.min(_scrollOffset, totalTracks - visibleRowCount));
    }

    // Clamp selection
    _selectedDisplayIdx = Math.max(0, Math.min(_selectedDisplayIdx, totalTracks - 1));

    // Track which display indices need highlights
    let highlightSelectedY = -1;
    let highlightPlayingY = -1;

    for (let i = 0; i < visibleRowCount; i++) {
        const label = _rowPool[i];
        const listIdx = _scrollOffset + i;
        const y = trackRowY + i * trackRowH;

        if (listIdx >= totalTracks) {
            label.visible = false;
            label.text = '';
            continue;
        }

        label.visible = true;
        label.y = y - 8;
        const trackIdx = trackOrder[listIdx];
        const fileName = playlist[trackIdx];
        const displayName = fileName
              .replace(/[【】「」『』'"＂|]|\.\s+|\.mp3|.mkv|\.opus|\.mp4|\.webm|\[[a-z0-9_\-]{8,11}\]/ig, ' ')
              .replace(/\(.*?(?:official|music|audio|video|lyrics).*?\)/ig, '')
              .replace(/[_\s]+/g, ' ')
              .trim()
              .substr(0, 55);
        const isSelected = listIdx === _selectedDisplayIdx;
        const isPlaying = trackIdx === currentTrack && currentTrack >= 0;

        if (isSelected) {
            label.color = palette.textBright;
            highlightSelectedY = y;
        } else if (isPlaying) {
            label.color = palette.textNormal;
            highlightPlayingY = y;
        } else {
            label.color = palette.textNormal;
        }

        label.text = displayName;

        // Capture the trackIdx for click handler
        const capturedIdx = trackIdx;
        label.onClick = function() {
            playTrack(capturedIdx);
        };
    }

    // Position selection highlight
    if (_selectionHighlight) {
        if (highlightSelectedY >= 0) {
            _selectionHighlight.y = highlightSelectedY + highlightY;
            _selectionHighlight.backgroundColor = palette.highlight & 0x33FFFFFF;
            _selectionHighlight.visible = true;
        } else {
            _selectionHighlight.visible = false;
        }
    }

    // Position playing highlight
    if (_playingHighlight) {
        if (highlightPlayingY >= 0) {
            _playingHighlight.y = highlightPlayingY + highlightY;
            _playingHighlight.backgroundColor = palette.contrast;
            _playingHighlight.visible = true;
        } else {
            _playingHighlight.visible = false;
        }
    }
}

function updateTrackList() {
    initRowPool();
    renderVisibleRows();
}

function ensureCurrentTrackVisible() {
    const currentTrack = getMusicCurrentTrack();
    const playlist = getMusicPlaylist();
    const trackOrder = getMusicTrackOrder();

    if (currentTrack < 0 || currentTrack >= playlist.length) return;

    // Find the display position of the current track in the ordered list
    let displayIdx = -1;
    for (let i = 0; i < trackOrder.length; i++) {
        if (trackOrder[i] === currentTrack) {
            displayIdx = i;
            break;
        }
    }

    if (displayIdx < 0) return;

    // Adjust scroll offset so current track is visible
    if (displayIdx < _scrollOffset) {
        _scrollOffset = displayIdx;
    } else if (displayIdx >= _scrollOffset + visibleRowCount) {
        _scrollOffset = displayIdx - visibleRowCount + 1;
    }
    renderVisibleRows();
}

function updateTrackInfo() {
    const info = nodeMap.musicTrackInfo;
    if (!info) return;

    const currentTrack = getMusicCurrentTrack();
    const isPlaying = getMusicIsPlaying();
    const isShuffled = getMusicIsShuffled();
    const isRepeating = getMusicIsRepeating();
    const playlist = getMusicPlaylist();

    if (currentTrack < 0 || currentTrack >= playlist.length) {
        info.text = 'No track selected';
    } else {
        const fileName = playlist[currentTrack].replace(/\.mp3$/i, '');
        let status = fileName;
        if (isPlaying) status += ' Playing';
        else status += ' Paused';
        if (isShuffled) status += ' | Shuffle';
        if (isRepeating) status += ' | Repeat';
        info.text = status;
    }

    // Update shuffle/repeat icon colors
    const shuffleIcon = nodeMap.shuffleIcon;
    if (shuffleIcon) {
        shuffleIcon.color = isShuffled ? 0xFFFFFFFF : 0x44FFFFFF;
    }
    const repeatIcon = nodeMap.repeatIcon;
    if (repeatIcon) {
        repeatIcon.color = isRepeating ? 0xFFFFFFFF : 0x44FFFFFF;
    }

    // Update play/pause icon
    const playPauseIcon = nodeMap.musicPlayPauseIcon;
    if (playPauseIcon) {
        playPauseIcon.image = isPlaying ? _iconPause : _iconPlay;
    }
}

// ===== Playback Control =====

function startPlaybackPoller() {
    stopPlaybackPoller();
    _playbackPoller = setInterval(() => {
        const sound = getMusicSound();
        const isPlaying = getMusicIsPlaying();
        if (isPlaying && sound && !sound.isPlaying) {
            onTrackEnded();
        }
    }, 500);
}

function stopPlaybackPoller() {
    if (_playbackPoller) {
        clearInterval(_playbackPoller);
        _playbackPoller = null;
    }
}

function onTrackEnded() {
    const isRepeating = getMusicIsRepeating();
    const isShuffled = getMusicIsShuffled();
    const currentTrack = getMusicCurrentTrack();

    if (isRepeating) {
        // Replay the same track
        console.log('Repeat: replaying track', currentTrack);
        playTrack(currentTrack);
    } else if (isShuffled) {
        // Play a random track
        const playlist = getMusicPlaylist();
        const randomIdx = Math.floor(Math.random() * playlist.length);
        console.log('Shuffle: playing random track', randomIdx);
        playTrack(randomIdx);
    } else {
        // Play next track in order
        const nextIdx = getNextTrackIndex();
        if (nextIdx >= 0) {
            console.log('Playing next track:', nextIdx);
            playTrack(nextIdx);
        } else {
            console.log('End of playlist');
            setMusicIsPlaying(false);
            updateSleepPrevention();
            stopPlaybackPoller();
            updateTrackInfo();
        }
    }
}

function playTrack(trackIndex) {
    if (trackIndex < 0 || trackIndex >= getMusicPlaylist().length) return;

    // Stop current track if playing
    stopCurrentTrack();

   setMusicCurrentTrack(trackIndex);
        setMusicIsPlaying(true);
        updateSleepPrevention();

        const filePath = getMusicFilePath(trackIndex);

        try {
            const sound = new Sound(filePath);
            sound.play();
            setMusicSound(sound);
            startPlaybackPoller();
        } catch (ex) {
            console.error('Failed to play track:', ex);
            setMusicIsPlaying(false);
            updateSleepPrevention();
        }

    // Sync selection to the playing track
    const trackOrder = getMusicTrackOrder();
    for (let i = 0; i < trackOrder.length; i++) {
        if (trackOrder[i] === trackIndex) {
            _selectedDisplayIdx = i;
            break;
        }
    }
    ensureCurrentTrackVisible();
    updateTrackInfo();
}

function togglePlayPause() {
    const playlist = getMusicPlaylist();
    if (playlist.length === 0) return;

    const isPlaying = getMusicIsPlaying();
    const currentTrack = getMusicCurrentTrack();
    const trackOrder = getMusicTrackOrder();
    const selectedTrack = trackOrder[_selectedDisplayIdx];

    // Selected track is the one currently playing: toggle pause/resume
    if (selectedTrack === currentTrack) {
          if (isPlaying) {
            const sound = getMusicSound();
            if (sound) sound.stop();
            setMusicIsPlaying(false);
            updateSleepPrevention();
            stopPlaybackPoller();
            renderVisibleRows();
        } else {
            setMusicIsPlaying(true);
            updateSleepPrevention();
            const filePath = getMusicFilePath(currentTrack);
            try {
                const sound = new Sound(filePath);
                sound.play();
                setMusicSound(sound);
                startPlaybackPoller();
            } catch (ex) {
                console.error('Failed to resume track:', ex);
                setMusicIsPlaying(false);
                updateSleepPrevention();
            }
        }
        updateTrackInfo();
        return;
    }

    // Selected track is different: stop current, play selected
    playTrack(selectedTrack);
}

function stopMusic() {
    stopPlaybackPoller();
    stopCurrentTrack();
  setMusicCurrentTrack(-1);
        setMusicIsPlaying(false);
        updateSleepPrevention();
        renderVisibleRows();
    updateTrackInfo();
}

function stopCurrentTrack() {
    const sound = getMusicSound();
    if (sound) {
        sound.stop();
        setMusicSound(null);
    }
}

function nextTrack() {
    const nextIdx = getNextTrackIndex();
    if (nextIdx >= 0) {
        playTrack(nextIdx);
    }
}

function prevTrack() {
    const prevIdx = getPrevTrackIndex();
    if (prevIdx >= 0) {
        playTrack(prevIdx);
    }
}

async function toggleShuffle() {
    const newShuffled = !getMusicIsShuffled();
    setMusicIsShuffled(newShuffled);
    updateMusicTrackOrder();
    _scrollOffset = 0;
    _selectedDisplayIdx = 0;
    renderVisibleRows();
    updateTrackInfo();
    await saveNrSettings(getLlmEndpoint(), getSdEndpoint(), getBgPath(), nrSettings.altBgPath);
}

async function toggleRepeat() {
    const newRepeating = !getMusicIsRepeating();
    setMusicIsRepeating(newRepeating);
    updateTrackInfo();
    await saveNrSettings(getLlmEndpoint(), getSdEndpoint(), getBgPath(), nrSettings.altBgPath);
}

async function deleteSelectedTrack() {
    const playlist = getMusicPlaylist();
    if (playlist.length === 0) return;

    const trackOrder = getMusicTrackOrder();
    const selectedTrackIdx = trackOrder[_selectedDisplayIdx];
    if (selectedTrackIdx < 0 || selectedTrackIdx >= playlist.length) return;

    const filePath = getMusicFilePath(selectedTrackIdx);
    const currentTrack = getMusicCurrentTrack();

    console.log('MusicView: deleting track', selectedTrackIdx, filePath);

    // Stop playback if deleting currently playing track
    if (selectedTrackIdx === currentTrack) {
        stopPlaybackPoller();
        stopCurrentTrack();
        setMusicCurrentTrack(-1);
        setMusicIsPlaying(false);
        updateSleepPrevention();
    }

    try {
        await fs.deleteFile(filePath);
        console.log('MusicView: file deleted successfully');
    } catch (ex) {
        console.error('MusicView: failed to delete file:', ex);
        return;
    }

    // Remove from playlist
    const [removed] = playlist.splice(selectedTrackIdx, 1);
    console.log('MusicView: removed from playlist:', removed);

    // Fix up currentTrack index (shift down if it was after the deleted track)
    if (currentTrack > selectedTrackIdx) {
        setMusicCurrentTrack(currentTrack - 1);
    } else if (currentTrack === selectedTrackIdx) {
        // Already handled above
    }

    // Fix up selection index
    if (_selectedDisplayIdx >= playlist.length) {
        _selectedDisplayIdx = Math.max(0, playlist.length - 1);
    }

    // Rebuild track order
    updateMusicTrackOrder();

    // Re-render
    updateTrackList();
    updateTrackInfo();

    // Update status
    if (nodeMap.musicStatus) {
        nodeMap.musicStatus.text = playlist.length + ' tracks found';
    }
}

export async function handleMusicKeyDown(app, event) {
    const { key } = event;
    switch (key) {
    case 'ArrowUp':
        scrollTrackList(getAltMode() ? -visibleRowCount : -1);
        break;
    case 'ArrowDown':
        scrollTrackList(getAltMode() ? visibleRowCount : 1);
        break;
    case 'a':
        const { rndBG } = await import('./Shared.js');
        rndBG(nodeMap.bg);
        break;
    case 'b':
        toggleRepeat();
        break;
    case 'y':
        toggleShuffle();
        break;
    case 'l':
        prevTrack();
        break;
    case 'r':
        nextTrack();
        break;
    case 'ZLeft':
        togglePlayPause();
        break;
    case 'ZRight':
        stopMusic();
        break;
    case 'Select':
        if (getMusicPlaylist().length > 0) {
            const trackOrder = getMusicTrackOrder();
            const selectedIdx = trackOrder[_selectedDisplayIdx];
            if (selectedIdx >= 0) {
                playTrack(selectedIdx);
            }
        }
        break;
    }
}

function scrollTrackList(delta) {
    const playlist = getMusicPlaylist();
    const totalTracks = playlist.length;
    if (totalTracks === 0) return;

    // Move selection
    _selectedDisplayIdx += delta;
    _selectedDisplayIdx = Math.max(0, Math.min(_selectedDisplayIdx, totalTracks - 1));

    // Scroll only if selection goes off screen
    if (_selectedDisplayIdx < _scrollOffset) {
        _scrollOffset = _selectedDisplayIdx;
    } else if (_selectedDisplayIdx >= _scrollOffset + visibleRowCount) {
        _scrollOffset = _selectedDisplayIdx - visibleRowCount + 1;
    }
    renderVisibleRows();
}
