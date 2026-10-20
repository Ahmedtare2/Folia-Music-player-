# Folia Android R8 / ProGuard configuration for production release builds.
# Keeps Capacitor plugins, FoliaNativeBridgePlugin, FoliaPlaybackService, FoliaSafStreamHandler,
# Cordova bridges, and WebView JavascriptInterface methods intact while optimizing Java bytecode.

# Preserve source file and line numbers for actionable crash stack traces
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*,InnerClasses,Signature,EnclosingMethod

# Keep all Capacitor Plugin subclasses, annotations, and @PluginMethod / @ActivityCallback methods
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    <init>(...);
    @com.getcapacitor.PluginMethod public <methods>;
    @com.getcapacitor.annotation.ActivityCallback public <methods>;
    @com.getcapacitor.annotation.PermissionCallback public <methods>;
}

# Keep Capacitor core runtime classes reflected by BridgeActivity and WebView bridge
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Keep all Folia native Android classes, SAF stream handlers, foreground playback service, and bridge methods
-keep class top.izuna.foliamajor.** { *; }
-keepclassmembers class top.izuna.foliamajor.** {
    public *;
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView @JavascriptInterface methods across all packages
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Cordova plugins if referenced via capacitor-cordova-android-plugins
-keep public class * extends org.apache.cordova.CordovaPlugin
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# Keep AndroidX WindowInsets, DocumentFile, and Media session classes used by Folia
-keep class androidx.core.view.WindowInsetsCompat** { *; }
-keep class androidx.core.view.WindowInsetsControllerCompat** { *; }
-keep class androidx.documentfile.provider.DocumentFile { *; }

# Strip verbose/debug Android log calls in release builds while preserving warn/error reporting
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
}
