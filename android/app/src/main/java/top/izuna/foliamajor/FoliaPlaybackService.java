package top.izuna.foliamajor;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.SimpleBasePlayer;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.Collections;

/**
 * AndroidX Media3 foreground MediaSessionService for Folia.
 *
 * Bridges system media notifications, lock-screen controls, Bluetooth headset buttons,
 * AudioFocus transitions, and ACTION_AUDIO_BECOMING_NOISY (headphone unplug) directly
 * to Folia's single Web Audio / HTMLAudioElement playback clock without creating a
 * second competing audio player.
 */
@UnstableApi
public class FoliaPlaybackService extends MediaSessionService {
    public static final String ACTION_UPDATE_STATE = "top.izuna.foliamajor.action.UPDATE_STATE";
    public static final String ACTION_STOP_SERVICE = "top.izuna.foliamajor.action.STOP_SERVICE";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_ARTWORK_URL = "artworkUrl";
    public static final String EXTRA_DURATION_MS = "durationMs";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_PLAYBACK_SPEED = "playbackSpeed";

    private static volatile boolean playbackActive = false;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private FoliaMedia3Player sessionPlayer;
    private MediaSession mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;
    private boolean resumeOnFocusGain = false;
    private boolean noisyReceiverRegistered = false;
    private PowerManager.WakeLock wakeLock;

    public static boolean isPlaybackActive() {
        return playbackActive;
    }

