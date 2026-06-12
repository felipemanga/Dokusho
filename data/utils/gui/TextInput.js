import { Ctrl } from './Ctrl.js';
import { Event } from '../EventDispatcher.js';
import { createNinePatchFrame, calculateNinePatchKey } from './FrameCache.js';
import { getThemeForControl } from './Themes.js';
import GUI from './GUI.js';

const DOUBLE_CLICK_DELAY = 300;
const DOUBLE_CLICK_TOLERANCE = 5;
const _selectionImg = new Image(1, 1);
_selectionImg.clear(0xFFFFFFFF);

export class TextInput extends Ctrl {
    #backgroundNode = new Node();
    #clippingNode = new ClippingNode();
    #textNode = new SpanNode();
    #caretNode = new SpanNode();

    onChange = null;
    onSubmit = null;

    #frames = {};
    #fontHeight = 16;
    #lineHeight = 16;
    #multiline = false;
    #paddingY = 4;
    #compositionText = '';
    #compositionStart = 0;
    #compositionActive = false;

    #viewStart = 0;
    #scrollX = 0;
    #scrollY = 0;
    #caretVisible = false;
    #wordBoundaryRegex = /[a-zA-Z0-9]/;
    #selectionStart = null;
    #selectionNode = new Node();
    #selectionNodes = [];
    #wrappedLinesCache = null;
    #wrappedLinesDirty = true;
    #lastClickTime = 0;
    #lastClickPosition = null;
    #mouseDownCaretIndex = null;
    #isDragging = false;

