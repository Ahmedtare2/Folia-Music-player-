# Add project specific ProGuard rules here.
# Keep Capacitor Plugin classes and bridge annotations intact when R8/ProGuard is enabled.
-keep public class * extends com.getcapacitor.Plugin
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
}
