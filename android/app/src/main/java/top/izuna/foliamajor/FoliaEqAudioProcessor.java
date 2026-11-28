package top.izuna.foliamajor;

import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;
import java.nio.ByteBuffer;

/**
 * Folia's native equalizer for the ExoPlayer engine: a preamp first, ten RBJ ("Audio EQ Cookbook") biquad bands in
 * double precision, and a look-ahead brickwall limiter last, so a boost cannot clip. Works on 16-bit and float PCM
 * and writes the same encoding back. Settings come from the WebView through {@link #applySettings}.
 */
public final class FoliaEqAudioProcessor extends BaseAudioProcessor {
    public static final int BAND_COUNT = 10;
    private static final double[] BAND_HZ = {31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000};
    private static final double[] BAND_Q = {0.70710678, 0.85, 1.0, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 0.70710678};
    private static final double LIMIT_LINEAR = Math.pow(10.0, -1.0 / 20.0);
    private static final double LOOKAHEAD_SECONDS = 0.002;
    private static final double RELEASE_SECONDS = 0.08;
    private static final double PREAMP_SECONDS = 0.02;
    private static final int COEFF_RAMP_FRAMES = 480;
    private static final int MAX_CHANNELS = 8;

    /** Immutable snapshot of what the listener set. */
    private static final class Settings {
        final boolean enabled;
        final double[] gainsDb;
        final double preampDb;
        final boolean limiter;

        Settings(boolean enabled, double[] gainsDb, double preampDb, boolean limiter) {
            this.enabled = enabled;
            this.gainsDb = gainsDb;
            this.preampDb = preampDb;
            this.limiter = limiter;
        }
    }

    private static volatile Settings latest = new Settings(false, new double[BAND_COUNT], 0.0, true);
    private static volatile int latestVersion = 0;

    // What the live processor reports back, so the app can show that the native EQ really is processing.
    private static volatile boolean statusConfigured = false;
    private static volatile int statusSampleRate = 0;
    private static volatile int statusChannels = 0;
    private static volatile String statusFormat = "";
    private static volatile long statusFrames = 0L;
    private static volatile int statusAppliedVersion = -1;
    private static volatile boolean statusEnabled = false;
    private static volatile double statusPreampDb = 0.0;
    private static volatile double statusMaxReduction = 1.0; // lowest limiter gain since the last read

    public static org.json.JSONObject readStatus() {
        org.json.JSONObject o = new org.json.JSONObject();
        try {
            double minGain = statusMaxReduction;
            statusMaxReduction = 1.0;
            o.put("configured", statusConfigured);
            o.put("sampleRate", statusSampleRate);
            o.put("channels", statusChannels);
            o.put("format", statusFormat);
            o.put("frames", statusFrames);
            o.put("settingsSent", latestVersion);
            o.put("settingsApplied", statusAppliedVersion);
            o.put("enabled", statusEnabled);
            o.put("preampDb", statusPreampDb);
            o.put("limiterReductionDb", minGain >= 1.0 ? 0.0 : -20.0 * Math.log10(minGain));
        } catch (org.json.JSONException ignored) {
            // Keys are fixed strings; cannot fail.
        }
        return o;
    }

    /** Called from the bridge on any thread. gainsDb has one value per band (de-cumulated by the caller). */
    public static void applySettings(boolean enabled, double[] gainsDb, double preampDb, boolean limiter) {
        double[] g = new double[BAND_COUNT];
        if (gainsDb != null) {
            for (int i = 0; i < BAND_COUNT && i < gainsDb.length; i++) {
                double v = gainsDb[i];
                g[i] = Double.isNaN(v) ? 0.0 : Math.max(-12.0, Math.min(12.0, v));
            }
        }
        double p = Double.isNaN(preampDb) ? 0.0 : Math.max(-12.0, Math.min(0.0, preampDb));
        latest = new Settings(enabled, g, p, limiter);
        latestVersion++;
    }

    private int channels;
    private int sampleRate;
    private boolean floatPcm;
    private int appliedVersion = -1;

