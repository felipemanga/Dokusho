import {Event, EventDispatcher} from "../EventDispatcher.js";

import {Ctrl, nodeMap} from "./Ctrl.js";
import {Label} from "./Label.js";
import {Button} from "./Button.js";
import {Group} from "./Group.js";
import {Root} from "./Root.js";
import {TextInput} from "./TextInput.js";
import {MenuBar} from "./MenuBar.js";
import {MenuItem} from "./MenuItem.js";
import {Menu} from "./Menu.js";
import {ImageCtrl} from "./ImageCtrl.js";
import {RichText} from "./RichText.js";

export {
    nodeMap,
    Ctrl, Label, Button,
    Group, Root, TextInput,
    MenuBar, MenuItem, Menu,
    ImageCtrl, RichText
};

let hover = {node: null, ctrl: null};

let focus = {node: null, ctrl: null};
function setFocus(node, ctrl) {
    if (focus.node === node)
        return;
    if (focus.ctrl)
        focus.ctrl.dispatchEvent(new Event('blur', {}));
    focus.node = node;
    focus.ctrl = ctrl;
}

let listeners = new EventDispatcher();

["click", "mousemove", "mousedown", "mouseup", "keydown", "keyup", "wheel", "resize", "textInput", "textEditing", "textReplace"].forEach(eventType => {
    addEventListener(eventType, (event) => {
        listeners.dispatchEvent(new Event(eventType, event));
    });
});

export default {
    Ctrl,
    getHover() {return hover;},
    getFocus() {return focus;},
    setFocus,
    addEventListener(eventType, listener) {
        listeners.addEventListener(eventType, listener);
    },
    removeEventListener(eventType, listener) {
        listeners.removeEventListener(eventType, listener);
    }
};
