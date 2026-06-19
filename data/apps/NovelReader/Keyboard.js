import { nodeMap } from '../../utils/gui/GUI.js';
import { handleReaderKeyDown } from './ReaderView.js';
import { handleBooksKeyDown } from './BooksView.js';
import { handleSettingsKeyDown } from './SettingsView.js';
import { handleLlmKeyDown } from './LlmView.js';
import { handleImageGenKeyDown } from './ImageGenView.js';
import { handleControlsKeyDown } from './ControlsView.js';
import { handleMusicKeyDown, togglePlayPause, prevTrack, nextTrack } from './MusicView.js';
import { setAltMode, getAltMode, rndBG, startBgPan, stopBgPan, BG_PAN_SPEED } from './Shared.js';

export async function handleKeyUp(app, event) {
    const { key } = event;
    switch (key) {
    case 'l':
        setAltMode(false);
        break;
    case 'StickLeft':
        stopBgPan('left');
        break;
    case 'StickRight':
        stopBgPan('right');
        break;
    case 'StickUp':
        stopBgPan('up');
        break;
    case 'StickDown':
        stopBgPan('down');
        break;
    }
}

export async function handleKeyDown(app, event) {
    const { key } = event;
    try {
        // State-specific handlers
        switch (app.state) {
        case 'reader':
            handleReaderKeyDown(app, event);
            break;
        case 'books':
            handleBooksKeyDown(app, event);
            break;
        case 'settings':
            handleSettingsKeyDown(app, event);
            break;
        case 'music':
            handleMusicKeyDown(app, event);
            break;
        case 'llm':
            handleLlmKeyDown(app, event);
            break;
        case 'imageGen':
            handleImageGenKeyDown(app, event);
            break;
        case 'controls':
            handleControlsKeyDown(app, event);
            break;
        }

        // Global handlers (all states)
        switch (key) {
        case 'Select':
            if (getAltMode()) {
                // L+Select: open music player
                app.pushState('music');
            } else if (app.state === 'settings') {
                app.popState();
            } else {
                app.pushState('settings');
            }
            break;
        case 'l':
            setAltMode(true);
            break;
        case 'x':
            await rndBG(nodeMap.bg);
            break;
        case 'ZLeft':
            if (getAltMode()) {
                togglePlayPause();
            }
            break;
        case 'ZRight':
            if (getAltMode()) {
                prevTrack();
            }
            break;
        case 'r':
            if (getAltMode()) {
                nextTrack();
            }
            break;
        // BG pan/zoom via stick (continuous via rAF, all states)
        case 'StickLeft':
            startBgPan(BG_PAN_SPEED, 0, false, false);
            break;
        case 'StickRight':
            startBgPan(-BG_PAN_SPEED, 0, false, false);
            break;
        case 'StickUp':
            if (getAltMode()) startBgPan(0, 0, true, false);
            else startBgPan(0, BG_PAN_SPEED, false, false);
            break;
        case 'StickDown':
            if (getAltMode()) startBgPan(0, 0, false, true);
            else startBgPan(0, -BG_PAN_SPEED, false, false);
            break;
        }
    } catch (ex) {
        console.error(ex);
    }
}
