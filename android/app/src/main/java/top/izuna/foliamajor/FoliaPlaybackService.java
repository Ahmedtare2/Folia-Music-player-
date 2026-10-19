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
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.annotation.Nullable;

/**
 * Android foreground MediaSession playback service for Folia.
 *
 * Bridges system media notifications, lock-screen controls, Bluetooth headset buttons,
 * AudioFocus transitions, and ACTION_AUDIO_BECOMING_NOISY (headphone unplug) directly
 * to Folia's single Web Audio / HTMLAudioElement playback clock without creating a
 * second competing audio player.
 */
public class FoliaPlaybackService extends Service {
    public static final String ACTION_UPDATE_STATE = "top.izuna.foliamajor.action.UPDATE_STATE";
    public static final String ACTION_SYNC_STATE = ACTION_UPDATE_STATE;
    public static final String ACTION_STOP_SERVICE = "top.izuna.foliamajor.action.STOP_SERVICE";

    public static final String ACTION_NOTIFICATION_PLAY = "top.izuna.foliamajor.action.NOTIFICATION_PLAY";
    public static final String ACTION_NOTIFICATION_PAUSE = "top.izuna.foliamajor.action.NOTIFICATION_PAUSE";
    public static final String ACTION_NOTIFICATION_PREV = "top.izuna.foliamajor.action.NOTIFICATION_PREV";
    public static final String ACTION_NOTIFICATION_NEXT = "top.izuna.foliamajor.action.NOTIFICATION_NEXT";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_ARTWORK_URL = "artworkUrl";
    public static final String EXTRA_DURATION_MS = "durationMs";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_PLAYBACK_SPEED = "playbackSpeed";
    public static final String EXTRA_SPEED = EXTRA_PLAYBACK_SPEED;

    private static final String CHANNEL_ID = "folia_playback_channel";
    private static final int NOTIFICATION_ID = 1042;

    private static volatile boolean playbackActive = false;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private MediaSession mediaSession;
    private NotificationManager notificationManager;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;
    private boolean resumeOnFocusGain = false;
    private boolean noisyReceiverRegistered = false;
    private boolean isForegroundStarted = false;
    private PowerManager.WakeLock wakeLock;

    private String currentTitle = "Folia";
    private String currentArtist = "";
    private String currentAlbum = "";
    private long currentDurationMs = 0L;
    private long currentPositionMs = 0L;
    private boolean currentIsPlaying = false;
    private float currentSpeed = 1.0f;

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
                if (currentIsPlaying) {
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
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Folia:AudioPlaybackWakeLock"
            );
            wakeLock.setReferenceCounted(false);
        }

        ensureNotificationChannel();

        mediaSession = new MediaSession(this, "FoliaMediaSession");
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent sessionActivityPendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        mediaSession.setSessionActivity(sessionActivityPendingIntent);
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                FoliaNativeBridgePlugin.dispatchMediaAction("play", null);
            }

            @Override
            public void onPause() {
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
                FoliaNativeBridgePlugin.dispatchMediaAction("seekto", pos);
            }

            @Override
            public void onStop() {
                FoliaNativeBridgePlugin.dispatchMediaAction("stop", null);
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
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
            } else if (ACTION_NOTIFICATION_PLAY.equals(action)) {
                FoliaNativeBridgePlugin.dispatchMediaAction("play", null);
            } else if (ACTION_NOTIFICATION_PAUSE.equals(action)) {
                FoliaNativeBridgePlugin.dispatchMediaAction("pause", null);
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
        this.currentDurationMs = Math.max(0L, durationMs);
        this.currentPositionMs = Math.max(0L, positionMs);
        this.currentIsPlaying = isPlaying;
        this.currentSpeed = speed > 0f ? speed : 1.0f;
        playbackActive = isPlaying;

        if (isPlaying) {
            requestAudioFocusIfNeeded();
            registerNoisyReceiverIfNeeded();
            acquireWakeLockIfNeeded();
        } else {
            unregisterNoisyReceiverIfNeeded();
            releaseWakeLockIfHeld();
        }

        updateMediaSessionState();
        Notification notification = buildNotification();

        if (isPlaying && !isForegroundStarted) {
            try {
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
                    notificationManager.notify(NOTIFICATION_ID, notification);
                }
            }
        } else if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, notification);
        }
    }

    private void updateMediaSessionState() {
        if (mediaSession == null) return;

        MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, currentDurationMs > 0 ? currentDurationMs : -1L);
        mediaSession.setMetadata(metaBuilder.build());

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
        mediaSession.setPlaybackState(playbackState);
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
        if (mediaSession != null) {
            mediaStyle.setMediaSession(mediaSession.getSessionToken());
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
        playbackActive = false;
        currentIsPlaying = false;
        resumeOnFocusGain = false;
        unregisterNoisyReceiverIfNeeded();
        abandonAudioFocusIfHeld();
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
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        if (!playbackActive) {
            clearAndStopPlayback();
        }
    }

    @Override
    public void onDestroy() {
        playbackActive = false;
        unregisterNoisyReceiverIfNeeded();
        abandonAudioFocusIfHeld();
        releaseWakeLockIfHeld();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }
}
