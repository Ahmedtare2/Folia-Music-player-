// capacitor.config.ts
// Capacitor Android & cross-platform wrapper configuration for Folia (top.izuna.foliamajor).
// Packages the built Vite web application inside the APK and serves it over https://localhost
// so IndexedDB, OPFS, Web Workers, and Web Audio run in a secure context without a remote server.

export interface FoliaCapacitorConfig {
    appId: string;
    appName: string;
    webDir: string;
    backgroundColor?: string;
    server?: {
        androidScheme?: 'http' | 'https';
        hostname?: string;
        cleartext?: boolean;
    };
    android?: {
        backgroundColor?: string;
        allowMixedContent?: boolean;
        captureInput?: boolean;
        webContentsDebuggingEnabled?: boolean;
    };
    plugins?: Record<string, Record<string, unknown>>;
}

const config: FoliaCapacitorConfig = {
    appId: 'top.izuna.foliamajor',
    appName: 'Folia',
    webDir: 'dist',
    backgroundColor: '#09090b',
    server: {
        androidScheme: 'https',
        hostname: 'localhost',
    },
    android: {
        backgroundColor: '#09090b',
        allowMixedContent: true,
        captureInput: true,
        webContentsDebuggingEnabled: false,
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 0,
            launchAutoHide: true,
            backgroundColor: '#09090b',
            showSpinner: false,
        },
    },
};

export default config;
