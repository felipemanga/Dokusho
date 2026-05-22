import { CommonCache } from './CommonCache.js';

const frameCache = new CommonCache(100);

function colorBrightness(c) {
    return ((c & 0xFF) + ((c >> 8) & 0xFF) + ((c >> 16) & 0xFF)) / 3;
}

export function multiplyColor(c, f) {
    const rgb = [
        c & 0xFF,
        (c >> 8) & 0xFF,
        (c >> 16) & 0xFF
    ];

    rgb[0] *= f;
    rgb[1] *= f;
    rgb[2] *= f;

    if (rgb[0] > 255) rgb[0] = 255; else if (rgb[0] < 0) rgb[0] = 0;
    if (rgb[1] > 255) rgb[1] = 255; else if (rgb[1] < 0) rgb[1] = 0;
    if (rgb[2] > 255) rgb[2] = 255; else if (rgb[2] < 0) rgb[2] = 0;

    return rgb[0] | (rgb[1] << 8) | (rgb[2] << 16) | (0xFF000000);
}

function createFrame(innerWidth, innerHeight, attrs) {
    const marginTop = attrs.marginTop ?? 1;
    const marginRight = attrs.marginRight ?? 10;
    const marginBottom = attrs.marginBottom ?? 7;
    const marginLeft = attrs.marginLeft ?? 1;
    
    const paddingTop = attrs.paddingTop ?? 7;
    const paddingRight = attrs.paddingRight ?? 10;
    const paddingBottom = attrs.paddingBottom ?? 7;
    const paddingLeft = attrs.paddingLeft ?? 10;
    
    const radius = attrs.radius ?? 8;
    const color = attrs.backgroundColor ?? attrs.color;
    const elevation = attrs.elevation ?? 0;

    const w = Math.max(1, innerWidth | 0) + marginLeft + marginRight + paddingLeft + paddingRight;
    const h = Math.max(1, innerHeight | 0) + marginTop + marginBottom + paddingTop + paddingBottom;
    const img = new Image(w, h);

    const baseW = w - marginLeft - marginRight;
    const baseH = h - marginTop - marginBottom;
    const baseX = marginLeft;
    const baseY = marginTop;
    const shadow = 2;

    runGraph({
        nodes: [
            {
                id: 'A',
                type: 'fill',
                params: {
                    image: img,
                    color: 0x0,
                }
            },
            {
                id: 'B',
                type: 'squircle',
                params: {
                    image: {node: 'A', output: 'image'},
                    x: baseX + shadow + elevation,
                    y: baseY + shadow + elevation,
                    width: baseW,
                    height: baseH,
                    radius: radius,
                    color: 0x30000000,
                    antialias: true
                }
            },
            {
                id: 'C',
                type: 'blur',
                params: {
                    image: {node: 'B', output: 'image'},
                    radius: 3,
                    writeback: false,
                }
            },
            {
                id: 'C2',
                type: 'copy',
                params: {
                    source: {node: 'C', output: 'image'},
                    destination: {node: 'B', output: 'image'},
                }
            },
            {
                id: 'D',
                type: 'squircle',
                params: {
                    image: {node: 'C2', output: 'image'},
                    x: baseX,
                    y: baseY,
                    width: baseW,
                    height: baseH,
                    radius: radius,
                    color: color >>> 0,
                    antialias: true
                }
            },

            {
                id: 'E',
                type: 'newimage',
                params: {
                    width: w,
                    height: h,
                    color: elevation >= 1 ? 0xFFCCCCCC : 0xFF555555,
                }
            },
            {
                id: 'F',
                type: 'squircle',
                params: {
                    image: {node: 'E', output: 'image'},
                    x: baseX + elevation,
                    y: baseY + elevation,
                    width: baseW,
                    height: baseH,
                    radius: radius,
                    color: 0xFF7F7F7F,
                    antialias: true
                }
            },
            {
                id: 'G',
                type: 'blur',
                params: {
                    image: {node: 'F', output: 'image'},
                    radius: 2,
                    writeback: false
                }
            },
            {
                id: 'H',
                type: 'copy',
                params: {
                    destination: {node: 'G', output: 'image'},
                    source: {node: 'D', output: 'image'},
                    red: false,
                    green: false,
                    blue: false,
                    alpha: true
                }
            },
            {
                id: 'I',
                type: 'blit',
                params: {
                    source: {node: 'H', output: 'image'},
                    destination: {node: 'D', output: 'image'},
                    blendMode: 'hardlight',
                }
            }
        ]
    });

    return img;
}

