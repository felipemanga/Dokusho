import { nodeMap, Group, Label, Button, TextInput } from '../../utils/gui/GUI.js';
import { fontSmall, fontMedium, fontLarge, buttonRowY, palettes, palette,
    getTextFontSize, setTextFontSize, getTextFont,
    getAutoTranslateMode, setAutoTranslateMode,
    getCurrentPaletteIndex,
    saveNrSettings, getLlmEndpoint, getSdEndpoint, getBgPath,
    applyPalette, getMusicFolder, setMusicFolder,
    getMusicRandomBgOnEnd, setMusicRandomBgOnEnd,
    getBgAutoRandomInterval, setBgAutoRandomInterval } from './Shared.js';
import { nrSettings } from './Shared.js';

export function createSettingsView(app) {
    const rowOffY = 5;
    const rowH = 32;
    const labelW = 110;
    const inputX = 105;
    const inputW = 195;

    const children = [
        // LLM Endpoint
        new Label({
            text: 'LLM Endpoint:',
            x: 10,
            y: rowOffY,
            font: fontSmall,
            color: palette.textDim
        }),
        new TextInput({
            id: 'settingsLlmEndpoint',
            floating: true,
            x: inputX,
            y: rowOffY,
            width: inputW,
            font: fontSmall,
            placeholder: '(use default)'
        }),
        // SD Endpoint
        new Label({
            text: 'SD Endpoint:',
            x: 10,
            y: rowOffY + rowH,
            font: fontSmall,
            color: palette.textDim
        }),
        new TextInput({
            id: 'settingsSdEndpoint',
            floating: true,
            x: inputX,
            y: rowOffY + rowH,
            width: inputW,
            font: fontSmall,
            placeholder: '(use default)'
        }),
        // Background Path
        new Label({
            text: 'Backgrounds:',
            x: 10,
            y: rowOffY + rowH * 2,
            font: fontSmall,
            color: palette.textDim
        }),
        new TextInput({
            id: 'settingsBgPath',
            floating: true,
            x: inputX,
            y: rowOffY + rowH * 2,
            width: inputW,
            font: fontSmall,
            placeholder: '(use default)'
        }),
        // Alt Background path
        new Label({
            text: 'Backgrounds 2:',
            x: 10,
            y: rowOffY + rowH * 3,
            font: fontSmall,
            color: palette.textDim
        }),
        new TextInput({
            id: 'settingsAltBgPath',
            floating: true,
            x: inputX,
            y: rowOffY + rowH * 3,
            width: inputW,
            font: fontSmall,
            placeholder: '(default: DeltaAI)'
        }),
        // Palette selection
        new Label({
            text: 'Palette:',
            x: 10,
            y: rowOffY + rowH * 4,
            font: fontSmall,
            color: palette.textDim
        }),
    ];

    // Palette buttons
    const paletteBtnW = 30;
    const paletteBtnH = rowH - 15;
    const paletteBtnY = rowOffY + 5 + rowH * 4;
    const paletteBtns = [];
    for (let i = 0; i < palettes.length; i++) {
        const pi = i;
        const btn = new Group({
            id: 'paletteBtn' + i,
            x: inputX + i * (paletteBtnW + 15),
            y: paletteBtnY,
            width: paletteBtnW,
            height: paletteBtnH,
            font: fontSmall,
            backgroundColor: (palettes[i].bg & 0xFFFFFF) | 0xFF000000,
            onClick() {
                applyPalette(pi, app.window);
                updateSettingsPaletteButtons();
            }
        });
        paletteBtns.push(btn);
        children.push(btn);
    }

    // Font Size
    const fontRowY = paletteBtnY + rowH;
    children.push(
        new Label({
            text: 'Font Size:',
            x: 10,
            y: fontRowY,
            font: fontSmall,
            color: palette.textDim
        }),
        new Button({
            id: 'settingsFontMinus',
            x: inputX,
            y: fontRowY,
            width: 30,
            font: fontMedium,
            text: ' - ',
            onClick() {
                const newSize = Math.max(10, getTextFontSize() - 2);
                setTextFontSize(newSize);
                nodeMap.settingsFontSize.text = newSize + 'px';
                if (nodeMap.activeLine) nodeMap.activeLine.attrs.font = getTextFont();
            }
        }),
        new Label({
            id: 'settingsFontSize',
            text: getTextFontSize() + 'px',
            x: inputX + 40,
            y: fontRowY,
            font: fontMedium,
            color: palette.textNormal
        }),
        new Button({
            id: 'settingsFontPlus',
            x: inputX + 90,
            y: fontRowY,
            width: 30,
            font: fontMedium,
            text: ' + ',
            onClick() {
                const newSize = Math.min(48, getTextFontSize() + 2);
                setTextFontSize(newSize);
                nodeMap.settingsFontSize.text = newSize + 'px';
                if (nodeMap.activeLine) nodeMap.activeLine.attrs.font = getTextFont();
            }
        })
    );

    // Auto Translate mode
    const autoTransRowY = fontRowY + rowH;
    const autoTransModes = ['off', 'line', 'chapter'];
    const autoTransLabels = { off: 'Off', line: 'Line', chapter: 'Chapter' };
    const autoTransBtnW = 45;
    const autoTransBtnH = rowH - 12;
    const autoTransBtnY = autoTransRowY + 5;

    children.push(
        new Label({
            text: 'Auto Translate:',
            x: 10,
            y: autoTransRowY,
            font: fontSmall,
            color: palette.textDim
        })
    );

    for (let i = 0; i < autoTransModes.length; i++) {
        const mode = autoTransModes[i];
        const btn = new Group({
            id: 'autoTransBtn' + mode,
            x: inputX + i * (autoTransBtnW + 13),
            y: autoTransBtnY,
            width: autoTransBtnW,
            height: autoTransBtnH,
            backgroundColor: palette.contrast,
            children: [
                new Label({
                    text: autoTransLabels[mode],
                    x: 5,
                    y: 3,
                    width: autoTransBtnW - 10,
                    font: fontSmall,
                    color: palette.textNormal,
                    textAlign: 'center'
                })
            ],
            onClick() {
                setAutoTranslateMode(mode);
                updateAutoTransButtons();
                console.log('Auto translate mode:', getAutoTranslateMode());
            }
        });
        children.push(btn);
    }

    // Music Folder
    const musicRowY = autoTransRowY + rowH + 10;
    children.push(
        new Label({
            text: 'Music Folder:',
            x: 10,
            y: musicRowY,
            font: fontSmall,
            color: palette.textDim
        }),
        new TextInput({
            id: 'settingsMusicFolder',
            floating: true,
            x: inputX,
            y: musicRowY,
            width: inputW,
            font: fontSmall,
            placeholder: 'Novels/music'
        })
    );

    // Random Background on Music End
    const randomBgRowY = musicRowY + rowH;
    children.push(
        new Label({
            text: 'Random BG on end:',
            x: 10,
            y: randomBgRowY,
            font: fontSmall,
            color: palette.textDim
        }),
        new Group({
            id: 'randomBgBtn',
            x: inputX,
            y: randomBgRowY + 5,
            width: 45,
            height: rowH - 12,
            backgroundColor: palette.contrast,
            children: [
                new Label({
                    id: 'randomBgLabel',
                    text: 'Off',
                    x: 5,
                    y: 3,
                    width: 35,
                    font: fontSmall,
                    color: palette.textNormal,
                    textAlign: 'center'
                })
            ],
            onClick() {
                const newVal = !getMusicRandomBgOnEnd();
                setMusicRandomBgOnEnd(newVal);
                updateRandomBgButton();
            }
        }),
        new Label({
            text: 'Auto random (s):',
            x: 10,
            y: randomBgRowY + rowH,
            font: fontSmall,
            color: palette.textDim
        }),
        new TextInput({
            id: 'settingsBgAutoRandom',
            floating: true,
            numericOnly: true,
            x: inputX,
            y: randomBgRowY + rowH,
            width: 60,
            font: fontSmall,
            placeholder: '0=off'
        })
    );

    children.push(
        new Group({ // end spacer
            x: 0,
            y: randomBgRowY + rowH * 2,
            noFrame: true
        })
    );

    const settingsView = new Group({
        id: 'settingsView',
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
            // Title
            new Label({
                text: 'Settings',
                x: 15,
                y: 220,
                font: fontLarge,
                color: palettes[getCurrentPaletteIndex()].hl
            }),
            new Button({
                id: 'settingsSave',
                x: 230,
                y: buttonRowY,
                font: fontMedium,
                text: 'Save',
                onClick() {
                    const llmVal = nodeMap.settingsLlmEndpoint.text;
                    const sdVal = nodeMap.settingsSdEndpoint.text;
                    const bgVal = nodeMap.settingsBgPath.text;
                    const altBgVal = nodeMap.settingsAltBgPath.text;
                    const musicFolder = nodeMap.settingsMusicFolder.text;
                    const autoRandomVal = nodeMap.settingsBgAutoRandom.text;
                    if (musicFolder) {
                        setMusicFolder(musicFolder);
                    }
                    if (autoRandomVal !== undefined) {
                        setBgAutoRandomInterval(autoRandomVal);
                    }
                    app.model.autoTranslateMode = getAutoTranslateMode();
                    saveNrSettings(llmVal, sdVal, bgVal, altBgVal);
                    app.popState();;
                }
            }),
            new Button({
                x: 275,
                y: buttonRowY,
                font: fontMedium,
                text: 'Back',
                onClick() {app.popState();}
            })

        ]
    });

    return settingsView;

    function updateSettingsPaletteButtons() {
        for (let i = 0; i < paletteBtns.length; i++) {
            const btn = nodeMap['paletteBtn' + i];
            if (btn) {
                btn.backgroundColor = i === getCurrentPaletteIndex()
                    ? palettes[i].bg | 0xFF000000
                    : (palettes[i].bg & 0xFFFFFF) | 0x88000000;
            }
        }
    }

    function updateAutoTransButtons() {
        for (const mode of autoTransModes) {
            const btn = nodeMap['autoTransBtn' + mode];
            if (btn) {
                btn.backgroundColor = mode === getAutoTranslateMode()
                    ? palette.highlight & 0x33FFFFFF
                    : palette.contrast;
            }
        }
    }

    function updateRandomBgButton() {
        const btn = nodeMap.randomBgBtn;
        const label = nodeMap.randomBgLabel;
        if (btn && label) {
            const isOn = getMusicRandomBgOnEnd();
            btn.backgroundColor = isOn ? palette.highlight & 0x33FFFFFF : palette.contrast;
            label.text = isOn ? 'On' : 'Off';
        }
    }
}

