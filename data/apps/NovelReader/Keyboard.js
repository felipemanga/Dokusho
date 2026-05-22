import { handleReaderKeyDown } from './ReaderView.js';
import { handleBooksKeyDown } from './BooksView.js';
import { handleSettingsKeyDown } from './SettingsView.js';
import { handleLlmKeyDown } from './LlmView.js';
import { handleImageGenKeyDown } from './ImageGenView.js';
import { handleControlsKeyDown } from './ControlsView.js';
import { handleMusicKeyDown } from './MusicView.js';
import { setAltMode, getAltMode } from './Shared.js';
import { refreshSettingsView } from './SettingsView.js';

export async function handleKeyUp(app, event) {
    const { key } = event;
    switch (key) {
    case 'x':
        setAltMode(false);
        break;
    }
}

export async function handleKeyDown(app, event) {
    const { key } = event;
    try {
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
        switch (key) {
        case 'Select':
            if (getAltMode()) {
                // X+Select: open music player
                app.pushState('music');
            } else if (app.state === 'settings') {
                app.popState();
            } else {
                refreshSettingsView(app);
                app.pushState('settings');
            }
            break;
        case 'x':
            setAltMode(true);
            break;
        }
    } catch (ex) {
        console.error(ex);
    }
}