export function getFrameImage(width, height, attrs) {
    const color = attrs.backgroundColor ?? attrs.color;
    const elevation = attrs.elevation ?? 0;
    const radius = attrs.radius ?? 8;
    const marginTop = attrs.marginTop ?? 1;
    const marginRight = attrs.marginRight ?? 10;
    const marginBottom = attrs.marginBottom ?? 7;
    const marginLeft = attrs.marginLeft ?? 1;
    const paddingTop = attrs.paddingTop ?? 7;
    const paddingRight = attrs.paddingRight ?? 10;
    const paddingBottom = attrs.paddingBottom ?? 7;
    const paddingLeft = attrs.paddingLeft ?? 10;
    const verbose = attrs.verbose ?? false;
    
    const key = `${width}x${height}_#${color.toString(16)}_e${elevation}_r${radius}_m${marginTop}_${marginRight}_${marginBottom}_${marginLeft}_p${paddingTop}_${paddingRight}_${paddingBottom}_${paddingLeft}`;
    
    const img = frameCache.get(key);
    if (img !== undefined) {
        return img;
    }
    if (verbose)
        console.log("creating frame:", key);
    const newImg = createFrame(width, height, attrs);
    frameCache.set(key, newImg);
    return newImg;
}

export function calculateNinePatchKey(attrs) {
    if (attrs.noFrame)
        return '';
    const color = attrs.backgroundColor ?? attrs.color;
    const elevation = attrs.elevation ?? 0;
    const radius = attrs.radius ?? 8;
    const innerWidth = 2;
    const innerHeight = 2;
    const marginTop = attrs.marginTop ?? 1;
    const marginRight = attrs.marginRight ?? 10;
    const marginBottom = attrs.marginBottom ?? 7;
    const marginLeft = attrs.marginLeft ?? 1;
    const paddingTop = attrs.paddingTop ?? 7;
    const paddingRight = attrs.paddingRight ?? 10;
    const paddingBottom = attrs.paddingBottom ?? 7;
    const paddingLeft = attrs.paddingLeft ?? 10;
    return [color, elevation, radius, marginTop, marginRight, marginBottom, marginLeft, paddingTop, paddingRight, paddingBottom, paddingLeft, innerWidth, innerHeight].join(':');
}

export function createNinePatchFrame(attrs) {
    if (attrs.noFrame)
        return null;
    const color = attrs.backgroundColor ?? attrs.color;
    const elevation = attrs.elevation ?? 0;
    const radius = attrs.radius ?? 8;
    const innerWidth = 2;
    const innerHeight = 2;
    const marginTop = attrs.marginTop ?? 1;
    const marginRight = attrs.marginRight ?? 10;
    const marginBottom = attrs.marginBottom ?? 7;
    const marginLeft = attrs.marginLeft ?? 1;
    const paddingTop = attrs.paddingTop ?? 7;
    const paddingRight = attrs.paddingRight ?? 10;
    const paddingBottom = attrs.paddingBottom ?? 7;
    const paddingLeft = attrs.paddingLeft ?? 10;
    
    const node = new NinePatch();

    node.image = getFrameImage(
        innerWidth + marginLeft + marginRight + paddingLeft + paddingRight,
        innerHeight + marginTop + marginBottom + paddingTop + paddingBottom,
        attrs
    );

    node.margins = [
        marginTop + radius + 1,
        marginRight + radius + 1,
        marginBottom + radius + 1,
        marginLeft + radius + 1
        // marginTop + paddingTop,
        // marginRight + paddingRight,
        // marginBottom + paddingBottom,
        // marginLeft + paddingLeft
    ];

    node.setInnerSize(innerWidth, innerHeight);

    node.key = [color, elevation, radius, marginTop, marginRight, marginBottom, marginLeft, paddingTop, paddingRight, paddingBottom, paddingLeft, innerWidth, innerHeight].join(':');

    return node;
}

export function clearFrameCache() {
    frameCache.clear();
}

export function getFrameCache() {
    return frameCache;
}