    constructor(params = {}) {
        super({ node: new Node(), state: '', states: ['default', 'hover', 'focus', 'disabled'] }, params);
        const node = this.node;
        node.addChild(this.#backgroundNode);
        node.addChild(this.#clippingNode);
        this.#clippingNode.addChild(this.#selectionNode);
        this.#clippingNode.addChild(this.#textNode);
        this.#clippingNode.addChild(this.#caretNode);

        this.#textNode.font = this.getAttr('font');
        this.#caretNode.font = this.getAttr('font');
        this.#fontHeight = this.#textNode.font?.height || 16;
        this.#lineHeight = this.#computeLineAdvance();

        this.text = this.getAttr('text') ?? '';
        this.placeholder = this.getAttr('placeholder') ?? '';
        this.maxLength = this.getAttr('maxLength') ?? null;
        this.paddingX = this.getAttr('paddingX') ?? 4;
        this.#multiline = this.getAttr('multiline') ?? false;
        this.#paddingY = this.getAttr('paddingY') ?? (this.#multiline ? 4 : 0);
        this.caretIndex = this.text.length;

        this.onChange = this.getAttr('onChange') ?? null;
        this.onSubmit = this.getAttr('onSubmit') ?? null;

        this.addEventListener('change', (...args) => this.onChange && this.onChange(...args));
        this.addEventListener('submit', (...args) => this.onSubmit && this.onSubmit(...args));

        this.addEventListener('focus', () => {
            this.#caretVisible = true;
            this.state = 'focus';
            this.#updateVisual();
            this.root?.window?.showTextInput(this.text);
        });
        this.addEventListener('keydown', (event) => this.#onKeyDown(event));
        this.addEventListener('wheel', (event) => this.#onWheel(event));
        this.addEventListener('mouseover', () => this.#onMouseOver());
        this.addEventListener('mouseout', () => this.#onMouseOut());
        this.addEventListener('blur', () => this.#onBlur());
        this.addEventListener('mousedown', (event) => this.#onMouseDown(event));
        this.addEventListener('mouseup', (event) => this.#onMouseUp(event));
        this.addEventListener('mousemove', (event) => this.#onMouseMove(event));
        this.addEventListener('textInput', (event) => this.#onTextInput(event));
        this.addEventListener('textReplace', (event) => this.#onTextReplace(event));
        this.addEventListener('textEditing', (event) => this.#onTextEditing(event));
    }

    #onMouseOver() {
        if (!this.hasFocus)
            this.state = 'hover';
    }

    #onMouseOut() {
        if (!this.hasFocus)
            this.state = 'default';
    }

    #onMouseDown(event) {
        if (!this.enabled) return;

        const currentTime = Date.now();
        const clickPos = { x: event.x, y: event.y };
        const isDoubleClick = this.#lastClickPosition &&
              (currentTime - this.#lastClickTime) < DOUBLE_CLICK_DELAY &&
              Math.abs(clickPos.x - this.#lastClickPosition.x) < DOUBLE_CLICK_TOLERANCE &&
              Math.abs(clickPos.y - this.#lastClickPosition.y) < DOUBLE_CLICK_TOLERANCE;

        if (isDoubleClick) {
            const selection = this.#getSelection();
            const hasSelection = selection !== null;
            const isFullSelection = hasSelection &&
                  selection.start === 0 &&
                  selection.end === this.text.length;

            if (isFullSelection) {
                this.#clearSelection();
                this.#setCaretFromMouse(event.x, event.y);
            } else {
                if (hasSelection) {
                    this.#selectAll();
                } else {
                    this.#clearSelection();
                    this.#setCaretFromMouse(event.x, event.y);
                    this.#selectWordAt(this.caretIndex);
                }
            }
            this.#lastClickTime = 0;
            this.#mouseDownCaretIndex = this.caretIndex;
        } else {
            if (!event.shiftKey) {
                this.#clearSelection();
                this.#setCaretFromMouse(event.x, event.y);
                this.#mouseDownCaretIndex = this.caretIndex;
            } else {
                // For shift+click, preserve the anchor point
                if (this.#selectionStart === null) {
                    this.#mouseDownCaretIndex = this.caretIndex;
                } else {
                    this.#mouseDownCaretIndex = this.#selectionStart;
                }
                this.#setCaretFromMouse(event.x, event.y);
            }
            this.#lastClickTime = currentTime;
            this.#lastClickPosition = clickPos;
        }

        this.#isDragging = true;
        this.#compositionActive = false;
    }

    #onMouseUp(event) {
        if (!this.enabled) return;
        
        if (event.shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.#mouseDownCaretIndex;
            }
        }
        
        this.#updateVisual();
        this.#isDragging = false;
        this.#mouseDownCaretIndex = null;
        this.dispatchEvent(new Event('click', { input: this }));
        this.#compositionActive = false;
    }

    #onMouseMove(event) {
        if (!this.enabled || !this.#isDragging) return;

        const oldCaretIndex = this.caretIndex;
        this.#setCaretFromMouse(event.x, event.y);

        if (this.caretIndex !== oldCaretIndex) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.#mouseDownCaretIndex;
            }
            this.#updateVisual();
        }
    }

    get text() {return this.getAttr('text');}
    set text(value) {
        value = String(value ?? '');
        let maxLength = this.getAttr('maxLength');
        if (maxLength !== null && value.length > maxLength) {
            value = value.slice(0, maxLength);
        }

        this.setAttr('text', value);
        this.caretIndex = this.caretIndex;
        this.#wrappedLinesDirty = true;
        this.#updateVisual();
        this.dispatchEvent(new Event('change', { input: this, text: value }));
    }

    get placeholder() {return this.getAttr('placeholder');}
    set placeholder(value) {this.setAttr('placeholder', value);}

    get paddingX() {return this.getAttr('paddingX');}
    set paddingX(value) {this.setAttr('paddingX', value || 0);}

    get maxLength() {return this.getAttr('maxLength');}
    set maxLength(value) {this.setAttr('maxLength', value);}

    get wordBoundaryRegex() {return this.#wordBoundaryRegex;}
    set wordBoundaryRegex(value) {this.#wordBoundaryRegex = value;}

    get multiline() {return this.#multiline;}
    set multiline(value) {
        if (value === this.#multiline) return;
        this.#multiline = !!value;
        this.#paddingY = this.#multiline ? 4 : 0;
        this.#updateVisual();
    }

    get paddingY() {return this.#paddingY;}
    set paddingY(value) {this.#paddingY = value || 0;}

    get caretIndex() {return this.getAttr('caretIndex');}
    set caretIndex(value) {
        value = Math.max(0, Math.min(this.text.length, value));
        this.setAttr('caretIndex', value);
    }

    #measure(text) {
        if (!text) return 0;
        const font = this.#textNode.font;
        if (!font) return 0;
        return font.measure(text).width;
    }

    // Compute line advance matching SpanNode rendering
    #computeLineAdvance() {
        return this.#fontHeight;
    }

    // Returns array of strings, each being a logical line (split by \n)
    #getLogicalLines() {
        return this.text.split('\n');
    }

    // Returns array of {text, start} for each wrapped visual line (cached)
    #getWrappedLines() {
        if (!this.#wrappedLinesDirty) return this.#wrappedLinesCache;
        const maxW = this.#contentWidth();
        if (maxW <= 0) {
            this.#wrappedLinesCache = [{ text: this.text, start: 0 }];
            this.#wrappedLinesDirty = false;
            return this.#wrappedLinesCache;
        }
        const lines = [];
        const logicalLines = this.#getLogicalLines();

        // Compute cumulative position in original text for each logical line
        let pStart = 0;
        for (let li = 0; li < logicalLines.length; li++) {
            const paragraph = logicalLines[li];

            if (!paragraph) {
                lines.push({ text: '', start: pStart });
                pStart += 1;
                continue;
            }

            // Word-wrap the paragraph
            let pos = 0;
            while (pos < paragraph.length) {
                let lineStartPos = pos;
                let lastSpace = -1;
                let lineWidth = 0;

                // Greedily add words
                while (pos < paragraph.length) {
                    const ch = paragraph[pos];
                    const chW = this.#measure(ch);
                    const testWidth = lineWidth + chW;

                    if (testWidth > maxW && lineWidth > 0) {
                        break;
                    }

                    if (ch === ' ') lastSpace = pos;
                    lineWidth = testWidth;
                    pos++;
                }

                let lineText;
                if (lastSpace >= lineStartPos && pos < paragraph.length) {
                    lineText = paragraph.slice(lineStartPos, lastSpace);
                    pos = lastSpace + 1;
                } else {
                    lineText = paragraph.slice(lineStartPos, pos);
                }

                lines.push({ text: lineText, start: pStart + lineStartPos });
            }

            pStart += paragraph.length + 1;
        }

        this.#wrappedLinesCache = lines;
        this.#wrappedLinesDirty = false;
        return lines;
    }

    // Convert flat text index to {line, col} (wrapped visual position)
    #indexToPos(idx) {
        const lines = this.#getWrappedLines();
        idx = Math.max(0, Math.min(idx, this.text.length));

        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            if (idx <= l.start + l.text.length) {
                return { line: i, col: idx - l.start };
            }
        }
        // Past end
        const last = lines[lines.length - 1];
        return { line: lines.length - 1, col: last ? last.text.length : 0 };
    }

    // Convert {line, col} to flat text index
    #posToIndex(line, col) {
        const lines = this.#getWrappedLines();
        if (line < 0 || line >= lines.length) return 0;
        const l = lines[line];
        const clampedCol = Math.max(0, Math.min(col, l.text.length));
        return l.start + clampedCol;
    }

    #contentWidth() {
        const attrs = this.attrs;
        const frame = this.#backgroundNode.children[0];
        if (!frame) return 0;
        return this.finalWidth - attrs.marginLeft - attrs.marginRight - attrs.paddingLeft - attrs.paddingRight - this.paddingX * 2;
    }

    #findWordBoundary(position, direction) {
        const text = this.text;
        if (!text.length) return position;
        
        const regex = this.#wordBoundaryRegex;
        let pos = position;
        
        if (direction > 0) {
            // Move forward: skip non-word chars, then skip word chars
            while (pos < text.length && !regex.test(text[pos])) {
                pos++;
            }
            while (pos < text.length && regex.test(text[pos])) {
                pos++;
            }
        } else {
            // Move backward: skip non-word chars, then skip word chars
            while (pos > 0 && !regex.test(text[pos - 1])) {
                pos--;
            }
            while (pos > 0 && regex.test(text[pos - 1])) {
                pos--;
            }
        }
        
        return pos;
    }

    #selectWordAt(position) {
        if (!this.text.length) return;
        
        const text = this.text;
        const regex = this.#wordBoundaryRegex;
        
        let start = position;
        while (start > 0 && regex.test(text[start - 1])) {
            start--;
        }
        
        let end = position;
        while (end < text.length && regex.test(text[end])) {
            end++;
        }
        
        if (start === end) {
            end = Math.min(end + 1, text.length);
        }
        
        this.#selectRange(start, end);
    }

    #deleteToWordBoundary(direction) {
        const text = this.text;
        if (!text.length) return this.caretIndex;
        
        const regex = this.#wordBoundaryRegex;
        let pos = this.caretIndex;
        let deleteStart = this.caretIndex;
        let deleteEnd = this.caretIndex;
        
        if (direction > 0) {
            // Delete forward: delete non-word chars, then delete word chars
            while (pos < text.length && !regex.test(text[pos])) {
                pos++;
            }
            deleteEnd = pos;
            while (pos < text.length && regex.test(text[pos])) {
                pos++;
            }
            deleteEnd = pos;
        } else {
            // Delete backward: delete non-word chars, then delete word chars
            while (pos > 0 && !regex.test(text[pos - 1])) {
                pos--;
            }
            deleteStart = pos;
            while (pos > 0 && regex.test(text[pos - 1])) {
                pos--;
            }
            deleteStart = pos;
        }
        
        return { deleteStart, deleteEnd };
    }

    #clearSelection() {
        this.#selectionStart = null;
        this.#selectionNodes = [];
    }

    #selectRange(start, end) {
        this.#selectionStart = Math.min(start, end);
        this.caretIndex = Math.max(start, end);
    }

    #selectAll() {
        this.#selectRange(0, this.text.length);
    }

    #getSelection() {
        if (this.#selectionStart === null) return null;
        return {
            start: this.#selectionStart,
            end: this.caretIndex
        };
    }

    #getSelectedText() {
        const selection = this.#getSelection();
        if (!selection) return '';
        const minSel = Math.min(selection.start, selection.end);
        const maxSel = Math.max(selection.start, selection.end);
        return this.text.slice(minSel, maxSel);
    }

    getSelectedText() {
        return this.#getSelectedText();
    }

    #deleteSelectedText() {
        const selection = this.#getSelection();
        if (!selection) return false;
        const minSel = Math.min(selection.start, selection.end);
        const maxSel = Math.max(selection.start, selection.end);
        this.text = this.text.slice(0, minSel) + this.text.slice(maxSel);
        this.caretIndex = minSel;
        this.#clearSelection();
        return true;
    }