    // Per band, per coefficient set: b0,b1,b2,a1,a2 (normalised by a0).
    private final double[][] coeffNow = new double[BAND_COUNT][5];
    private final double[][] coeffFrom = new double[BAND_COUNT][5];
    private final double[][] coeffTo = new double[BAND_COUNT][5];
    private int rampLeft = 0;
    private final boolean[] bandActive = new boolean[BAND_COUNT];
    // TDF2 state: [channel][band][2]
    private double[][][] state = new double[MAX_CHANNELS][BAND_COUNT][2];

    private double preampNow = 1.0;
    private double preampTarget = 1.0;
    private double preampCoef = 0.0;
    private boolean limiterOn = true;
    private boolean enabledNow = false;

    // Limiter
    private int window = 1;
    private double[][] delay;
    private int delayPos = 0;
    private int[] dequeIdx;
    private double[] dequeVal;
    private int dqHead = 0;
    private int dqSize = 0;
    private long frameCounter = 0;
    private double[] minRing;       // sliding-min outputs, for the box average
    private int minPos = 0;
    private double minSum = 0.0;
    private double smoothed = 1.0;
    private double releaseCoef = 0.0;

    @Override
    protected AudioFormat onConfigure(AudioFormat inputAudioFormat) throws UnhandledAudioFormatException {
        int enc = inputAudioFormat.encoding;
        if (enc != C.ENCODING_PCM_16BIT && enc != C.ENCODING_PCM_FLOAT) {
            statusConfigured = false;
            statusFormat = "unsupported:" + enc;
            return AudioFormat.NOT_SET;
        }
        if (inputAudioFormat.channelCount < 1 || inputAudioFormat.channelCount > MAX_CHANNELS
            || inputAudioFormat.sampleRate < 8000) {
            return AudioFormat.NOT_SET;
        }
        channels = inputAudioFormat.channelCount;
        sampleRate = inputAudioFormat.sampleRate;
        floatPcm = enc == C.ENCODING_PCM_FLOAT;
        resetDsp();
        statusConfigured = true;
        statusSampleRate = sampleRate;
        statusChannels = channels;
        statusFormat = floatPcm ? "float" : "pcm16";
        return inputAudioFormat;
    }

    private void resetDsp() {
        state = new double[MAX_CHANNELS][BAND_COUNT][2];
        window = Math.max(2, (int) Math.round(LOOKAHEAD_SECONDS * sampleRate));
        delay = new double[channels][window - 1];
        delayPos = 0;
        dequeIdx = new int[window + 1];
        dequeVal = new double[window + 1];
        dqHead = 0;
        dqSize = 0;
        frameCounter = 0;
        minRing = new double[window];
        java.util.Arrays.fill(minRing, 1.0);
        minPos = 0;
        minSum = window;
        smoothed = 1.0;
        releaseCoef = 1.0 - Math.exp(-1.0 / (RELEASE_SECONDS * sampleRate));
        preampCoef = 1.0 - Math.exp(-1.0 / (PREAMP_SECONDS * sampleRate));
        appliedVersion = -1;
        rampLeft = 0;
        for (int b = 0; b < BAND_COUNT; b++) {
            computeCoeffs(b, 0.0, coeffNow[b]);
            bandActive[b] = false;
        }
    }

