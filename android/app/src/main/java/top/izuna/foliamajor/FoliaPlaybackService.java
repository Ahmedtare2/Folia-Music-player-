package top.izuna.foliamajor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import java.io.File;
import java.lang.ref.WeakReference;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * Android foreground MediaSession + AndroidX Media3 (ExoPlayer) hardware audio playback service.
 *
 * Architecture:
 * 1. Native Hardware Audio Decoding (ExoPlayer): Plays local Android SAF content:// URIs, pre-staged
 *    file:// URIs in context.getCacheDir()/saf_audio_stage/, and HTTP/HTTPS streams directly via
 *    Android's hardware MediaCodec pipeline outside the WebView.
 * 2. Native MediaSession Integration: Connects ExoPlayer to the service's MediaSession so lock-screen
 *    scrubbing, headset buttons, audio focus, and background track transitions work natively even when
 *    the screen is off and the WebView is suspended.
 * 3. High-Precision Lyric Clock Anchor: Emits exact (positionMs, elapsedRealtimeMs, isPlaying,
 *    playbackSpeed) clock anchors on play/pause/seek/track-change and periodic drift syncs while
 *    MainActivity is visible, and stops all UI event emissions when MainActivity is paused or the
 *    screen is off.
 */
public class FoliaPlaybackService extends Service {
    public static final String ACTION_UPDATE_STATE = "top.izuna.foliamajor.action.UPDATE_STATE";
    public static final String ACTION_SYNC_STATE = ACTION_UPDATE_STATE;
    public static final String ACTION_STOP_SERVICE = "top.izuna.foliamajor.action.STOP_SERVICE";
    public static final String ACTION_LOAD_TRACK = "top.izuna.foliamajor.action.LOAD_TRACK";
    public static final String ACTION_EXO_PLAY = "top.izuna.foliamajor.action.EXO_PLAY";
    public static final String ACTION_EXO_PAUSE = "top.izuna.foliamajor.action.EXO_PAUSE";
    public static final String ACTION_EXO_SEEK = "top.izuna.foliamajor.action.EXO_SEEK";

    public static final String ACTION_NOTIFICATION_PLAY = "top.izuna.foliamajor.action.NOTIFICATION_PLAY";
    public static final String ACTION_NOTIFICATION_PAUSE = "top.izuna.foliamajor.action.NOTIFICATION_PAUSE";
    public static final String ACTION_NOTIFICATION_PREV = "top.izuna.foliamajor.action.NOTIFICATION_PREV";
    public static final String ACTION_NOTIFICATION_NEXT = "top.izuna.foliamajor.action.NOTIFICATION_NEXT";

    public static final String EXTRA_URI = "uri";
    public static final String EXTRA_TRACK_ID = "trackId";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_ARTWORK_URL = "artworkUrl";
    public static final String EXTRA_DURATION_MS = "durationMs";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_AUTO_PLAY = "autoPlay";
    public static final String EXTRA_VOLUME = "volume";
    public static final String EXTRA_PLAYBACK_SPEED = "playbackSpeed";
    public static final String EXTRA_SPEED = EXTRA_PLAYBACK_SPEED;

    private static final String CHANNEL_ID = "folia_playback_channel";
    private static final int NOTIFICATION_ID = 1042;
    private static final long DRIFT_SYNC_INTERVAL_MS = 1000L;

    public static final class PlaybackClockSnapshot {
        public final String trackId;
        public final long positionMs;
        public final long durationMs;
        public final long bufferedPositionMs;
        public final long elapsedRealtimeMs;
        public final boolean isPlaying;
        public final float playbackSpeed;
        public final String playbackState;
        public final boolean ended;
        public final String reason;

        public PlaybackClockSnapshot(
            String trackId,
            long positionMs,
            long durationMs,
            long bufferedPositionMs,
            long elapsedRealtimeMs,
            boolean isPlaying,
            float playbackSpeed,
            String playbackState,
            boolean ended,
            String reason
        ) {
            this.trackId = trackId != null ? trackId : "";
            this.positionMs = Math.max(0L, positionMs);
            this.durationMs = Math.max(0L, durationMs);
            this.bufferedPositionMs = Math.max(0L, bufferedPositionMs);
            this.elapsedRealtimeMs = elapsedRealtimeMs;
            this.isPlaying = isPlaying;
            this.playbackSpeed = playbackSpeed > 0f ? playbackSpeed : 1.0f;
            this.playbackState = playbackState != null ? playbackState : "idle";
            this.ended = ended;
            this.reason = reason != null ? reason : "sync";
        }
    }

