import { sd } from './StableDiffusion.js';

export async function imageGen(prompt, width=768, height=768, seed = -1) {
    return await sd.txt2img(prompt, {
        width,
        height,
        seed,
        cfgScale: settings.sdCfgScale ?? 7.0,
        clipSkip: settings.sdClipSkip ?? 2,
        steps: settings.sdSteps ?? 30,
        negativePrompt: settings.sdNegativePrompt ?? 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality',
        outputFormat: 'png',
        outputCompression: 90,
    });
}