    private void computeCoeffs(int band, double gainDb, double[] out) {
        if (Math.abs(gainDb) < 1e-6) {
            out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 0;
            return;
        }
        double freq = Math.min(BAND_HZ[band], sampleRate * 0.475);
        double a = Math.pow(10.0, gainDb / 40.0);
        double w0 = 2.0 * Math.PI * freq / sampleRate;
        double cosW = Math.cos(w0);
        double sinW = Math.sin(w0);
        double alpha = sinW / (2.0 * BAND_Q[band]);
        double b0, b1, b2, a0, a1, a2;
        if (band == 0) {
            double t = 2.0 * Math.sqrt(a) * alpha;
            b0 = a * ((a + 1) - (a - 1) * cosW + t);
            b1 = 2 * a * ((a - 1) - (a + 1) * cosW);
            b2 = a * ((a + 1) - (a - 1) * cosW - t);
            a0 = (a + 1) + (a - 1) * cosW + t;
            a1 = -2 * ((a - 1) + (a + 1) * cosW);
            a2 = (a + 1) + (a - 1) * cosW - t;
        } else if (band == BAND_COUNT - 1) {
            double t = 2.0 * Math.sqrt(a) * alpha;
            b0 = a * ((a + 1) + (a - 1) * cosW + t);
            b1 = -2 * a * ((a - 1) + (a + 1) * cosW);
            b2 = a * ((a + 1) + (a - 1) * cosW - t);
            a0 = (a + 1) - (a - 1) * cosW + t;
            a1 = 2 * ((a - 1) - (a + 1) * cosW);
            a2 = (a + 1) - (a - 1) * cosW - t;
        } else {
            b0 = 1 + alpha * a;
            b1 = -2 * cosW;
            b2 = 1 - alpha * a;
            a0 = 1 + alpha / a;
            a1 = -2 * cosW;
            a2 = 1 - alpha / a;
        }
        out[0] = b0 / a0;
        out[1] = b1 / a0;
        out[2] = b2 / a0;
        out[3] = a1 / a0;
        out[4] = a2 / a0;
    }

    private void pickUpSettings() {
        int version = latestVersion;
        if (version == appliedVersion) {
            return;
        }
        appliedVersion = version;
        statusAppliedVersion = version;
        Settings s = latest;
        statusEnabled = s.enabled;
        statusPreampDb = s.preampDb;
        enabledNow = s.enabled;
        limiterOn = s.enabled && s.limiter;
        preampTarget = s.enabled ? Math.pow(10.0, s.preampDb / 20.0) : 1.0;
        for (int b = 0; b < BAND_COUNT; b++) {
            System.arraycopy(coeffNow[b], 0, coeffFrom[b], 0, 5);
            computeCoeffs(b, s.enabled ? s.gainsDb[b] : 0.0, coeffTo[b]);
        }
        rampLeft = COEFF_RAMP_FRAMES;
    }

    @Override
    public void queueInput(ByteBuffer inputBuffer) {
        int remaining = inputBuffer.remaining();
        if (remaining == 0) {
            return;
        }
        int bytesPerSample = floatPcm ? 4 : 2;
        int frames = remaining / (bytesPerSample * channels);
        ByteBuffer out = replaceOutputBuffer(frames * bytesPerSample * channels);
        double[] frame = new double[channels];
        for (int f = 0; f < frames; f++) {
            for (int c = 0; c < channels; c++) {
                frame[c] = floatPcm ? inputBuffer.getFloat() : inputBuffer.getShort() / 32768.0;
            }
            if ((f & 63) == 0) {
                pickUpSettings();
            }
            processFrame(frame);
            for (int c = 0; c < channels; c++) {
                double v = frame[c];
                if (floatPcm) {
                    out.putFloat((float) v);
                } else {
                    long q = Math.round(v * 32768.0);
                    if (q > 32767) q = 32767;
                    if (q < -32768) q = -32768;
                    out.putShort((short) q);
                }
            }
        }
        statusFrames += frames;
        out.flip();
    }

    @Override
    protected void onQueueEndOfStream() {
        // Push the limiter's look-ahead out with silence so the last milliseconds are not lost.
        int tail = Math.max(0, window - 1);
        if (tail == 0 || channels == 0) {
            return;
        }
        int bytesPerSample = floatPcm ? 4 : 2;
        ByteBuffer out = replaceOutputBuffer(tail * bytesPerSample * channels);
        double[] frame = new double[channels];
        for (int f = 0; f < tail; f++) {
            java.util.Arrays.fill(frame, 0.0);
            processFrame(frame);
            for (int c = 0; c < channels; c++) {
                double v = frame[c];
                if (floatPcm) {
                    out.putFloat((float) v);
                } else {
                    long q = Math.round(v * 32768.0);
                    if (q > 32767) q = 32767;
                    if (q < -32768) q = -32768;
                    out.putShort((short) q);
                }
            }
        }
        out.flip();
    }

