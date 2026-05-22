export class StableDiffusion {
    constructor(baseUrl = settings.sdServerEndpoint) {
        this.baseUrl = baseUrl;
    }

    async _request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const rsp = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers,
            },
        });
        if (!rsp.ok) {
            const err = await rsp.json().catch(() => ({ error: rsp.statusText }));
            throw new Error(url + ': ' + (err.error || err.message || `HTTP ${rsp.status}`));
        }
        return rsp.json();
    }

    async txt2img(prompt, options = {}) {
        const args = {
            prompt,
            negative_prompt: options.negativePrompt || 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality',
            width: options.width || 512,
            height: options.height || 512,
            cfg_scale: options.cfgScale ?? 7.0,
            seed: options.seed ?? -1,
            clip_skip: options.clipSkip ?? 2,
            steps: options.steps || 20,
            sampler_name: options.sampler || '',
            scheduler: options.scheduler || '',
            ...options.extraArgs,
        };

        const body = JSON.stringify({
            prompt: `<sd_cpp_extra_args>${JSON.stringify(args)}</sd_cpp_extra_args>`,
            n: options.n || 1,
            size: `${args.width}x${args.height}`,
            output_format: options.outputFormat || 'png',
            output_compression: options.outputCompression ?? 90,
        });

        const json = await this._request('/v1/images/generations', {
            method: 'POST',
            body,
        });

        const results = (json.data || []).map(item => new Image(`data:image/png;base64,${item.b64_json}`));
        if (results.length === 0) {
            throw new Error('Failed to generate image');
        }
        return results.length === 1 ? results[0] : results;
    }

    async inpaint(image, mask, prompt, options = {}) {
        const formData = new FormData();
        formData.append('prompt', `<sd_cpp_extra_args>${JSON.stringify({
            prompt,
            negative_prompt: options.negativePrompt || '',
            width: options.width || 512,
            height: options.height || 512,
            cfg_scale: options.cfgScale ?? 7.0,
            seed: options.seed ?? -1,
            clip_skip: options.clipSkip ?? 2,
            steps: options.steps || 20,
            ...options.extraArgs,
        })}</sd_cpp_extra_args>`);
        formData.append('image[]', await this._imageToBlob(image));
        formData.append('mask', await this._imageToBlob(mask));
        formData.append('n', String(options.n || 1));
        formData.append('size', `${options.width || 512}x${options.height || 512}`);
        formData.append('output_format', options.outputFormat || 'png');
        formData.append('output_compression', String(options.outputCompression ?? 90));

        const url = `${this.baseUrl}/v1/images/edits`;
        const rsp = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!rsp.ok) {
            const err = await rsp.json().catch(() => ({ error: rsp.statusText }));
            throw new Error(err.error || err.message || `HTTP ${rsp.status}`);
        }

        const json = await rsp.json();
        const results = (json.data || []).map(item => new Image(`data:image/png;base64,${item.b64_json}`));
        if (results.length === 0) {
            throw new Error('Failed to generate image');
        }
        return results.length === 1 ? results[0] : results;
    }

    async txt2imgSD(prompt, options = {}) {
        const body = {
            prompt,
            negative_prompt: options.negativePrompt || '',
            width: options.width || 512,
            height: options.height || 512,
            steps: options.steps || 20,
            cfg_scale: options.cfgScale ?? 7.0,
            seed: options.seed ?? -1,
            batch_size: options.batchSize || 1,
            clip_skip: options.clipSkip ?? -1,
            sampler_name: options.sampler || '',
            scheduler: options.scheduler || '',
            lora: options.lora ? options.lora.map(l => ({
                path: l.path,
                multiplier: l.multiplier ?? 1.0,
                is_high_noise: l.isHighNoise ?? false,
            })) : undefined,
            ...options.extraArgs,
        };

        const json = await this._request('/sdapi/v1/txt2img', {
            method: 'POST',
            body: JSON.stringify(body),
        });

        return this._parseSDResponse(json);
    }

    async img2img(initImage, prompt, options = {}) {
        const body = {
            prompt,
            negative_prompt: options.negativePrompt || '',
            init_images: [await this._imageToDataURL(initImage)],
            width: options.width || 512,
            height: options.height || 512,
            steps: options.steps || 20,
            cfg_scale: options.cfgScale ?? 7.0,
            seed: options.seed ?? -1,
            batch_size: options.batchSize || 1,
            clip_skip: options.clipSkip ?? -1,
            sampler_name: options.sampler || '',
            scheduler: options.scheduler || '',
            denoising_strength: options.denoisingStrength ?? 0.75,
            inpainting_mask_invert: options.invertMask ? 1 : 0,
            mask: options.mask ? await this._imageToDataURL(options.mask) : undefined,
            lora: options.lora ? options.lora.map(l => ({
                path: l.path,
                multiplier: l.multiplier ?? 1.0,
                is_high_noise: l.isHighNoise ?? false,
            })) : undefined,
            ...options.extraArgs,
        };

        const json = await this._request('/sdapi/v1/img2img', {
            method: 'POST',
            body: JSON.stringify(body),
        });

        return this._parseSDResponse(json);
    }

    _parseSDResponse(json) {
        const images = (json.images || []).map(b64 => new Image(`data:image/png;base64,${b64}`));
        if (images.length === 0) {
            throw new Error('Failed to generate image');
        }
        return {
            images,
            parameters: json.parameters,
            info: json.info,
        };
    }

    async getLoras() {
        const json = await this._request('/sdapi/v1/loras');
        return json.map(item => ({
            name: item.name,
            path: item.path,
        }));
    }

    async getSamplers() {
        const json = await this._request('/sdapi/v1/samplers');
        return json.map(item => ({
            name: item.name,
            aliases: item.aliases || [],
            options: item.options || {},
        }));
    }

    async getSchedulers() {
        const json = await this._request('/sdapi/v1/schedulers');
        return json.map(item => ({
            name: item.name,
            label: item.label,
        }));
    }

    async getModels() {
        const json = await this._request('/sdapi/v1/sd-models');
        return json.map(item => ({
            title: item.title,
            modelName: item.model_name,
            filename: item.filename,
            hash: item.hash,
            sha256: item.sha256,
            config: item.config,
        }));
    }

    async getOptions() {
        const json = await this._request('/sdapi/v1/options');
        return {
            samplesFormat: json.samples_format,
            sdModelCheckpoint: json.sd_model_checkpoint,
        };
    }

    async _imageToBlob(image) {
        if (image instanceof Image) {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            return new Promise(resolve => {
                canvas.toBlob(blob => resolve(blob), 'image/png');
            });
        }
        return image;
    }

    async _imageToDataURL(image) {
        if (image instanceof Image) {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            return canvas.toDataURL('image/png');
        }
        return image;
    }
}

export const sd = new StableDiffusion();
