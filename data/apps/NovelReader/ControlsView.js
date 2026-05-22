import { nodeMap, Group, Label, Button } from '../../utils/gui/GUI.js';
import { fontSmall, fontMedium, fontLarge, buttonRowY, palettes, getCurrentPaletteIndex, palette } from './Shared.js';

export function createControlsView(app) {
    const rowH = 18;
    const keyW = 80;
    const keyX = 20;
    const descX = keyX + keyW + 10;

    const controls = [
        // Reader keyboard
        { section: 'Reader - Buttons' },
        { key: 'Arrow Up',   desc: 'Previous line' },
        { key: 'Arrow Down', desc: 'Next line' },
        { key: 'Arrow Left', desc: 'Previous word' },
        { key: 'Arrow Right',desc: 'Next word' },
        { key: 'L',          desc: 'Page up (10 lines)' },
        { key: 'R',          desc: 'Page down (10 lines)' },
        { key: 'X+L',        desc: 'Decrease font size' },
        { key: 'X+R',        desc: 'Increase font size' },
        { key: 'ZL',         desc: 'Previous chapter' },
        { key: 'ZR',         desc: 'Next chapter' },
        { key: 'A',          desc: 'Change background' },
        { key: 'B',          desc: 'Book library' },
        { key: 'Y',          desc: 'Toggle English / Japanese' },
        { key: 'X+Y',        desc: 'Toggle Dictionary' },
        { key: 'X+A',        desc: 'Change background Alt' },
        { section: null },
        // Image Gen
        { section: 'Image Gen' },
        { key: 'A',          desc: 'Generate image' },
        { key: 'B',          desc: 'Back to reader' },
        { section: null },
        // Music Player
        { section: 'Music Player' },
        { key: 'X+Select',   desc: 'Open music player' },
        { key: 'A',          desc: 'Play / Pause' },
        { key: 'B',          desc: 'Back to previous view' },
        { key: 'X',          desc: 'Stop playback' },
        { key: 'Y',          desc: 'Next track' },
        { key: 'L',          desc: 'Previous track' },
        { key: 'R',          desc: 'Toggle shuffle' },
        { key: 'ZL',         desc: 'Toggle repeat' },
        { key: 'Arrows',     desc: 'Scroll track list' },
        { section: null },
        // Global
        { section: 'Global' },
        { key: 'Select',     desc: 'Open / close settings' },
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