    @Override
    protected void onFlush() {
        if (channels > 0) {
            resetDsp();
        }
    }

    @Override
    protected void onReset() {
        channels = 0;
        sampleRate = 0;
    }

    private void processFrame(double[] frame) {
        // Preamp
        preampNow += (preampTarget - preampNow) * preampCoef;
        double gain = preampNow;
        if (gain != 1.0) {
            for (int c = 0; c < channels; c++) {
                frame[c] *= gain;
            }
        }
        // Bands
        double t = rampLeft > 0 ? 1.0 - (double) rampLeft / COEFF_RAMP_FRAMES : 1.0;
        for (int b = 0; b < BAND_COUNT; b++) {
            double[] k = coeffNow[b];
            if (rampLeft > 0) {
                double[] from = coeffFrom[b];
                double[] to = coeffTo[b];
                for (int i = 0; i < 5; i++) {
                    k[i] = from[i] + (to[i] - from[i]) * t;
                }
                bandActive[b] = true;
            }
            boolean identity = k[0] == 1.0 && k[1] == 0.0 && k[2] == 0.0 && k[3] == 0.0 && k[4] == 0.0;
            if (identity) {
                if (bandActive[b] && rampLeft == 0) {
                    bandActive[b] = false;
                    for (int c = 0; c < MAX_CHANNELS; c++) {
                        state[c][b][0] = 0.0;
                        state[c][b][1] = 0.0;
                    }
                }
                if (!bandActive[b]) {
                    continue;
                }
            }
            for (int c = 0; c < channels; c++) {
                double[] st = state[c][b];
                double x = frame[c];
                double y = k[0] * x + st[0];
                st[0] = k[1] * x - k[3] * y + st[1];
                st[1] = k[2] * x - k[4] * y;
                frame[c] = y;
            }
        }
        if (rampLeft > 0) {
            rampLeft--;
            if (rampLeft == 0) {
                for (int b = 0; b < BAND_COUNT; b++) {
                    System.arraycopy(coeffTo[b], 0, coeffNow[b], 0, 5);
                }
            }
        }
        // Limiter: look-ahead window of `window` frames, min filter then box average, slow release.
        double peak = 0.0;
        for (int c = 0; c < channels; c++) {
            double a = Math.abs(frame[c]);
            if (a > peak) peak = a;
        }
        double req = (limiterOn && peak > LIMIT_LINEAR) ? LIMIT_LINEAR / peak : 1.0;
        // sliding minimum over the last `window` requirements
        long now = frameCounter++;
        while (dqSize > 0) {
            int last = (dqHead + dqSize - 1) % dequeIdx.length;
            if (dequeVal[last] >= req) {
                dqSize--;
            } else {
                break;
            }
        }
        int slot = (dqHead + dqSize) % dequeIdx.length;
        dequeIdx[slot] = (int) (now & 0x7fffffffL);
        dequeVal[slot] = req;
        dqSize++;
        // drop expired entries (older than window frames); indices are compared modulo 2^31
        while (dqSize > 0) {
            int age = (int) ((now - dequeIdx[dqHead]) & 0x7fffffffL);
            if (age >= window) {
                dqHead = (dqHead + 1) % dequeIdx.length;
                dqSize--;
            } else {
                break;
            }
        }
        double windowMin = dequeVal[dqHead];
        minSum += windowMin - minRing[minPos];
        minRing[minPos] = windowMin;
        minPos = (minPos + 1) % window;
        double avg = minSum / window;
        if (avg > 1.0) avg = 1.0;
        if (avg < smoothed) {
            smoothed = avg;
        } else {
            smoothed += (avg - smoothed) * releaseCoef;
        }
        double g = smoothed;
        if (g < statusMaxReduction) {
            statusMaxReduction = g;
        }
        // Delay line of exactly window - 1 frames, which keeps every output sample inside the min-filter and box coverage.
        int readPos = delayPos;
        for (int c = 0; c < channels; c++) {
            double delayed = delay[c][readPos];
            delay[c][readPos] = frame[c];
            frame[c] = delayed * g;
        }
        delayPos = (delayPos + 1) % (window - 1);
    }
}