    private static WeakReference<FoliaPlaybackService> activeServiceRef = new WeakReference<>(null);
    private static volatile boolean playbackActive = false;
    private static volatile boolean nativeExoModeActive = false;
    private static volatile PlaybackClockSnapshot latestClockSnapshot = new PlaybackClockSnapshot(
        "",
        0L,
        0L,
        0L,
        SystemClock.elapsedRealtime(),
        false,
        1.0f,
        "idle",
        false,
        "init"
    );

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    @Nullable
    private ExoPlayer exoPlayer = null;
    @Nullable
    private androidx.media3.session.MediaSession media3Session = null;
    @Nullable
    private MediaSession platformMediaSession = null;
    private NotificationManager notificationManager;
    private boolean noisyReceiverRegistered = false;
    private boolean isForegroundStarted = false;
    private PowerManager.WakeLock wakeLock;
    private boolean driftSyncScheduled = false;

    private String currentTrackId = "";
    private String currentTitle = "Folia";
    private String currentArtist = "";
    private String currentAlbum = "";
    @Nullable
    private String currentArtworkUrl = null;
    private long currentDurationMs = 0L;
    private long currentPositionMs = 0L;
    private boolean currentIsPlaying = false;
    private float currentSpeed = 1.0f;
    private float currentVolume = 1.0f;

    private final Runnable driftSyncRunnable = new Runnable() {
        @Override
        public void run() {
            driftSyncScheduled = false;
            if (!MainActivity.isMainActivityForegroundVisible()) {
                // Strictly stop emitting UI drift events when MainActivity is paused or screen is off.
                return;
            }
            if (exoPlayer != null && nativeExoModeActive) {
                captureAndEmitClockAnchor("drift-sync", true);
                if (exoPlayer.isPlaying() && MainActivity.isMainActivityForegroundVisible()) {
                    scheduleNextDriftSync();
                }
            }
        }
    };

    public static boolean isPlaybackActive() {
        return playbackActive;
    }

    public static boolean isNativeExoModeActive() {
        return nativeExoModeActive;
    }

    @NonNull
    public static PlaybackClockSnapshot getPlaybackClockSnapshot() {
        FoliaPlaybackService svc = activeServiceRef.get();
        if (svc != null && Looper.myLooper() == Looper.getMainLooper()) {
            return svc.captureClockSnapshotInternal("poll");
        }
        return latestClockSnapshot;
    }

    public static void onMainActivityVisibilityChanged(boolean visible) {
        FoliaPlaybackService svc = activeServiceRef.get();
        if (svc == null) return;
        svc.mainHandler.post(() -> {
            if (!visible) {
                svc.stopDriftSync();
            } else if (nativeExoModeActive && svc.exoPlayer != null) {
                svc.captureAndEmitClockAnchor("resume-visibility", true);
                if (svc.exoPlayer.isPlaying()) {
                    svc.scheduleNextDriftSync();
                }
            }
        });
    }