export function refreshSettingsView(app) {
    if (nodeMap.settingsLlmEndpoint) nodeMap.settingsLlmEndpoint.text = getLlmEndpoint() || '';
    if (nodeMap.settingsSdEndpoint) nodeMap.settingsSdEndpoint.text = getSdEndpoint() || '';
    if (nodeMap.settingsBgPath) nodeMap.settingsBgPath.text = getBgPath() || '';
    if (nodeMap.settingsAltBgPath) nodeMap.settingsAltBgPath.text = nrSettings.altBgPath || '';
    if (nodeMap.settingsFontSize) nodeMap.settingsFontSize.text = getTextFontSize() + 'px';
    if (nodeMap.settingsMusicFolder) nodeMap.settingsMusicFolder.text = getMusicFolder() || '';
    if (nodeMap.settingsBgAutoRandom) nodeMap.settingsBgAutoRandom.text = getBgAutoRandomInterval().toString();
    // Sync auto translate buttons
    for (const mode of ['off', 'line', 'chapter']) {
        const btn = nodeMap['autoTransBtn' + mode];
        if (btn) {
            btn.backgroundColor = mode === getAutoTranslateMode()
                ? palette.highlight & 0x33FFFFFF
                : palette.contrast;
        }
    }
    updateRandomBgButton();
}

export async function handleSettingsKeyDown(app, event) {
    const { key } = event;
    switch (key) {
    case 'a':
        const llmVal = nodeMap.settingsLlmEndpoint.text;
        const sdVal = nodeMap.settingsSdEndpoint.text;
        const bgVal = nodeMap.settingsBgPath.text;
        const altBgVal = nodeMap.settingsAltBgPath.text;
        app.model.autoTranslateMode = getAutoTranslateMode();
        saveNrSettings(llmVal, sdVal, bgVal, altBgVal);
        app.popState();
        break;
    }
}
