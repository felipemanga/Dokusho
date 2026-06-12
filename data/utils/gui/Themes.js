import { getFont } from './FontCache.js';

const themeTemplate = {
    font: 'regular 16px',
    marginLeft: 1,
    marginRight: 2,
    marginTop: 1,
    marginBottom: 7,
    paddingLeft: 1,
    paddingRight: 1,
    paddingTop: 7,
    paddingBottom: 7,
    radius: 8
};

const themes = {
    classic: {
        ctrl: {
            marginLeft: 1,
            marginRight: 10,
            marginTop: 1,
            marginBottom: 10,
            paddingLeft: 3,
            paddingRight: 3,
            paddingTop: 3,
            paddingBottom: 3,
            radius: 5
        },
        root: {
            marginLeft: 0,
            marginRight: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            radius: 0
        },
        label: {
            color: 0xFF000000
        },
        scrollgutter: {
            backgroundColor: 0x44000000,
            radius:        3,
            marginTop:     1,
            marginLeft:    1,
            marginRight:   3,
            marginBottom:  3,
            paddingRight:  1,
            paddingTop:    1,
            paddingLeft:   1,
            paddingBottom: 1
        },
        scrollhandle: {
            backgroundColor: 0xAAAAAAAA,
            radius:        3,
            marginTop:     10,
            marginLeft:    10,
            marginRight:   10,
            marginBottom:  10,
            paddingRight:  1,
            paddingTop:    1,
            paddingLeft:   1,
            paddingBottom: 1
        },
        scrollgroup: {
            wheelStepX: 20,
            wheelStepY: 20,
            barThickness: 10,
            barMinThumbSize: 16
        },
        group: {
            color: 0x00000000
        },
        filedialog: {
            width: 720,
            height: 520,
            padding: 12,
            sectionGap: 8,
            panelColor: 0xFF2B3340,
            listColor: 0x22000000,
            titleColor: 0xFFFFFFFF,
            pathColor: 0xFFDDE6F3,
            rowColor: 0xFF3C4652,
            rowHoverColor: 0xFF4B5664,
            rowSelectedColor: 0xFF5A6D88,
            rowTextColor: 0xFFEFF5FF,
            rowHeight: 26,
            rowGap: 4,
            inputHeight: 22,
            buttonHeight: 22,
            buttonWidth: 84,
            buttonGap: 6
        },
        button: {
            defaultColor: 0xFFBBBBBB,
            hoverColor: 0xFFD4D4D4,
            pressColor: 0xFF808080,
            disabledColor: 0xFF999999,
            textColor: 0xFF1A1A1A,
            defaultElevation: 1,
            hoverElevation: 2,
            pressElevation: -2,
            disabledElevation: -1
        },
        textinput: {
            defaultColor: 0xFFE7E7E7,
            hoverColor: 0xFFF0F0F0,
            focusColor: 0xFFFFFFFF,
            disabledColor: 0xFFCCCCCC,
            preeditColor: 0xFF222222,
            textColor: 0xFF222222,
            placeholderColor: 0xFF888888,
            selectionColor: 0x404285F4,
            defaultElevation: 1,
            hoverElevation: 1,
            focusElevation: 2,
            disabledElevation: -1,
            paddingX: 4,
            caretXAdjust: -3
        },
        menu: {
            color: 0xFFE5EAF0,
            itemHeight: 0,
            marginLeft: 10,
            marginRight: 10,
            marginTop: 0,
            marginBottom: 10,
            paddingLeft: 10,
            paddingRight: 0,
            paddingTop: 0,
            paddingBottom: 5
        },
        menuitem: {
            marginLeft: 5,
            marginRight: 5,
            marginTop: 10,
            marginBottom: 15,
            height: 20
        },
        menubaritem: {
            marginLeft: 0,
            marginRight: 0,
            marginTop: 0,
            marginBottom: 0,
            paddingLeft: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0
        },
        menubar: {
            width: '100% - 15',
            height: 20,
            barColor: 0xFFD7DCE2,
            menuColor: 0xFFE5EAF0,
            itemColor: 0xFFF2F6FA,
            topMenuGap: 10,
            topMenuColor: 0xFFE5EAF0,
            topMenuHoverColor: 0xFFF2F6FA,
            topMenuPressColor: 0xFFD7E1EB,
            dropdownColor: 0xFFE5EAF0,
            topTextColor: 0xFF243545,
            itemTextColor: 0xFF1F2E3D,
            borderLightColor: 0x00000000,
            borderDarkColor: 0x00000000,
            topMenuBorderColor: 0x00000000,
            itemBorderColor: 0x00000000,
            dropdownOffsetY: -15,
            paddingLeft: 10,
            itemHoverColor: 0xFFFFFFFF,
            itemPressColor: 0xFFDCE7F2,
            itemDisabledColor: 0xFFCAD6E2,
            radius: 5
        },
        keyboard: {
            whiteColor: 0xFFE6E9ED,
            blackColor: 0xFF2C343D,
            activeWhiteColor: 0xFF676F77,
            activeBlackColor: 0xFF4B5663,
            pressDarkenFactor: 0.72,
            glowColor: 0xA0FFDDB0,
            glowHeight: 7,
            transitionMs: 90,
            pulseMs: 80
        },
        instrumentsapp: {
            panelColor: 0xFFE8ECEF,
            titleColor: 0xFF1E2A35,
            statusColor: 0xFF30485E,
            labelColor: 0xFF263845,
            helperColor: 0xFF4F6476,
            buttonGenerate: 0xFF42A85E,
            buttonPlay: 0xFF4A88D4,
            buttonMidiPlay: 0xFF4F9BAA,
            buttonMidiStop: 0xFFAA6A4F,
            buttonNextInstrument: 0xFF7B69B8,
            keyboardBackground: 0xFF0F1722
        }
    }
};

export function getThemeForControl(instance, extraClasses = [], params = {}) {
    let classes = [...extraClasses];
    let current = instance.constructor;
    while (current && current !== Object && current !== Function) {
        if (current.name) {
            let name = current.name.toLowerCase();
            if (name != current.name)
                classes.unshift(name);
            classes.unshift(current.name);
        }
        current = Object.getPrototypeOf(current);
    }

    const merged = Object.assign({}, themeTemplate);
    const theme = themes[settings.theme] ?? themes.classic;
    for (let key of classes) {
        if (theme[key])
            Object.assign(merged, theme[key]);
    }
    Object.assign(merged, params);

    if (typeof merged.font === 'string')
        merged.font = getFont(merged.font);
    Object.defineProperty(merged, 'allClasses', {value: classes});

    return merged;
}