    private final AudioManager.OnAudioFocusChangeListener audioFocusChangeListener = focusChange -> {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
                hasAudioFocus = false;
                resumeOnFocusGain = false;
                FoliaNativeBridgePlugin.dispatchMediaAction("pause", null);
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                if (sessionPlayer != null && sessionPlayer.isCurrentlyPlaying()) {
                    resumeOnFocusGain = true;
                }
                FoliaNativeBridgePlugin.dispatchMediaAction("pause", null);
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                FoliaNativeBridgePlugin.dispatchMediaAction("duck", null);
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                hasAudioFocus = true;
                FoliaNativeBridgePlugin.dispatchMediaAction("unduck", null);
                if (resumeOnFocusGain) {
                    resumeOnFocusGain = false;
                    FoliaNativeBridgePlugin.dispatchMediaAction("play", null);
                }
                break;
            default:
                break;
        }
    };

    private final BroadcastReceiver becomingNoisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                resumeOnFocusGain = false;
                FoliaNativeBridgePlugin.dispatchMediaAction("pause", null);
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Folia:AudioPlaybackWakeLock"
            );
            wakeLock.setReferenceCounted(false);
        }

        sessionPlayer = new FoliaMedia3Player(Looper.getMainLooper());
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent sessionActivityPendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        mediaSession = new MediaSession.Builder(this, sessionPlayer)
            .setSessionActivity(sessionActivityPendingIntent)
            .build();
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            if (ACTION_UPDATE_STATE.equals(action)) {
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
            } else if (ACTION_STOP_SERVICE.equals(action)) {
                mainHandler.post(this::clearAndStopPlayback);
            }
        }
        return START_STICKY;
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
        playbackActive = isPlaying;
        if (isPlaying) {
            requestAudioFocusIfNeeded();
            registerNoisyReceiverIfNeeded();
            acquireWakeLockIfNeeded();
        } else {
            unregisterNoisyReceiverIfNeeded();
            releaseWakeLockIfHeld();
        }

        if (sessionPlayer != null) {
            sessionPlayer.updateFromFoliaBridge(
                title,
                artist,
                album,
                artworkUrl,
                durationMs,
                positionMs,
                isPlaying,
                speed
            );
        }
    }

    private void clearAndStopPlayback() {
        playbackActive = false;
        resumeOnFocusGain = false;
        unregisterNoisyReceiverIfNeeded();
        abandonAudioFocusIfHeld();
        releaseWakeLockIfHeld();
        if (sessionPlayer != null) {
            sessionPlayer.clearTrack();
        }
        stopSelf();
    }

    private void requestAudioFocusIfNeeded() {
        if (audioManager == null || hasAudioFocus) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (audioFocusRequest == null) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener(audioFocusChangeListener, mainHandler)
                    .build();
            }
            int res = audioManager.requestAudioFocus(audioFocusRequest);
            hasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        } else {
            @SuppressWarnings("deprecation")
            int res = audioManager.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
            hasAudioFocus = (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        }
    }

    private void abandonAudioFocusIfHeld() {
        if (audioManager == null || !hasAudioFocus) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            @SuppressWarnings("deprecation")
            int ignored = audioManager.abandonAudioFocus(audioFocusChangeListener);
        }
        hasAudioFocus = false;
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
        } catch (IllegalArgumentException ignored) {
            // Receiver already unregistered.
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
            wakeLock.release();
        }
    }

    @Nullable
    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        if (!playbackActive) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        playbackActive = false;
        unregisterNoisyReceiverIfNeeded();
        abandonAudioFocusIfHeld();
        releaseWakeLockIfHeld();
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    /**
     * Media3 SimpleBasePlayer implementation that mirrors Folia's single Web Audio playback clock
     * and forwards system transport commands (Play, Pause, Next, Previous, Seek) to TypeScript.
     */
    private static final class FoliaMedia3Player extends SimpleBasePlayer {
        private boolean hasTrack = false;
        private boolean playWhenReady = false;
        private String title = "Folia";
        private String artist = "";
        private String album = "";
        @Nullable private String artworkUrl = null;
        private long durationMs = C.TIME_UNSET;
        private long positionMs = 0L;
        private float playbackSpeed = 1.0f;

        FoliaMedia3Player(Looper looper) {
            super(looper);
        }

        boolean isCurrentlyPlaying() {
            return hasTrack && playWhenReady;
        }

        void updateFromFoliaBridge(
            String title,
            String artist,
            String album,
            @Nullable String artworkUrl,
            long durationMs,
            long positionMs,
            boolean isPlaying,
            float speed
        ) {
            this.hasTrack = true;
            this.title = title;
            this.artist = artist;
            this.album = album;
            this.artworkUrl = artworkUrl;
            this.durationMs = durationMs > 0 ? durationMs : C.TIME_UNSET;
            this.positionMs = Math.max(0L, positionMs);
            this.playWhenReady = isPlaying;
            this.playbackSpeed = speed > 0 ? speed : 1.0f;
            invalidateState();
        }

        void clearTrack() {
            this.hasTrack = false;
            this.playWhenReady = false;
            this.positionMs = 0L;
            this.durationMs = C.TIME_UNSET;
            invalidateState();
        }

        @NonNull
        @Override
        protected State getState() {
            Commands availableCommands = new Commands.Builder()
                .addAll(
                    Player.COMMAND_PLAY_PAUSE,
                    Player.COMMAND_STOP,
                    Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
                    Player.COMMAND_SEEK_TO_NEXT,
                    Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                    Player.COMMAND_SEEK_TO_PREVIOUS,
                    Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
                    Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
                    Player.COMMAND_GET_METADATA,
                    Player.COMMAND_GET_TIMELINE
                )
                .build();

            if (!hasTrack) {
                return new State.Builder()
                    .setAvailableCommands(availableCommands)
                    .setPlaybackState(Player.STATE_IDLE)
                    .setPlayWhenReady(false, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
                    .build();
            }

            MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setAlbumTitle(album)
                .setIsPlayable(true)
                .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC);

            if (artworkUrl != null && (artworkUrl.startsWith("http://") || artworkUrl.startsWith("https://"))) {
                metaBuilder.setArtworkUri(Uri.parse(artworkUrl));
            }

            MediaMetadata mediaMetadata = metaBuilder.build();
            MediaItem mediaItem = new MediaItem.Builder()
                .setMediaId("folia-active-track")
                .setMediaMetadata(mediaMetadata)
                .build();

            MediaItemData itemData = new MediaItemData.Builder("folia-active-track")
                .setMediaItem(mediaItem)
                .setMediaMetadata(mediaMetadata)
                .setDurationUs(durationMs != C.TIME_UNSET ? C.msToUs(durationMs) : C.TIME_UNSET)
                .setIsSeekable(true)
                .build();

            PositionSupplier positionSupplier = playWhenReady
                ? PositionSupplier.getExtrapolating(positionMs, playbackSpeed)
                : PositionSupplier.getConstant(positionMs);

            return new State.Builder()
                .setAvailableCommands(availableCommands)
                .setPlaybackState(Player.STATE_READY)
                .setPlayWhenReady(playWhenReady, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
                .setPlaybackParameters(new PlaybackParameters(playbackSpeed))
                .setPlaylist(Collections.singletonList(itemData))
                .setCurrentMediaItemIndex(0)
                .setContentPositionMs(positionSupplier)
                .build();
        }

        @NonNull
        @Override
        protected ListenableFuture<?> handleSetPlayWhenReady(boolean playWhenReady) {
            this.playWhenReady = playWhenReady;
            FoliaNativeBridgePlugin.dispatchMediaAction(playWhenReady ? "play" : "pause", null);
            return Futures.immediateVoidFuture();
        }

        @NonNull
        @Override
        protected ListenableFuture<?> handleStop() {
            this.playWhenReady = false;
            FoliaNativeBridgePlugin.dispatchMediaAction("pause", null);
            return Futures.immediateVoidFuture();
        }

        @NonNull
        @Override
        protected ListenableFuture<?> handleSeek(int mediaItemIndex, long positionMs, int seekCommand) {
            if (seekCommand == Player.COMMAND_SEEK_TO_NEXT || seekCommand == Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM) {
                FoliaNativeBridgePlugin.dispatchMediaAction("nexttrack", null);
                return Futures.immediateVoidFuture();
            }
            if (seekCommand == Player.COMMAND_SEEK_TO_PREVIOUS || seekCommand == Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {
                FoliaNativeBridgePlugin.dispatchMediaAction("previoustrack", null);
                return Futures.immediateVoidFuture();
            }
            if (positionMs != C.TIME_UNSET && positionMs >= 0) {
                this.positionMs = positionMs;
                FoliaNativeBridgePlugin.dispatchMediaAction("seekto", positionMs);
            }
            return Futures.immediateVoidFuture();
        }
    }
}
