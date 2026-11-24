import { getNativeVideoEncoderInfo } from '../services/android/foliaAndroidBridge';

// src/utils/videoExportProbe.ts
// Stage 0 of the 4K video export feature: finds out what this phone can do before anything is built on it.
// Reports the native encoders (MediaCodec), WebCodecs support, WebGL limits and how fast a 4K canvas draws and
// reads back. Only measures and reports; changes nothing.

const W = 3840;
const H = 2160;
const sleepFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const errText = (error: unknown) => (error instanceof Error ? error.message : String(error));

type Line = string;

const probeWebCodecs = async (): Promise<Line[]> => {
    const lines: Line[] = [];
    const Encoder = (globalThis as unknown as { VideoEncoder?: {
        isConfigSupported: (config: Record<string, unknown>) => Promise<{ supported?: boolean; config?: Record<string, unknown> }>;
    } }).VideoEncoder;
    if (!Encoder) {
        lines.push('WebCodecs VideoEncoder: not available in this WebView');
        return lines;
    }
    const candidates: Array<[string, string, number]> = [
        ['H.264 4K30', 'avc1.640033', 30],
        ['H.264 4K60', 'avc1.640034', 60],
        ['HEVC 4K60', 'hev1.1.6.L153.B0', 60],
    ];
    for (const [label, codec, framerate] of candidates) {
        try {
            const result = await Encoder.isConfigSupported({
                codec, width: W, height: H, framerate, bitrate: 40_000_000, hardwareAcceleration: 'prefer-hardware',
            });
            lines.push(`WebCodecs ${label}: ${result.supported ? 'yes' : 'no'}`);
        } catch (error) {
            lines.push(`WebCodecs ${label}: error ${errText(error)}`);
        }
    }
    return lines;
};

