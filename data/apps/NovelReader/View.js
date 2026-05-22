import { nodeMap, Root, Group, ImageCtrl } from '../../utils/gui/GUI.js';
import GUI from '../../utils/gui/GUI.js';
import { loadNrSettings, applyPalette, palettes, setPalette, rndBG, nrSettings, getAutoTranslateMode } from './Shared.js';
import { createBooksView } from './BooksView.js';
import { createReaderView } from './ReaderView.js';
import { createSettingsView } from './SettingsView.js';
import { createControlsView } from './ControlsView.js';
import { createLlmView, updateTranslationProgress, updateMetadataDisplay } from './LlmView.js';
import { createImageGenView } from './ImageGenView.js';
import { createMusicView } from './MusicView.js';
import { updateLineDisplay, updateTopDisplay, buildLineSegments } from './ReaderView.js';
import { handleKeyDown, handleKeyUp } from './Keyboard.js';
import { loadChapterBG } from './Shared.js';

export async function NovelReaderView(app) {
    const window = new Window(400, 480);
    window.backgroundColor = 0xFF555588 >>> 0;

    // Load persisted settings before building UI
    await loadNrSettings();
    let pal = palettes[nrSettings.paletteIndex || 0];
    setPalette(pal?.bg, pal?.text, pal?.hl);

    new Root({
        window,
        children: [
            new Group({
                noFrame: true,
                width: 400,
                height: 240,
                children: [
                    new ImageCtrl({
                        floating: true,
                        id: 'bg'
                    }),
                ]
            }),
            createBooksView(app),
            createReaderView(app),
            createSettingsView(app),
            createControlsView(app),
            createLlmView(app),
            createImageGenView(app),
            createMusicView(app)
        ]
    });

    // Apply saved palette now that window exists
    applyPalette(nrSettings.paletteIndex || 0, window);

    // Pass auto-translate mode to model
    app.model.autoTranslateMode = getAutoTranslateMode();

    rndBG(nodeMap.bg);

    // Wire up model events
    app.model.addEventListener('bookOpened', () => {
        console.log('Book opened:', app.model.currentBook, 'ch', app.model.currentChapter);
        updateTopDisplay(app);
        updateLineDisplay(app);
    });

    app.model.addEventListener('chapterLoaded', () => {
        updateTopDisplay(app);
        loadChapterBG(nodeMap.bg, app.model.currentBook, app.model.currentChapter);
    });

    app.model.addEventListener('lineChanged', () => {
        updateTopDisplay(app);
        updateLineDisplay(app);
    });

    app.model.addEventListener('wordChanged', () => {
        updateTopDisplay(app);
        // Re-render line to update highlight (only when Japanese is active)
        if (!app.model.showEnglish) {
            const line = app.model.getCurrentLine();
            if (line) {
                const segments = buildLineSegments(line, app.model.currentWord);
                if (segments) {
                    nodeMap.activeLine.segments = segments;
                }
            }
        }
    });

    app.model.addEventListener('translationProgress', () => {
        updateTranslationProgress(app);
    });

    app.model.addEventListener('lineTranslated', () => {
        updateTopDisplay(app);
        updateLineDisplay(app);

        // Proactively translate next line in line mode
        if (app.model.autoTranslateMode === 'line') {
            const nextLine = app.model.currentLine + 1;
            setTimeout(() => {
                app.model.translateLineAt(nextLine).catch(err => {
                    console.error('Ahead translation error:', err);
                });
            }, 100);
        }
    });

    app.model.addEventListener('metadataUpdated', () => {
        updateMetadataDisplay(app).catch(ex => console.error('updateMetadataDisplay error:', ex));
    });

    // Keyboard navigation
    GUI.addEventListener('keydown', (event) => handleKeyDown(app, event));
    GUI.addEventListener('keyup', (event) => handleKeyUp(app, event));

    app.init({ view: nodeMap, window });
}