    public static void commandLoadTrack(
        Context context,
        String rawUri,
        @Nullable String trackId,
        @Nullable String title,
        @Nullable String artist,
        @Nullable String album,
        @Nullable String artworkUrl,
        boolean autoPlay,
        long startPositionMs,
        float volume,
        float playbackSpeed
    ) {
        if (context == null || rawUri == null || rawUri.trim().isEmpty()) return;
        FoliaPlaybackService svc = activeServiceRef.get();
        if (svc != null) {
            svc.mainHandler.post(() -> svc.loadTrackInternal(
                rawUri.trim(),
                trackId,
                title,
                artist,
                album,
                artworkUrl,
                autoPlay,
                startPositionMs,
                volume,
                playbackSpeed
            ));
            return;
        }
        Intent intent = new Intent(context, FoliaPlaybackService.class);
        intent.setAction(ACTION_LOAD_TRACK);
        intent.putExtra(EXTRA_URI, rawUri.trim());
        intent.putExtra(EXTRA_TRACK_ID, trackId != null ? trackId : "");
        intent.putExtra(EXTRA_TITLE, title != null ? title : "Folia");
        intent.putExtra(EXTRA_ARTIST, artist != null ? artist : "");
        intent.putExtra(EXTRA_ALBUM, album != null ? album : "");
        intent.putExtra(EXTRA_ARTWORK_URL, artworkUrl != null ? artworkUrl : "");
        intent.putExtra(EXTRA_AUTO_PLAY, autoPlay);
        intent.putExtra(EXTRA_POSITION_MS, Math.max(0L, startPositionMs));
        intent.putExtra(EXTRA_VOLUME, volume);
        intent.putExtra(EXTRA_PLAYBACK_SPEED, playbackSpeed);
        try {
            if (autoPlay && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception ignored) {
            // Ignore service start exception
        }
    }

    public static void commandPlay(Context context) {
        FoliaPlaybackService svc = activeServiceRef.get();
        if (svc != null) {
            svc.mainHandler.post(svc::playInternal);
        } else if (context != null) {
            Intent intent = new Intent(context, FoliaPlaybackService.class);
            intent.setAction(ACTION_EXO_PLAY);
            try {
                context.startService(intent);
            } catch (Exception ignored) {}
        }
    }

    public static void commandPause(Context context) {
        FoliaPlaybackService svc = activeServiceRef.get();
        if (svc != null) {
            svc.mainHandler.post(svc::pauseInternal);
        } else if (context != null) {
            Intent intent = new Intent(context, FoliaPlaybackService.class);
            intent.setAction(ACTION_EXO_PAUSE);
            try {
                context.startService(intent);
            } catch (Exception ignored) {}
        }
    }

    public static void commandSeekTo(Context context, long positionMs) {
        FoliaPlaybackService svc = activeServiceRef.get();
        if (svc != null) {
            svc.mainHandler.post(() -> svc.seekToInternal(positionMs));
        } else if (context != null) {
            Intent intent = new Intent(context, FoliaPlaybackService.class);
            intent.setAction(ACTION_EXO_SEEK);
            intent.putExtra(EXTRA_POSITION_MS, Math.max(0L, positionMs));
            try {
                context.startService(intent);
            } catch (Exception ignored) {}
        }
    }

    public static void commandSetVolume(float volume) {
        FoliaPlaybackService svc = activeServiceRef.get();
        if (svc != null) {
            svc.mainHandler.post(() -> svc.setVolumeInternal(volume));
        }
    }

    public static void commandSetPlaybackSpeed(float speed) {
        FoliaPlaybackService svc = activeServiceRef.get();
        if (svc != null) {
            svc.mainHandler.post(() -> svc.setPlaybackSpeedInternal(speed));
        }
    }

    private final BroadcastReceiver becomingNoisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                if (nativeExoModeActive && exoPlayer != null) {
                    pauseInternal();
                }
                FoliaNativeBridgePlugin.dispatchMediaAction("pause", null);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        activeServiceRef = new WeakReference<>(this);
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Folia:AudioPlaybackWakeLock"
            );
            wakeLock.setReferenceCounted(false);
        }

        ensureNotificationChannel();
        initExoPlayerAndMediaSessions();
    }

    private void initExoPlayerAndMediaSessions() {
        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(this)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)
            .setEnableAudioFloatOutput(false);

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();

        exoPlayer = new ExoPlayer.Builder(this, renderersFactory)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build();

        exoPlayer.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (!nativeExoModeActive) return;
                currentIsPlaying = isPlaying;
                playbackActive = isPlaying;
                if (isPlaying) {
                    scheduleNextDriftSync();
                } else {
                    stopDriftSync();
                }
                captureAndEmitClockAnchor(isPlaying ? "play" : "pause", true);
                syncNotificationAndPlatformSession();
            }

            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (!nativeExoModeActive || exoPlayer == null) return;
                long dur = exoPlayer.getDuration();
                if (dur != C.TIME_UNSET && dur > 0L) {
                    currentDurationMs = dur;
                }
                if (playbackState == Player.STATE_ENDED) {
                    currentIsPlaying = false;
                    playbackActive = false;
                    stopDriftSync();
                    captureAndEmitClockAnchor("ended", true);
                    syncNotificationAndPlatformSession();
                    // Notify frontend or advance queue when track finishes
                    FoliaNativeBridgePlugin.dispatchMediaAction("nexttrack", null);
                } else if (playbackState == Player.STATE_READY) {
                    captureAndEmitClockAnchor("ready", true);
                    syncNotificationAndPlatformSession();
                }
            }

            @Override
            public void onPositionDiscontinuity(
                @NonNull Player.PositionInfo oldPosition,
                @NonNull Player.PositionInfo newPosition,
                int reason
            ) {
                if (!nativeExoModeActive) return;
                captureAndEmitClockAnchor("seek", true);
                syncNotificationAndPlatformSession();
            }

            @Override
            public void onPlaybackParametersChanged(@NonNull PlaybackParameters playbackParameters) {
                if (!nativeExoModeActive) return;
                currentSpeed = playbackParameters.speed;
                captureAndEmitClockAnchor("speed-change", true);
                syncNotificationAndPlatformSession();
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                if (!nativeExoModeActive) return;
                stopDriftSync();
                captureAndEmitClockAnchor("error", true);
            }
        });

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent sessionActivityPendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            media3Session = new androidx.media3.session.MediaSession.Builder(this, exoPlayer)
                .setSessionActivity(sessionActivityPendingIntent)
                .setId("FoliaMedia3Session")
                .build();
        } catch (Exception ignored) {
            media3Session = null;
        }

        platformMediaSession = new MediaSession(this, "FoliaMediaSession");
        platformMediaSession.setSessionActivity(sessionActivityPendingIntent);
        platformMediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                if (nativeExoModeActive && exoPlayer != null) {
                    playInternal();
                }
                FoliaNativeBridgePlugin.dispatchMediaAction("play", null);
            }

            @Override
            public void onPause() {
                if (nativeExoModeActive && exoPlayer != null) {
                    pauseInternal();
                }
                FoliaNativeBridgePlugin.dispatchMediaAction("pause", null);
            }

            @Override
            public void onSkipToNext() {
                FoliaNativeBridgePlugin.dispatchMediaAction("nexttrack", null);
            }

            @Override
            public void onSkipToPrevious() {
                FoliaNativeBridgePlugin.dispatchMediaAction("previoustrack", null);
            }

            @Override
            public void onSeekTo(long pos) {
                if (nativeExoModeActive && exoPlayer != null) {
                    seekToInternal(pos);
                }
                FoliaNativeBridgePlugin.dispatchMediaAction("seekto", pos);
            }

            @Override
            public void onStop() {
                if (nativeExoModeActive && exoPlayer != null) {
                    pauseInternal();
                }
                FoliaNativeBridgePlugin.dispatchMediaAction("stop", null);
            }
        });
        platformMediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        // Always satisfy Android 8-16's strict Context.startForegroundService() contract synchronously
        // inside onStartCommand before any async handler post so ForegroundServiceDidNotStartInTimeException
        // can never be thrown even if playback is buffering, paused, or immediately stopped.
        promoteToForegroundImmediate();
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            if (ACTION_LOAD_TRACK.equals(action)) {
                String rawUri = intent.getStringExtra(EXTRA_URI);
                String trackId = intent.getStringExtra(EXTRA_TRACK_ID);
                String title = intent.getStringExtra(EXTRA_TITLE);
                String artist = intent.getStringExtra(EXTRA_ARTIST);
                String album = intent.getStringExtra(EXTRA_ALBUM);
                String artworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL);
                boolean autoPlay = intent.getBooleanExtra(EXTRA_AUTO_PLAY, true);
                long startPosMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L);
                float vol = intent.getFloatExtra(EXTRA_VOLUME, 1.0f);
                float speed = intent.getFloatExtra(EXTRA_PLAYBACK_SPEED, 1.0f);
                if (rawUri != null && !rawUri.isEmpty()) {
                    mainHandler.post(() -> loadTrackInternal(
                        rawUri,
                        trackId,
                        title,
                        artist,
                        album,
                        artworkUrl,
                        autoPlay,
                        startPosMs,
                        vol,
                        speed
                    ));
                }
            } else if (ACTION_EXO_PLAY.equals(action)) {
                mainHandler.post(this::playInternal);
            } else if (ACTION_EXO_PAUSE.equals(action)) {
                mainHandler.post(this::pauseInternal);
            } else if (ACTION_EXO_SEEK.equals(action)) {
                long seekPos = intent.getLongExtra(EXTRA_POSITION_MS, 0L);
                mainHandler.post(() -> seekToInternal(seekPos));
            } else if (ACTION_UPDATE_STATE.equals(action)) {
                String title = intent.getStringExtra(EXTRA_TITLE);
                String artist = intent.getStringExtra(EXTRA_ARTIST);
                String album = intent.getStringExtra(EXTRA_ALBUM);
                String artworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL);
                long durationMs = intent.getLongExtra(EXTRA_DURATION_MS, 0L);
                long positionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L);
                boolean isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);
                float speed = intent.getFloatExtra(EXTRA_PLAYBACK_SPEED, 1.0f);

                mainHandler.post(() -> applyStateUpdate(
                    title != null ? title : "Folia",
                    artist != null ? artist : "",
                    album != null ? album : "",
                    artworkUrl,
                    durationMs,
                    positionMs,
                    isPlaying,
                    speed
                ));
            } else if (ACTION_NOTIFICATION_PLAY.equals(action)) {
                mainHandler.post(() -> {
                    if (nativeExoModeActive && exoPlayer != null) {
                        playInternal();
                    }
                    FoliaNativeBridgePlugin.dispatchMediaAction("play", null);
                });
            } else if (ACTION_NOTIFICATION_PAUSE.equals(action)) {
                mainHandler.post(() -> {
                    if (nativeExoModeActive && exoPlayer != null) {
                        pauseInternal();
                    }
                    FoliaNativeBridgePlugin.dispatchMediaAction("pause", null);
                });
            } else if (ACTION_NOTIFICATION_PREV.equals(action)) {
                FoliaNativeBridgePlugin.dispatchMediaAction("previoustrack", null);
            } else if (ACTION_NOTIFICATION_NEXT.equals(action)) {
                FoliaNativeBridgePlugin.dispatchMediaAction("nexttrack", null);
            } else if (ACTION_STOP_SERVICE.equals(action)) {
                mainHandler.post(this::clearAndStopPlayback);
            }
        }
        return START_STICKY;
    }

    private void loadTrackInternal(
        String rawUriOrUrl,
        @Nullable String trackId,
        @Nullable String title,
        @Nullable String artist,
        @Nullable String album,
        @Nullable String artworkUrl,
        boolean autoPlay,
        long startPositionMs,
        float volume,
        float speed
    ) {
        if (exoPlayer == null) {
            initExoPlayerAndMediaSessions();
        }
        if (exoPlayer == null) return;

        nativeExoModeActive = true;
        this.currentTrackId = trackId != null ? trackId : "";
        this.currentTitle = (title != null && !title.isEmpty()) ? title : "Folia";
        this.currentArtist = artist != null ? artist : "";
        this.currentAlbum = album != null ? album : "";
        this.currentArtworkUrl = artworkUrl;
        this.currentVolume = Math.max(0f, Math.min(1f, volume));
        this.currentSpeed = speed > 0f ? speed : 1.0f;

        Uri resolvedUri = resolvePlayableUri(this, rawUriOrUrl);
        androidx.media3.common.MediaMetadata.Builder metaBuilder = new androidx.media3.common.MediaMetadata.Builder()
            .setTitle(this.currentTitle)
            .setArtist(this.currentArtist)
            .setAlbumTitle(this.currentAlbum);
        if (artworkUrl != null && !artworkUrl.isEmpty()) {
            try {
                metaBuilder.setArtworkUri(Uri.parse(artworkUrl));
            } catch (Exception ignored) {}
        }

        MediaItem mediaItem = new MediaItem.Builder()
            .setMediaId(this.currentTrackId.isEmpty() ? resolvedUri.toString() : this.currentTrackId)
            .setUri(resolvedUri)
            .setMediaMetadata(metaBuilder.build())
            .build();

        exoPlayer.setVolume(this.currentVolume);
        exoPlayer.setPlaybackSpeed(this.currentSpeed);
        exoPlayer.setMediaItem(mediaItem, Math.max(0L, startPositionMs));
        exoPlayer.prepare();
        exoPlayer.setPlayWhenReady(autoPlay);

        this.currentIsPlaying = autoPlay;
        playbackActive = autoPlay;
        captureAndEmitClockAnchor("track-change", true);
        syncNotificationAndPlatformSession();
        if (autoPlay) {
            scheduleNextDriftSync();
        }
    }

    private void playInternal() {
        if (exoPlayer == null) return;
        nativeExoModeActive = true;
        if (exoPlayer.getPlaybackState() == Player.STATE_IDLE) {
            exoPlayer.prepare();
        } else if (exoPlayer.getPlaybackState() == Player.STATE_ENDED) {
            exoPlayer.seekTo(0L);
        }
        exoPlayer.play();
        currentIsPlaying = true;
        playbackActive = true;
        captureAndEmitClockAnchor("play", true);
        syncNotificationAndPlatformSession();
        scheduleNextDriftSync();
    }

    private void pauseInternal() {
        if (exoPlayer == null) return;
        exoPlayer.pause();
        currentIsPlaying = false;
        playbackActive = false;
        stopDriftSync();
        captureAndEmitClockAnchor("pause", true);
        syncNotificationAndPlatformSession();
    }

    private void seekToInternal(long positionMs) {
        if (exoPlayer == null) return;
        long clamped = Math.max(0L, positionMs);
        exoPlayer.seekTo(clamped);
        currentPositionMs = clamped;
        captureAndEmitClockAnchor("seek", true);
        syncNotificationAndPlatformSession();
    }

    private void setVolumeInternal(float volume) {
        currentVolume = Math.max(0f, Math.min(1f, volume));
        if (exoPlayer != null) {
            exoPlayer.setVolume(currentVolume);
        }
    }

    private void setPlaybackSpeedInternal(float speed) {
        currentSpeed = Math.max(0.25f, Math.min(4.0f, speed > 0f ? speed : 1.0f));
        if (exoPlayer != null) {
            exoPlayer.setPlaybackSpeed(currentSpeed);
            captureAndEmitClockAnchor("speed-change", true);
            syncNotificationAndPlatformSession();
        }
    }

    private void scheduleNextDriftSync() {
        if (driftSyncScheduled) return;
        if (!MainActivity.isMainActivityForegroundVisible()) return;
        driftSyncScheduled = true;
        mainHandler.postDelayed(driftSyncRunnable, DRIFT_SYNC_INTERVAL_MS);
    }

    private void stopDriftSync() {
        if (driftSyncScheduled) {
            mainHandler.removeCallbacks(driftSyncRunnable);
            driftSyncScheduled = false;
        }
    }

    @NonNull
    private PlaybackClockSnapshot captureClockSnapshotInternal(String reason) {
        if (exoPlayer != null && nativeExoModeActive) {
            long pos = Math.max(0L, exoPlayer.getCurrentPosition());
            long durRaw = exoPlayer.getDuration();
            long dur = (durRaw != C.TIME_UNSET && durRaw > 0L) ? durRaw : Math.max(0L, currentDurationMs);
            long bufRaw = exoPlayer.getBufferedPosition();
            long buf = (bufRaw != C.TIME_UNSET && bufRaw > 0L) ? bufRaw : pos;
            boolean playing = exoPlayer.isPlaying();
            float speed = exoPlayer.getPlaybackParameters().speed;
            int stateInt = exoPlayer.getPlaybackState();
            String stateStr;
            if (stateInt == Player.STATE_BUFFERING) {
                stateStr = "buffering";
            } else if (stateInt == Player.STATE_READY) {
                stateStr = "ready";
            } else if (stateInt == Player.STATE_ENDED) {
                stateStr = "ended";
            } else {
                stateStr = "idle";
            }
            currentPositionMs = pos;
            if (dur > 0L) currentDurationMs = dur;
            currentIsPlaying = playing;
            currentSpeed = speed;
            PlaybackClockSnapshot snap = new PlaybackClockSnapshot(
                currentTrackId,
                pos,
                dur,
                buf,
                SystemClock.elapsedRealtime(),
                playing,
                speed,
                stateStr,
                stateInt == Player.STATE_ENDED,
                reason
            );
            latestClockSnapshot = snap;
            return snap;
        }
        PlaybackClockSnapshot fallback = new PlaybackClockSnapshot(
            currentTrackId,
            currentPositionMs,
            currentDurationMs,
            currentPositionMs,
            SystemClock.elapsedRealtime(),
            currentIsPlaying,
            currentSpeed,
            currentIsPlaying ? "ready" : "idle",
            false,
            reason
        );
        latestClockSnapshot = fallback;
        return fallback;
    }

    private void captureAndEmitClockAnchor(String reason, boolean notifyUiIfVisible) {
        PlaybackClockSnapshot snapshot = captureClockSnapshotInternal(reason);
        if (notifyUiIfVisible && MainActivity.isMainActivityForegroundVisible()) {
            FoliaNativeBridgePlugin.dispatchPlaybackClockAnchor(snapshot);
        }
    }

    @NonNull
    public static Uri resolvePlayableUri(Context context, String rawUriOrUrl) {
        String trimmed = rawUriOrUrl != null ? rawUriOrUrl.trim() : "";
        // If the frontend passed a same-origin SAF stream URL (https://localhost/__folia_saf/stream?uri=content%3A...),
        // unwrap the underlying content:// URI so ExoPlayer reads it directly or from the pre-staged cache file.
        if (trimmed.contains(FoliaSafStreamHandler.STREAM_PATH)) {
            try {
                Uri wrapper = Uri.parse(trimmed);
                String embeddedUri = wrapper.getQueryParameter("uri");
                if (embeddedUri != null && !embeddedUri.isEmpty()) {
                    if (embeddedUri.startsWith("content%3A") || embeddedUri.startsWith("content%3a")
                        || embeddedUri.startsWith("file%3A") || embeddedUri.startsWith("http%3A")
                        || embeddedUri.startsWith("https%3A")) {
                        trimmed = URLDecoder.decode(embeddedUri, StandardCharsets.UTF_8.name());
                    } else {
                        trimmed = embeddedUri;
                    }
                }
            } catch (Exception ignored) {}
        }

        if (trimmed.startsWith("content://") && context != null) {
            File stagedFile = FoliaSafStreamHandler.getStagedAudioFileIfReady(context, trimmed);
            if (stagedFile == null) {
                stagedFile = FoliaSafStreamHandler.stageAudioUriToCache(context, trimmed);
            }
            if (stagedFile != null && stagedFile.isFile() && stagedFile.length() > 0L) {
                if (FoliaAlacAndPcmTranscoder.needsWavTranscode(stagedFile, null, trimmed, false)) {
                    File wavFile = FoliaAlacAndPcmTranscoder.transcodeToCachedWav(context, stagedFile, stagedFile.getName());
                    if (wavFile != null && wavFile.isFile() && wavFile.length() > 44L) {
                        return Uri.fromFile(wavFile);
                    }
                }
                return Uri.fromFile(stagedFile);
            }
            return Uri.parse(trimmed);
        }

        if (trimmed.startsWith("/")) {
            File localFile = new File(trimmed);
            if (localFile.exists()) {
                return Uri.fromFile(localFile);
            }
        }
        return Uri.parse(trimmed);
    }

    private void applyStateUpdate(
        String title,
        String artist,
        String album,
        @Nullable String artworkUrl,
        long durationMs,
        long positionMs,
        boolean isPlaying,
        float speed
    ) {
        this.currentTitle = title;
        this.currentArtist = artist;
        this.currentAlbum = album;
        this.currentArtworkUrl = artworkUrl;
        if (durationMs > 0L) {
            this.currentDurationMs = durationMs;
        }
        if (!nativeExoModeActive || exoPlayer == null) {
            this.currentPositionMs = Math.max(0L, positionMs);
            this.currentIsPlaying = isPlaying;
            this.currentSpeed = speed > 0f ? speed : 1.0f;
            playbackActive = isPlaying;
        } else {
            this.currentPositionMs = Math.max(0L, exoPlayer.getCurrentPosition());
            this.currentIsPlaying = exoPlayer.isPlaying();
        }

        syncNotificationAndPlatformSession();
    }

    private void promoteToForegroundImmediate() {
        if (isForegroundStarted) return;
        try {
            ensureNotificationChannel();
            Notification notification = buildNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            isForegroundStarted = true;
        } catch (Exception e) {
            if (notificationManager != null) {
                try {
                    notificationManager.notify(NOTIFICATION_ID, buildNotification());
                } catch (Exception ignored) {}
            }
        }
    }

    private void syncNotificationAndPlatformSession() {
        if (currentIsPlaying) {
            registerNoisyReceiverIfNeeded();
            acquireWakeLockIfNeeded();
        } else {
            unregisterNoisyReceiverIfNeeded();
            releaseWakeLockIfHeld();
        }

        updateMediaSessionState();
        Notification notification = buildNotification();

        if (!isForegroundStarted) {
            promoteToForegroundImmediate();
        } else if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, notification);
        }
    }

    private void updateMediaSessionState() {
        if (platformMediaSession == null) return;

        MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, currentDurationMs > 0 ? currentDurationMs : -1L);
        platformMediaSession.setMetadata(metaBuilder.build());

        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SEEK_TO
            | PlaybackState.ACTION_STOP;

        int state = currentIsPlaying
            ? PlaybackState.STATE_PLAYING
            : PlaybackState.STATE_PAUSED;

        PlaybackState playbackState = new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, currentPositionMs, currentIsPlaying ? currentSpeed : 0f)
            .build();
        platformMediaSession.setPlaybackState(playbackState);
    }

    @SuppressWarnings("deprecation")
    private Notification buildNotification() {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent prevIntent = buildServiceActionPendingIntent(ACTION_NOTIFICATION_PREV, 1);
        PendingIntent playPauseIntent = buildServiceActionPendingIntent(
            currentIsPlaying ? ACTION_NOTIFICATION_PAUSE : ACTION_NOTIFICATION_PLAY,
            2
        );
        PendingIntent nextIntent = buildServiceActionPendingIntent(ACTION_NOTIFICATION_NEXT, 3);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        Notification.MediaStyle mediaStyle = new Notification.MediaStyle();
        if (platformMediaSession != null) {
            mediaStyle.setMediaSession(platformMediaSession.getSessionToken());
        }
        mediaStyle.setShowActionsInCompactView(0, 1, 2);

        builder.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText(currentAlbum)
            .setContentIntent(contentIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(currentIsPlaying)
            .setOnlyAlertOnce(true)
            .setStyle(mediaStyle)
            .addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_previous,
                "Previous",
                prevIntent
            ).build())
            .addAction(new Notification.Action.Builder(
                currentIsPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                currentIsPlaying ? "Pause" : "Play",
                playPauseIntent
            ).build())
            .addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_next,
                "Next",
                nextIntent
            ).build());

        return builder.build();
    }

    private PendingIntent buildServiceActionPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, FoliaPlaybackService.class);
        intent.setAction(action);
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager != null) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Folia Music Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Synchronized playback controls for Folia");
            channel.setShowBadge(false);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void clearAndStopPlayback() {
        stopDriftSync();
        playbackActive = false;
        nativeExoModeActive = false;
        currentIsPlaying = false;
        if (exoPlayer != null) {
            exoPlayer.stop();
            exoPlayer.clearMediaItems();
        }
        unregisterNoisyReceiverIfNeeded();
        releaseWakeLockIfHeld();
        if (isForegroundStarted) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                @SuppressWarnings("deprecation")
                boolean removeNotification = true;
                stopForeground(removeNotification);
            }
            isForegroundStarted = false;
        }
        stopSelf();
    }

    private void registerNoisyReceiverIfNeeded() {
        if (noisyReceiverRegistered) return;
        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(becomingNoisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(becomingNoisyReceiver, filter);
        }
        noisyReceiverRegistered = true;
    }

    private void unregisterNoisyReceiverIfNeeded() {
        if (!noisyReceiverRegistered) return;
        try {
            unregisterReceiver(becomingNoisyReceiver);
        } catch (Exception ignored) {
            // Receiver may not be registered.
        }
        noisyReceiverRegistered = false;
    }

    private void acquireWakeLockIfNeeded() {
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(6 * 60 * 60 * 1000L);
        }
    }

    private void releaseWakeLockIfHeld() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {
                // Ignore under-locked exception.
            }
        }
    }

    @Override
    public void onDestroy() {
        stopDriftSync();
        playbackActive = false;
        nativeExoModeActive = false;
        unregisterNoisyReceiverIfNeeded();
        releaseWakeLockIfHeld();
        if (media3Session != null) {
            try {
                media3Session.release();
            } catch (Exception ignored) {}
            media3Session = null;
        }
        if (exoPlayer != null) {
            try {
                exoPlayer.release();
            } catch (Exception ignored) {}
            exoPlayer = null;
        }
        if (platformMediaSession != null) {
            platformMediaSession.setActive(false);
            platformMediaSession.release();
            platformMediaSession = null;
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