const probeWebGl = async (onProgress: (text: string) => void): Promise<Line[]> => {
    const lines: Line[] = [];
    try {
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
        if (!gl) {
            lines.push('WebGL2: not available');
            return lines;
        }
        const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
        lines.push(`WebGL2: max texture ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}, max renderbuffer ${gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)}, max viewport ${dims[0]}x${dims[1]}`);
        lines.push(`WebGL2 4K canvas: ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}${gl.drawingBufferWidth >= W && gl.drawingBufferHeight >= H ? ' (full size)' : ' (SMALLER than 4K)'}`);

        const compile = (type: number, source: string) => {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        };
        const program = gl.createProgram()!;
        gl.attachShader(program, compile(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
precision mediump float;uniform float t;out vec4 o;
void main(){vec2 u=gl_FragCoord.xy/vec2(${W}.,${H}.);float a=0.;
for(int i=0;i<24;i++){a+=sin(u.x*float(i+3)+t)*cos(u.y*float(i+5)-t);}
o=vec4(vec3(.5+.5*sin(a),.5+.5*cos(a*.7),u.x),1.);}`));
        gl.linkProgram(program);
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(program, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        const tLoc = gl.getUniformLocation(program, 't');
        onProgress('Testing 4K WebGL drawing...');
        const frames = 20;
        const start = performance.now();
        for (let i = 0; i < frames; i++) {
            gl.uniform1f(tLoc, i / 10);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.finish();
        }
        const ms = (performance.now() - start) / frames;
        lines.push(`WebGL 4K shader frame: ${round(ms)} ms (about ${round(1000 / ms)} fps if nothing else ran)`);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch (error) {
        lines.push(`WebGL test error: ${errText(error)}`);
    }
    return lines;
};

const probeCanvas2d = async (onProgress: (text: string) => void): Promise<Line[]> => {
    const lines: Line[] = [];
    try {
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (!ctx) {
            lines.push('Canvas2D 4K: could not create a 4K canvas');
            return lines;
        }
        onProgress('Testing 4K Canvas2D drawing...');
        const frames = 20;
        await sleepFrame();
        const start = performance.now();
        for (let i = 0; i < frames; i++) {
            const gradient = ctx.createLinearGradient(0, 0, W, H);
            gradient.addColorStop(0, `hsl(${(i * 12) % 360} 70% 40%)`);
            gradient.addColorStop(1, '#101020');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.shadowColor = 'rgba(120,180,255,0.9)';
            ctx.shadowBlur = 40;
            for (let k = 0; k < 120; k++) {
                ctx.beginPath();
                ctx.arc((k * 97 + i * 13) % W, (k * 61 + i * 7) % H, 30 + (k % 5) * 10, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.font = '160px sans-serif';
            ctx.fillText('Folia 4K', 200 + i * 5, 600);
        }
        // Force the queued canvas work to finish before stopping the clock.
        ctx.getImageData(0, 0, 1, 1);
        const drawMs = (performance.now() - start) / frames;
        lines.push(`Canvas2D 4K frame (gradient + 120 glowing circles + text): ${round(drawMs)} ms (about ${round(1000 / drawMs)} fps)`);

        onProgress('Testing 4K frame readback...');
        const readStart = performance.now();
        const reads = 3;
        for (let i = 0; i < reads; i++) {
            ctx.getImageData(0, 0, W, H);
        }
        const readMs = (performance.now() - readStart) / reads;
        lines.push(`Reading one 4K frame back to JS (about 33 MB): ${round(readMs)} ms`);

        const VideoFrameCtor = (globalThis as unknown as { VideoFrame?: new (source: CanvasImageSource, init: { timestamp: number }) => { close: () => void } }).VideoFrame;
        if (VideoFrameCtor) {
            const frameStart = performance.now();
            for (let i = 0; i < reads; i++) {
                const frame = new VideoFrameCtor(canvas, { timestamp: i * 16_667 });
                frame.close();
            }
            lines.push(`Canvas to VideoFrame (no copy path): ${round((performance.now() - frameStart) / reads, 2)} ms`);
        } else {
            lines.push('VideoFrame: not available');
        }
    } catch (error) {
        lines.push(`Canvas2D 4K test error: ${errText(error)}`);
    }
    return lines;
};

const probeNative = async (): Promise<Line[]> => {
    const lines: Line[] = [];
    try {
        const info = await getNativeVideoEncoderInfo();
        if (!info) {
            lines.push('Native encoder info: not available (not running in the Android app, or the native part is missing)');
            return lines;
        }
        lines.push(`Phone: ${info.model ?? '?'}, Android API ${info.sdk ?? '?'}, chip ${info.soc ?? '?'}, RAM ${info.totalRamMb ?? '?'} MB`);
        const encoders = info.encoders ?? [];
        if (encoders.length === 0) lines.push('Native video encoders: none found');
        for (const e of encoders) {
            lines.push(
                `Native ${e.mime} encoder ${e.name} [${e.hardware ? 'hardware' : 'software'}]: 4K ${e.supports4k ? 'yes' : 'no'}`
                + (e.supports4k ? `, max fps at 4K ${e.maxFps4k ?? '?'}, 4K60 ${e.supports4k60 ? 'yes' : 'no'}` : '')
                + `, max bitrate ${e.maxBitrateMbps ?? '?'} Mbps`,
            );
        }
    } catch (error) {
        lines.push(`Native encoder info error: ${errText(error)}`);
    }
    return lines;
};

export const runVideoExportProbe = async (onProgress: (text: string) => void): Promise<string> => {
    onProgress('Reading phone and encoder info...');
    const native = await probeNative();
    onProgress('Checking WebCodecs...');
    const codecs = await probeWebCodecs();
    const gl = await probeWebGl(onProgress);
    const canvas = await probeCanvas2d(onProgress);
    return [
        `Folia 4K video export check, ${new Date().toISOString()}`,
        `Target: ${W}x${H}`,
        ...native,
        ...codecs,
        ...gl,
        ...canvas,
    ].join('\n');
};