    async #paste() {
        let clipboardText = getClipboardText();
        if (!clipboardText) return;
        if (!this.#multiline) {
            clipboardText = clipboardText.replace(/[\r\n]+/g, ' ');
        }
        this.#deleteSelectedText();
        if (this.maxLength !== null) {
            const availableSpace = this.maxLength - this.text.length;
            if (availableSpace <= 0) return;
            this.text = this.text.slice(0, this.caretIndex) + 
                clipboardText.slice(0, availableSpace) +
                this.text.slice(this.caretIndex);
            this.caretIndex = Math.min(this.caretIndex + clipboardText.length, this.maxLength);
        } else {
            this.text = this.text.slice(0, this.caretIndex) + 
                clipboardText +
                this.text.slice(this.caretIndex);
            this.caretIndex += clipboardText.length;
        }
        this.#commitChange();
    }

    #fitEnd(start) {
        const maxWidth = this.#contentWidth();
        let end = start;
        let text = this.text;
        let width = 0;
        while (end < text.length) {
            const ch = text[end];
            const chWidth = this.#measure(ch);
            if (width + chWidth > maxWidth) {
                break;
            }
            width += chWidth;
            end++;
        }
        return end;
    }

    #setCaretFromMouse(x, y) {
        const local = this.toLocal(x, y ?? 0);
        const localX = local.x;
        const localY = (y != null ? this.toLocal(x, y).y : 0);

        if (!this.text.length) {
            this.caretIndex = 0;
            return;
        }

        if (this.#multiline) {
            // Convert to clipping node space
            const clipPos = this.#clippingNode.position;
            const clipW = this.#clippingNode.size().width;
            const clipH = this.#clippingNode.size().height;
            const cx = localX - clipPos.x;
            const cy = localY - clipPos.y;

            // Text node inside clipping is at (paddingX - scrollX, paddingY - scrollY)
            // Convert to absolute text coordinate
            const absX = cx - this.paddingX + this.#scrollX;
            const absY = cy - this.#paddingY + this.#scrollY;

            // Clamp and determine line
            let targetLine = Math.floor(absY / this.#lineHeight);

            const wrappedLines = this.#getWrappedLines();
            if (wrappedLines.length === 0) {
                this.caretIndex = 0;
                return;
            }
            if (targetLine < 0) targetLine = 0;
            if (targetLine >= wrappedLines.length) targetLine = wrappedLines.length - 1;

            const line = wrappedLines[targetLine];
            // Snap left: pick last caret position whose X <= absX
            let nearest = 0;
            const caretXAdjust = this.getAttr('caretXAdjust') ?? 0;
            for (let i = 0; i <= line.text.length; i++) {
                const w = this.#measure(line.text.slice(0, i)) + caretXAdjust;
                if (w <= absX) nearest = i;
                else break;
            }
            this.caretIndex = this.#posToIndex(targetLine, nearest);
        } else {
            // Single-line mode (unchanged logic)
            const textX = localX - this.paddingX;

            if (textX <= 0) {
                this.caretIndex = this.#viewStart;
                return;
            }

            const end = this.#fitEnd(this.#viewStart);
            const visible = this.text.slice(this.#viewStart, end);
            if (!visible.length) {
                this.caretIndex = this.#viewStart;
                return;
            }

            let nearest = 0;
            let nearestDist = Number.POSITIVE_INFINITY;
            const caretXAdjust = this.getAttr('caretXAdjust') ?? 0;
            for (let i = 0; i <= visible.length; i++) {
                const w = this.#measure(visible.slice(0, i)) + caretXAdjust;
                const d = Math.abs(w - textX);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = i;
                }
            }
            this.caretIndex = this.#viewStart + nearest;
        }
    }

    #redraw(state, attrs) {
        const height = this.#lineHeight + 8;
        const width = this.finalWidth;

        let frameAttrs = attrs;
        switch (state) {
        case '':
        case 'default':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.defaultColor,
                elevation: attrs.defaultElevation ?? 1
            };
            break;
        case 'hover':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.hoverColor,
                elevation: attrs.hoverElevation ?? 2
            };
            break;
        case 'focus':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.focusColor,
                elevation: attrs.focusElevation ?? -2
            }
            break;
        case 'disabled':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.disabledColor,
                elevation: attrs.disabledElevation ?? -1
            }
            break;
        }

        let key = calculateNinePatchKey(frameAttrs);
        let frame = this.#frames[state];
        if (!frame || frame.key !== key) {
            frame = createNinePatchFrame(frameAttrs);
            this.#frames[state] = frame;
        }

        this.#backgroundNode.clearChildren();
        this.#backgroundNode.addChild(frame);
        this.#updateBackgroundSize();
    }

    get finalHeight() {
        return super.finalHeight || (this.node.children.length ? this.#lineHeight : 0);
    }

    #updateBackgroundSize() {
        const frame = this.#backgroundNode.children[0];
        if (frame instanceof NinePatch) {
            const attrs = this.attrs;
            const contentWidth = Math.max(40, this.#contentWidth());
            const height = this.finalHeight;

            frame.setInnerSize(this.finalWidth, height);
            frame.position = {
                x: -attrs.marginLeft - attrs.paddingLeft,
                y: -attrs.marginTop - attrs.paddingTop
            };

            if (this.#multiline) {
                const viewportW = this.finalWidth;
                const viewportH = this.finalHeight;
                this.#clippingNode.setSize(viewportW, viewportH);
                this.#clippingNode.setPosition(attrs.paddingLeft, attrs.paddingTop);
            } else {
                this.#clippingNode.setSize(0, 0);
                this.#clippingNode.setPosition(0, 0);
            }
        }
    }

    #updateVisual() {
        const frame = this.#backgroundNode.children[0];
        if (!frame) return;

        if (this.#multiline) {
            this.#updateVisualMultiline();
            return;
        }

        // --- Single-line mode (unchanged logic below) ---
        const frameHeight = frame.height;
        const attrs = this.attrs;
        const baseY = ((frameHeight - (attrs.marginTop + attrs.marginBottom + attrs.paddingTop + attrs.paddingBottom) - this.#lineHeight) / 2);

        if (!this.text.length && !this.hasFocus && this.placeholder) {
            this.#textNode.text = this.placeholder;
            this.#textNode.maxWidth = 0;
            this.#textNode.color = this.getAttr('placeholderColor') ?? 0x7F7F7F7F;
            this.#textNode.position = { x: this.paddingX, y: baseY };
            this.#caretNode.visible = false;
            return;
        }

        if (this.#viewStart > this.text.length) {
            this.#viewStart = 0;
        }

        let start = Math.max(0, Math.min(this.#viewStart, this.text.length));
        if (this.caretIndex < start) {
            start = this.caretIndex;
        }
        while (true) {
            const end = this.#fitEnd(start);
            if (this.caretIndex <= end) {
                this.#viewStart = start;
                break;
            }
            start++;
        }

        if (this.caretIndex === this.text.length && this.#viewStart > 0) {
            let expandedStart = this.#viewStart - 1;
            while (expandedStart >= 0) {
                const expandedEnd = this.#fitEnd(expandedStart);
                if (expandedEnd < this.text.length) {
                    break;
                }
                expandedStart--;
            }
            if (expandedStart + 1 < this.#viewStart) {
                this.#viewStart = expandedStart + 1;
            }
        }

        let end = this.#fitEnd(this.#viewStart);
        while (end > this.#viewStart && this.#measure(this.text.slice(this.#viewStart, end)) > this.#contentWidth()) {
            end--;
        }
        const visible = this.text.slice(this.#viewStart, end);

        // Handle composition text rendering
        let displayText = visible;
        let displayCaretIndex;

        if (this.#compositionActive && this.#compositionText) {
            const compStartRel = this.#compositionStart - this.#viewStart;
            if (compStartRel >= 0 && compStartRel <= visible.length) {
                displayText = visible.slice(0, compStartRel) +
                    this.#compositionText +
                    visible.slice(compStartRel);
                displayCaretIndex = compStartRel + this.#compositionText.length;
            } else {
                displayCaretIndex = this.caretIndex - this.#viewStart;
            }

            this.#textNode.color = this.getAttr('preeditColor') ?? 0xFF999999;
        } else {
            displayCaretIndex = this.caretIndex - this.#viewStart;
            this.#textNode.color = this.getAttr('textColor') ?? 0xFF222222;
        }

        this.#textNode.text = displayText;
        this.#textNode.maxWidth = 0;
        this.#textNode.position = { x: this.paddingX, y: baseY };

        this.#renderSelectionSingle(baseY, displayText, displayCaretIndex);

        if (!this.hasFocus || !this.enabled) {
            this.#caretNode.visible = false;
            return;
        }

        this.#caretNode.text = '|';
        this.#caretNode.color = this.getAttr('textColor') ?? 0xFF222222;
        this.#caretNode.visible = this.#caretVisible;
        const caretXAdjust = this.getAttr('caretXAdjust') ?? 0;
        const beforeCaret = displayText.slice(0, displayCaretIndex);
        this.#caretNode.position = { x: this.paddingX + this.#measure(beforeCaret) + caretXAdjust, y: baseY };
    }

    #updateVisualMultiline() {
        const contentWidth = this.#contentWidth();
        const lineHeightAttr = this.getAttr('lineHeight') ?? 1;

        // Placeholder
        if (!this.text.length && !this.hasFocus && this.placeholder) {
            this.#textNode.text = this.placeholder;
            this.#textNode.maxWidth = contentWidth;
            this.#textNode.lineHeight = lineHeightAttr;
            this.#textNode.color = this.getAttr('placeholderColor') ?? 0x7F7F7F7F;
            this.#textNode.position = { x: this.paddingX, y: this.#paddingY };
            this.#caretNode.visible = false;
            this.#selectionNode.clearChildren();
            return;
        }

        // Text rendering
        const displayText = this.#compositionActive && this.#compositionText
              ? this.text.slice(0, this.#compositionStart) + this.#compositionText + this.text.slice(this.#compositionStart + this.#compositionText.length)
              : this.text;

        this.#textNode.text = displayText;
        this.#textNode.maxWidth = contentWidth;
        this.#textNode.lineHeight = lineHeightAttr;
        this.#textNode.color = this.#compositionActive
            ? (this.getAttr('preeditColor') ?? 0xFF999999)
            : (this.getAttr('textColor') ?? 0xFF222222);

        // Compute scroll to keep caret visible
        const pos = this.#indexToPos(this.caretIndex);
        const wrappedLines = this.#getWrappedLines();
        const line = wrappedLines[pos.line];
        const clampedCol = Math.max(0, Math.min(pos.col, line ? line.text.length : 0));
        // Content-relative caret position (no padding)
        const caretCX = this.#measure(line ? line.text.slice(0, clampedCol) : '');
        const caretCY = pos.line * this.#lineHeight;
        const viewportW = contentWidth;
        const viewportH = this.finalHeight - this.attrs.marginTop - this.attrs.marginBottom - this.attrs.paddingTop - this.attrs.paddingBottom;

        // Scroll X: keep caret in horizontal view
        const caretWidth = this.#measure('|');
        if (caretCX < this.#scrollX) {
            this.#scrollX = caretCX;
        } else if (caretCX + caretWidth > this.#scrollX + viewportW) {
            this.#scrollX = caretCX + caretWidth - viewportW;
        }
        this.#scrollX = Math.max(0, this.#scrollX);

        // Scroll Y: keep caret in vertical view
        if (caretCY < this.#scrollY) {
            this.#scrollY = caretCY;
        } else if (caretCY + this.#lineHeight > this.#scrollY + viewportH) {
            this.#scrollY = caretCY + this.#lineHeight - viewportH;
        }
        this.#scrollY = Math.max(0, this.#scrollY);

        // Apply scroll offset to children inside clipping node
        this.#textNode.position.x = this.paddingX - this.#scrollX;
        this.#textNode.position.y = this.#paddingY - this.#scrollY;

        // Render selection
        this.#renderSelectionMultiline();

        // Caret
        if (!this.hasFocus || !this.enabled) {
            this.#caretNode.visible = false;
            return;
        }

        this.#caretNode.text = '|';
        this.#caretNode.visible = this.#caretVisible;
        this.#caretNode.color = this.getAttr('textColor') ?? 0xFF222222;
        const caretXAdjust = this.getAttr('caretXAdjust') ?? 0;
        this.#caretNode.position = {
            x: this.paddingX + caretCX - this.#scrollX + caretXAdjust,
            y: this.#paddingY + caretCY - this.#scrollY
        };
    }

    
    #renderSelectionSingle(baseY, displayText, displayCaretIndex) {
        const selection = this.#getSelection();
        if (!selection || !this.text.length) {
            this.#selectionNode.clearChildren();
            return;
        }

        const selectionColor = this.getAttr('selectionColor') ?? 0x404285F4;

        const selStart = Math.min(selection.start, selection.end);
        const selEnd = Math.max(selection.start, selection.end);

        const visibleStart = this.#viewStart;
        const visibleEnd = this.#fitEnd(this.#viewStart);

        if (selEnd <= visibleStart || selStart >= visibleEnd) {
            this.#selectionNode.clearChildren();
            return;
        }

        const visSelStart = Math.max(selStart, visibleStart) - visibleStart;
        const visSelEnd = Math.min(selEnd, visibleEnd) - visibleStart;

        if (visSelEnd <= visSelStart) {
            this.#selectionNode.clearChildren();
            return;
        }

        const visible = this.text.slice(visibleStart, visibleEnd);
        const selectedText = visible.slice(visSelStart, visSelEnd);

        const selectionStartX = this.#measure(visible.slice(0, visSelStart));
        const selectionWidth = this.#measure(selectedText);

        let imgNode = this.#selectionNodes[0];
        if (!imgNode) {
            imgNode = new ImageNode();
            imgNode.image = _selectionImg;
            this.#selectionNodes[0] = imgNode;
        }

        this.#selectionNode.clearChildren();
        this.#selectionNode.addChild(imgNode);
        imgNode.color = selectionColor;
        imgNode.position = { x: this.paddingX + selectionStartX, y: baseY };
        imgNode.setScale(Math.max(1, selectionWidth), this.#lineHeight);
    }

    #renderSelectionMultiline() {
        const selection = this.#getSelection();
        if (!selection || !this.text.length) {
            this.#selectionNode.clearChildren();
            return;
        }

        const selectionColor = this.getAttr('selectionColor') ?? 0x404285F4;
        const selStart = Math.min(selection.start, selection.end);
        const selEnd = Math.max(selection.start, selection.end);

        const startPos = this.#indexToPos(selStart);
        const endPos = this.#indexToPos(selEnd);

        const wrappedLines = this.#getWrappedLines();
        const viewportH = this.finalHeight - this.attrs.marginTop - this.attrs.marginBottom - this.attrs.paddingTop - this.attrs.paddingBottom;

        // Only render lines that are visible in the viewport
        const visibleLineStart = Math.max(0, Math.floor(this.#scrollY / this.#lineHeight));
        const visibleLineEnd = Math.min(wrappedLines.length - 1, Math.ceil((this.#scrollY + viewportH) / this.#lineHeight));

        this.#selectionNode.clearChildren();
        this.#selectionNodes = [];

        for (let li = startPos.line; li <= endPos.line; li++) {
            if (li < visibleLineStart || li > visibleLineEnd) continue;

            const line = wrappedLines[li];
            let lineSelStart, lineSelEnd;

            if (li === startPos.line && li === endPos.line) {
                lineSelStart = startPos.col;
                lineSelEnd = endPos.col;
            } else if (li === startPos.line) {
                lineSelStart = startPos.col;
                lineSelEnd = line.text.length;
            } else if (li === endPos.line) {
                lineSelStart = 0;
                lineSelEnd = endPos.col;
            } else {
                lineSelStart = 0;
                lineSelEnd = line.text.length;
            }

            if (lineSelEnd <= lineSelStart) continue;

            const selX = this.paddingX + this.#measure(line.text.slice(0, lineSelStart)) - this.#scrollX;
            const selW = this.#measure(line.text.slice(lineSelStart, lineSelEnd));
            const selY = this.#paddingY + li * this.#lineHeight - this.#scrollY;

            let imgNode = this.#selectionNodes[li];
            if (!imgNode) {
                imgNode = new ImageNode();
                imgNode.image = _selectionImg;
                this.#selectionNodes[li] = imgNode;
            }

            this.#selectionNode.addChild(imgNode);
            imgNode.color = selectionColor;
            imgNode.position = { x: selX, y: selY };
            imgNode.setScale(Math.max(1, selW), this.#lineHeight);
        }
    }

    #onWheel(event) {
        if (!this.enabled || !this.hasFocus || !this.#multiline) return;
        const stepY = this.#lineHeight;
        const oldScrollY = this.#scrollY;
        this.#scrollY += event.deltaY * stepY;
        if (this.#scrollY != oldScrollY) {
            event.stopPropagation();
            this.#applyScroll();
        }
    }

    // Apply scroll offset to visual elements without recalculating scroll from caret
    #applyScroll() {
        const viewportH = this.finalHeight - this.attrs.marginTop - this.attrs.marginBottom - this.attrs.paddingTop - this.attrs.paddingBottom;
        const totalContentH = (this.#wrappedLinesCache?.length ?? 1) * this.#lineHeight;
        this.#scrollY = Math.max(0, Math.min(this.#scrollY, totalContentH - viewportH));
        this.#scrollX = Math.max(0, this.#scrollX);

        this.#textNode.position.x = this.paddingX - this.#scrollX;
        this.#textNode.position.y = this.#paddingY - this.#scrollY;

        const caretPos = this.#indexToPos(this.caretIndex);
        const line = this.#wrappedLinesCache?.[caretPos.line];
        const clampedCol = Math.max(0, Math.min(caretPos.col, line ? line.text.length : 0));
        const caretCX = this.#measure(line ? line.text.slice(0, clampedCol) : '') + (this.getAttr('caretXAdjust') ?? 0);
        this.#caretNode.position = {
            x: this.paddingX + caretCX - this.#scrollX,
            y: this.#paddingY + caretPos.line * this.#lineHeight - this.#scrollY
        };
        this.#renderSelectionMultiline();
    }

    #onBlur() {
        this.#caretVisible = false;
        this.#clearSelection();
        if (this.enabled) {
            this.state = 'default';
        } else {
            this.state = 'disabled';
        }
        this.#updateVisual();
        this.root?.window?.hideTextInput();
    }

    _caretTick() {
        if (!this.hasFocus || !this.enabled) return;
        this.#caretVisible = !this.#caretVisible;
        this.#caretNode.visible = this.#caretVisible;
    }

    #onTextReplace(event) {
        if (!this.enabled || !this.hasFocus) return;
        this.text = event.text;
        this.caretIndex = event.text.length;
        this.#commitChange();
    }

    #onTextInput(event) {
        if (!this.enabled || !this.hasFocus) return;
        
        const text = event.text;
        
        // If composition is active, commit it
        if (this.#compositionActive) {
            // Delete selected text first if there is a selection
            if (this.#deleteSelectedText()) {
                this.#caretVisible = true;
                this.#updateVisual();
            }
            this.text = this.text.slice(0, this.#compositionStart) + 
                text +
                this.text.slice(this.#compositionStart + this.#compositionText.length);
            this.caretIndex = this.#compositionStart + text.length;
            this.#compositionActive = false;
            this.#compositionText = '';
            this.#commitChange();
        } else if (text.length > 0) {
            // Delete selected text first if there is a selection
            if (this.#deleteSelectedText()) {
                this.#caretVisible = true;
                this.#updateVisual();
            }
            
            // Direct input (backward compatibility)
            if (this.maxLength !== null && this.text.length >= this.maxLength) {
                return;
            }
            this.text = this.text.slice(0, this.caretIndex) + text + this.text.slice(this.caretIndex);
            this.caretIndex += text.length;
            this.#commitChange();
        }
    }

    #onTextEditing(event) {
        if (!this.enabled || !this.hasFocus) return;
        
        const text = event.text;
        
        // Start or update composition
        if (!this.#compositionActive) {
            this.#compositionStart = this.caretIndex;
            this.#compositionActive = true;
        }
        
        // Handle empty text (IME cancel or intermediate state)
        this.#compositionText = text;
        this.#updateVisual();
    }

    #onKeyDown(event) {
        if (!this.enabled || !this.hasFocus) return;
        const { key, ctrlKey, altKey, metaKey, shiftKey } = event;
        const maxLength = this.maxLength;

        // Cancel composition on Escape
        if (key === 'Escape' && this.#compositionActive) {
            this.#compositionActive = false;
            this.#compositionText = '';
            this.#updateVisual();
            return;
        }

        // Word boundary navigation: Ctrl+Left / Alt+B
        if (key === 'ArrowLeft' && ctrlKey) {
            const newPos = this.#findWordBoundary(this.caretIndex, -1);
            if (newPos !== this.caretIndex) {
                this.caretIndex = newPos;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Word boundary navigation: Alt+B
        if ((key === 'b' || key === 'B') && altKey) {
            const newPos = this.#findWordBoundary(this.caretIndex, -1);
            if (newPos !== this.caretIndex) {
                this.caretIndex = newPos;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Word boundary navigation: Ctrl+Right / Alt+F
        if (key === 'ArrowRight' && ctrlKey) {
            const newPos = this.#findWordBoundary(this.caretIndex, 1);
            if (newPos !== this.caretIndex) {
                this.caretIndex = newPos;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Word boundary navigation: Alt+F
        if ((key === 'f' || key === 'F') && altKey) {
            const newPos = this.#findWordBoundary(this.caretIndex, 1);
            if (newPos !== this.caretIndex) {
                this.caretIndex = newPos;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Shift+Ctrl+ArrowLeft: extend selection by word left
        if (key === 'ArrowLeft' && ctrlKey && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            const newPos = this.#findWordBoundary(this.caretIndex, -1);
            if (newPos !== this.caretIndex) {
                this.caretIndex = newPos;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Shift+Alt+B: extend selection by word left (emacs style)
        if ((key === 'b' || key === 'B') && altKey && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            const newPos = this.#findWordBoundary(this.caretIndex, -1);
            if (newPos !== this.caretIndex) {
                this.caretIndex = newPos;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Shift+ArrowLeft: extend selection left
        if (key === 'ArrowLeft' && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            if (this.caretIndex > 0) {
                this.caretIndex--;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Shift+Ctrl+ArrowRight: extend selection by word right
        if (key === 'ArrowRight' && ctrlKey && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            const newPos = this.#findWordBoundary(this.caretIndex, 1);
            if (newPos !== this.caretIndex) {
                this.caretIndex = newPos;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Shift+Alt+F: extend selection by word right (emacs style)
        if ((key === 'f' || key === 'F') && altKey && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            const newPos = this.#findWordBoundary(this.caretIndex, 1);
            if (newPos !== this.caretIndex) {
                this.caretIndex = newPos;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Shift+ArrowRight: extend selection right
        if (key === 'ArrowRight' && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            if (this.caretIndex < this.text.length) {
                this.caretIndex++;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        // Shift+Home
        if (key === 'Home' && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            if (this.#multiline) {
                const pos = this.#indexToPos(this.caretIndex);
                this.caretIndex = this.#posToIndex(pos.line, 0);
            } else {
                this.caretIndex = 0;
            }
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        // Shift+End
        if (key === 'End' && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            if (this.#multiline) {
                const pos = this.#indexToPos(this.caretIndex);
                const wrappedLines = this.#getWrappedLines();
                const line = wrappedLines[pos.line];
                this.caretIndex = this.#posToIndex(pos.line, line.text.length);
            } else {
                this.caretIndex = this.text.length;
            }
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        // Ctrl+A: select all
        if ((key === 'a' || key === 'A') && (ctrlKey || metaKey)) {
            this.#selectAll();
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        // Shift+ArrowUp
        if (key === 'ArrowUp' && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            if (this.#multiline) {
                const pos = this.#indexToPos(this.caretIndex);
                if (pos.line > 0) {
                    const wrappedLines = this.#getWrappedLines();
                    const prevLine = wrappedLines[pos.line - 1];
                    const newCol = Math.min(pos.col, prevLine.text.length);
                    this.caretIndex = this.#posToIndex(pos.line - 1, newCol);
                } else {
                    this.caretIndex = 0;
                }
            } else {
                this.caretIndex = 0;
            }
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        // ArrowUp
        if (key === 'ArrowUp') {
            if (this.#multiline) {
                this.#clearSelection();
                const pos = this.#indexToPos(this.caretIndex);
                if (pos.line > 0) {
                    const wrappedLines = this.#getWrappedLines();
                    const prevLine = wrappedLines[pos.line - 1];
                    const newCol = Math.min(pos.col, prevLine.text.length);
                    this.caretIndex = this.#posToIndex(pos.line - 1, newCol);
                } else {
                    this.caretIndex = 0;
                }
            } else {
                this.#clearSelection();
                this.caretIndex = 0;
            }
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        // Shift+ArrowDown
        if (key === 'ArrowDown' && shiftKey) {
            if (this.#selectionStart === null) {
                this.#selectionStart = this.caretIndex;
            }
            if (this.#multiline) {
                const pos = this.#indexToPos(this.caretIndex);
                const wrappedLines = this.#getWrappedLines();
                if (pos.line < wrappedLines.length - 1) {
                    const nextLine = wrappedLines[pos.line + 1];
                    const newCol = Math.min(pos.col, nextLine.text.length);
                    this.caretIndex = this.#posToIndex(pos.line + 1, newCol);
                } else {
                    this.caretIndex = this.text.length;
                }
            } else {
                this.caretIndex = this.text.length;
            }
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        // ArrowDown
        if (key === 'ArrowDown') {
            if (this.#multiline) {
                this.#clearSelection();
                const pos = this.#indexToPos(this.caretIndex);
                const wrappedLines = this.#getWrappedLines();
                if (pos.line < wrappedLines.length - 1) {
                    const nextLine = wrappedLines[pos.line + 1];
                    const newCol = Math.min(pos.col, nextLine.text.length);
                    this.caretIndex = this.#posToIndex(pos.line + 1, newCol);
                } else {
                    this.caretIndex = this.text.length;
                }
            } else {
                this.#clearSelection();
                this.caretIndex = this.text.length;
            }
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        if (key === 'ArrowLeft') {
            this.#clearSelection();
            if (this.caretIndex > 0) {
                this.caretIndex--;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        if (key === 'ArrowRight') {
            this.#clearSelection();
            if (this.caretIndex < this.text.length) {
                this.caretIndex++;
                this.#caretVisible = true;
                this.#updateVisual();
            }
            return;
        }

        if (key === 'Home') {
            this.#clearSelection();
            if (this.#multiline) {
                const pos = this.#indexToPos(this.caretIndex);
                this.caretIndex = this.#posToIndex(pos.line, 0);
            } else {
                this.caretIndex = 0;
            }
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        if (key === 'End') {
            this.#clearSelection();
            if (this.#multiline) {
                const pos = this.#indexToPos(this.caretIndex);
                const wrappedLines = this.#getWrappedLines();
                const line = wrappedLines[pos.line];
                this.caretIndex = this.#posToIndex(pos.line, line.text.length);
            } else {
                this.caretIndex = this.text.length;
            }
            this.#caretVisible = true;
            this.#updateVisual();
            return;
        }

        // Ctrl+Backspace: delete word to the left
        if (key === 'Backspace' && ctrlKey) {
            const result = this.#deleteToWordBoundary(-1);
            if (result.deleteStart !== this.caretIndex) {
                this.text = this.text.slice(0, result.deleteStart) + this.text.slice(result.deleteEnd);
                this.caretIndex = result.deleteStart;
                this.#caretVisible = true;
                this.#commitChange();
            }
            return;
        }

        // Ctrl+Delete: delete word to the right
        if (key === 'Delete' && ctrlKey) {
            const result = this.#deleteToWordBoundary(1);
            if (result.deleteEnd !== this.caretIndex) {
                this.text = this.text.slice(0, result.deleteStart) + this.text.slice(result.deleteEnd);
                this.#caretVisible = true;
                this.#commitChange();
            }
            return;
        }

        // Ctrl+X: cut selection
        if ((key === 'x' || key === 'X') && (ctrlKey || metaKey)) {
            const selectedText = this.#getSelectedText();
            if (selectedText) {
                setClipboardText(selectedText);
                this.#deleteSelectedText();
                this.#commitChange();
            }
            return;
        }

        // Ctrl+C: copy selection
        if ((key === 'c' || key === 'C') && (ctrlKey || metaKey)) {
            const selectedText = this.#getSelectedText();
            if (selectedText) {
                setClipboardText(selectedText);
            }
            return;
        }

        if (key === 'Backspace') {
            // Delete selected text first if there is a selection
            if (this.#deleteSelectedText()) {
                this.#caretVisible = true;
                this.#commitChange();
                return;
            }
            if (this.caretIndex > 0) {
                this.caretIndex--;
                this.text = this.text.slice(0, this.caretIndex) + this.text.slice(this.caretIndex + 1);
                this.#caretVisible = true;
                this.#commitChange();
            }
            return;
        }

        if (key === 'Delete') {
            // Delete selected text first if there is a selection
            if (this.#deleteSelectedText()) {
                this.#caretVisible = true;
                this.#commitChange();
                return;
            }
            if (this.caretIndex < this.text.length) {
                this.text = this.text.slice(0, this.caretIndex) + this.text.slice(this.caretIndex + 1);
                this.#caretVisible = true;
                this.#commitChange();
            }
            return;
        }

        if (key === 'Enter') {
            if (this.#multiline) {
                // Cancel composition first
                if (this.#compositionActive) {
                    this.#compositionActive = false;
                    this.#compositionText = '';
                }
                if (this.#deleteSelectedText()) {
                    this.#caretVisible = true;
                    this.#updateVisual();
                }
                if (this.maxLength !== null && this.text.length >= this.maxLength) {
                    return;
                }
                this.text = this.text.slice(0, this.caretIndex) + '\n' + this.text.slice(this.caretIndex);
                this.caretIndex++;
                this.#commitChange();
            } else {
                this.dispatchEvent(new Event('submit', { input: this, text: this.text }));
            }
            return;
        }

        // Paste: Ctrl+V or Cmd+V
        if ((key === 'v' || key === 'V') && (ctrlKey || metaKey)) {
            this.#paste();
            return;
        }

        // Character input is now handled exclusively by textInput events
        // This prevents double-insertion when both keydown and textInput events fire
        return;
    }

    #commitChange() {
        this.#clearSelection();
        this.dispatchEvent(new Event('change', { input: this, text: this.text }));
        this.#updateVisual();
    }

    applyState(state) {
        super.applyState(this.enabled ? state : 'disabled');
    }

    redraw(state, attrs) {
        this.#textNode.font = attrs.font;
        this.#caretNode.font = attrs.font;
        this.#fontHeight = this.#textNode.font?.height || 16;
        this.#lineHeight = this.#computeLineAdvance();
        this.#wrappedLinesDirty = true;
        this.#redraw(state, attrs);
        this.#updateVisual();
    }

    resize() {
        super.resize();
        this.#wrappedLinesDirty = true;
        this.#updateBackgroundSize();
        this.#updateVisual();
    }
}
