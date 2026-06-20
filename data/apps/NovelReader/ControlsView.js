import { nodeMap, Group, Label, Button } from '../../utils/gui/GUI.js';
import { fontSmall, fontMedium, fontLarge, buttonRowY, palettes, getCurrentPaletteIndex, palette } from './Shared.js';

export function createControlsView(app) {
    const rowH = 18;
    const keyW = 80;
    const keyX = 20;
    const descX = keyX + keyW + 10;

    const controls = [
        // Reader keyboard
        { section: 'Reader' },
        { key: 'Arrow Up',   desc: 'Previous line' },
        { key: 'Arrow Down', desc: 'Next line' },
        { key: 'Arrow Left', desc: 'Previous word' },
        { key: 'Arrow Right',desc: 'Next word' },
        { key: 'L+Up',       desc: 'Previous chapter' },
        { key: 'L+Down',     desc: 'Next chapter' },
        { key: 'Y',          desc: 'Toggle English / Japanese' },
        { key: 'L+Y',        desc: 'Toggle dictionary overlay' },
        { key: 'B',          desc: 'Back to book library' },
        { section: null },
        // Book Library
        { section: 'Book Library' },
        { key: 'Arrow Up',   desc: 'Select previous book' },
        { key: 'Arrow Down', desc: 'Select next book' },
        { key: 'A',          desc: 'Open selected book' },
        { section: null },
        // Music Player
       { section: 'Music Player' },
        { key: 'A',          desc: 'Play / Pause' },
        { key: 'Y',          desc: 'Toggle shuffle' },
        { key: 'L+Y',        desc: 'Toggle track list overlay' },
        { key: 'B',          desc: 'Toggle repeat' },
        { key: 'Arrow Up',   desc: 'Scroll track list up' },
        { key: 'Arrow Down', desc: 'Scroll track list down' },
        { key: 'L+Up/Down',  desc: 'Page scroll track list' },
        { key: 'Arrow Left', desc: 'Seek back 10%' },
        { key: 'Arrow Right',desc: 'Seek forward 10%' },
        { section: null },
        // Settings
        { section: 'Settings' },
        { key: 'A',          desc: 'Save and close' },
        { section: null },
        // Image Gen
        { section: 'Image Gen' },
        { key: 'A',          desc: 'Generate image' },
        { key: 'B',          desc: 'Back to reader' },
        { section: null },
        // Global (all views)
        { section: 'Global' },
        { key: 'X',          desc: 'Random background' },
        { key: 'L+X',        desc: 'Random background (alt path)' },
        { key: 'Select',     desc: 'Open / close settings' },
        { key: 'L+Select',   desc: 'Open music player' },
        { key: 'L+ZL',       desc: 'Play / Pause music' },
        { key: 'L+ZR',       desc: 'Previous track' },
        { key: 'L+R',        desc: 'Next track' },
        { key: 'Stick L/R',    desc: 'Pan background left/right' },
        { key: 'Stick U/D',    desc: 'Pan background up/down' },
        { key: 'L+Stick U/D',  desc: 'Zoom background in/out' },
        { section: ' ' },
    ];

    const children = [];
    let y = 10;

    for (const ctrl of controls) {
        if (ctrl.section !== null && ctrl.section !== undefined) {
            children.push(
                new Label({
                    text: ctrl.section,
                    x: 15,
                    y: y,
                    font: fontSmall,
                    color: palette.highlight
                })
            );
            y += rowH;
        } else if (ctrl.key) {
            children.push(
                new Label({
                    text: ctrl.key,
                    x: keyX,
                    y: y,
                    width: keyW,
                    font: fontSmall,
                    color: palette.textBright
                }),
                new Label({
                    text: ctrl.desc,
                    x: descX,
                    y: y,
                    font: fontSmall,
                    color: palette.textDim
                })
            );
            y += rowH;
        } else {
            y += 5; // blank spacer
        }
    }

    return new Group({
        id: 'controlsView',
        y: 240,
        width: 320,
        height: 240,
        noFrame: true,
        visible: false,
        children: [
            new Group({
                x: 10,
                y: 10,
                width: 300,
                height: 200,
                overflow: 'scroll',
                backgroundColor: 0x22000000,
                children
            }),
            new Label({
                text: 'Controls',
                x: 15,
                y: 220,
                font: fontLarge,
                color: palettes[getCurrentPaletteIndex()].hl
            }),
            new Button({
                x: 260,
                y: buttonRowY,
                font: fontMedium,
                text: 'Back',
                onClick() { app.popState(); }
            })
        ]
    });
}

export async function handleControlsKeyDown(app, event) {
    const { key } = event;
    switch (key) {
    case 'b':
        app.popState();
        break;
    }
}
