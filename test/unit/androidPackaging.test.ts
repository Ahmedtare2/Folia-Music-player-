import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import capacitorConfig from '../../capacitor.config';

// test/unit/androidPackaging.test.ts
// Verifies Phase 1-5 Android Capacitor configuration, native project branding, Gradle wrapper JAR,
// R8 minification & safe resource shrinking, external release signing validation, and GitHub Actions
// release + diagnostic debug APK workflows (import-and-build-android.yml and PHONE_SETUP.md).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

describe('Android Capacitor packaging & production release configuration', () => {
    it('keeps capacitor.config.ts and capacitor.config.json synchronized with Folia production identity and no dev server URL', () => {
        const rawJson = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'capacitor.config.json'), 'utf8'),
        );

        expect(capacitorConfig.appId).toBe('top.izuna.foliamajor');
        expect(capacitorConfig.appName).toBe('Folia');
        expect(capacitorConfig.webDir).toBe('dist');
        expect(capacitorConfig.backgroundColor).toBe('#09090b');
        expect(capacitorConfig.server?.androidScheme).toBe('https');
        expect((capacitorConfig.server as Record<string, unknown> | undefined)?.url).toBeUndefined();
        expect(capacitorConfig.android?.webContentsDebuggingEnabled).toBe(false);
        expect(rawJson).toEqual(capacitorConfig);
    });

    it('configures Android Gradle project with matching applicationId, SDK versions, Gradle wrapper JAR, and Folia branding', () => {
        const appBuildGradle = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/build.gradle'),
            'utf8',
        );
        const variablesGradle = fs.readFileSync(
            path.join(REPO_ROOT, 'android/variables.gradle'),
            'utf8',
        );
        const stringsXml = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/src/main/res/values/strings.xml'),
            'utf8',
        );
        const colorsXml = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/src/main/res/values/colors.xml'),
            'utf8',
        );
        const manifestXml = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/src/main/AndroidManifest.xml'),
            'utf8',
        );

        expect(appBuildGradle).toContain('namespace = "top.izuna.foliamajor"');
        expect(appBuildGradle).toContain('applicationId "top.izuna.foliamajor"');
        expect(variablesGradle).toContain('minSdkVersion = 24');
        expect(variablesGradle).toContain('compileSdkVersion = 36');
        expect(variablesGradle).toContain('targetSdkVersion = 36');
        expect(stringsXml).toContain('<string name="app_name">Folia</string>');
        expect(colorsXml).toContain('#48828E');
        expect(colorsXml).toContain('#09090B');
        expect(colorsXml).toContain('#B6BAF3');
        expect(manifestXml).toContain('android:supportsRtl="true"');
        expect(manifestXml).toContain('android:name=".MainActivity"');

        // Verify Gradle wrapper scripts, properties, and wrapper JAR
        for (const wrapperRel of [
            'android/gradlew',
            'android/gradlew.bat',
            'android/gradle/wrapper/gradle-wrapper.properties',
            'android/gradle/wrapper/gradle-wrapper.jar',
        ]) {
            const full = path.join(REPO_ROOT, wrapperRel);
            expect(fs.existsSync(full), `Expected ${wrapperRel} to exist`).toBe(true);
            expect(fs.statSync(full).size).toBeGreaterThan(100);
        }
    });

    it('configures Android release buildType with R8 minification, resource shrinking, ProGuard rules, keep.xml, and external signing validation', () => {
        const appBuildGradle = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/build.gradle'),
            'utf8',
        );
        const proguardRules = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/proguard-rules.pro'),
            'utf8',
        );
        const keepXmlPath = path.join(REPO_ROOT, 'android/app/src/main/res/raw/keep.xml');
        expect(fs.existsSync(keepXmlPath)).toBe(true);
        const keepXml = fs.readFileSync(keepXmlPath, 'utf8');

        // Verify release buildType optimizations & external signing config
        expect(appBuildGradle).toContain('minifyEnabled true');
        expect(appBuildGradle).toContain('shrinkResources true');
        expect(appBuildGradle).toContain('debuggable false');
        expect(appBuildGradle).toContain('zipAlignEnabled true');
        expect(appBuildGradle).toContain("getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'");
        expect(appBuildGradle).toContain('signingConfigs.release');
        expect(appBuildGradle).toContain('requireReleaseSigning');
        expect(appBuildGradle).toContain('FOLIA_UPLOAD_STORE_FILE');
        expect(appBuildGradle).toContain('ANDROID_KEYSTORE_PASSWORD');

        // Verify ProGuard rules protect Capacitor plugins, Folia native classes, and WebView JS interfaces
        expect(proguardRules).toContain('com.getcapacitor.Plugin');
        expect(proguardRules).toContain('com.getcapacitor.PluginMethod');
        expect(proguardRules).toContain('-keep class top.izuna.foliamajor.** { *; }');
        expect(proguardRules).toContain('@android.webkit.JavascriptInterface');

        // Verify keep.xml protects launcher icons, splash screens, and XML resources in safe shrink mode
        expect(keepXml).toContain('tools:shrinkMode="safe"');
        expect(keepXml).toContain('@mipmap/*');
        expect(keepXml).toContain('@drawable/*');
    });

    it('includes generated Folia launcher icons and splash screens across Android resource buckets', () => {
        const expectedAssets = [
            'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
            'android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
            'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
            'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',
            'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
            'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',
            'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png',
            'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
            'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
            'android/app/src/main/res/drawable-nodpi/splash_icon.png',
            'android/app/src/main/res/drawable-port-xhdpi/splash.png',
            'android/app/src/main/res/drawable-land-xhdpi/splash.png',
        ];

        for (const relPath of expectedAssets) {
            const fullPath = path.join(REPO_ROOT, relPath);
            expect(fs.existsSync(fullPath), `Expected ${relPath} to exist`).toBe(true);
            expect(fs.statSync(fullPath).size).toBeGreaterThan(100);
        }
    });

    it('defines release & debug Android scripts in package.json, GitHub Actions workflow, and secret documentation in PHONE_SETUP.md', () => {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
        );
        const buildApkScript = fs.readFileSync(
            path.join(REPO_ROOT, 'packaging/android/build-apk.mjs'),
            'utf8',
        );
        const importWorkflowPath = path.join(REPO_ROOT, '.github/workflows/import-and-build-android.yml');
        const phoneSetupPath = path.join(REPO_ROOT, 'PHONE_SETUP.md');

        expect(pkg.scripts['build:android:web']).toBe('cross-env ANDROID=true vite build');
        expect(pkg.scripts['android:sync']).toBe('node packaging/android/sync-android.mjs');
        expect(pkg.scripts['build:android']).toBe('npm run build:android:web && npm run android:sync');
        expect(pkg.scripts['android:apk:release']).toContain('packaging/android/build-apk.mjs --release --require-signed');
        expect(pkg.scripts['android:apk:debug']).toContain('packaging/android/build-apk.mjs --debug');
        expect(pkg.scripts['android:apk']).toBe('npm run android:apk:release');

        expect(buildApkScript).toContain('--require-signed');
        expect(buildApkScript).toContain('assembleRelease');
        expect(buildApkScript).toContain('app-release.apk');

        expect(fs.existsSync(importWorkflowPath)).toBe(true);
        expect(fs.existsSync(phoneSetupPath)).toBe(true);

        const importYaml = fs.readFileSync(importWorkflowPath, 'utf8');
        expect(importYaml).toContain('folia-android-source.zip');
        expect(importYaml).toContain('workflow_dispatch');
        expect(importYaml).toContain('contents: write');
        expect(importYaml).toContain('assembleRelease');
        expect(importYaml).toContain('assembleDebug');
        expect(importYaml).toContain('Folia-Android-Release-APK');
        expect(importYaml).toContain('Folia-Android-Debug-APK');
        expect(importYaml).toContain('ANDROID_KEYSTORE_BASE64');
        expect(importYaml).toContain('ANDROID_KEYSTORE_PASSWORD');
        expect(importYaml).toContain('ANDROID_KEY_ALIAS');
        expect(importYaml).toContain('ANDROID_KEY_PASSWORD');

        const phoneSetupMd = fs.readFileSync(phoneSetupPath, 'utf8');
        expect(phoneSetupMd).toContain('ANDROID_KEYSTORE_BASE64');
        expect(phoneSetupMd).toContain('ANDROID_KEYSTORE_PASSWORD');
        expect(phoneSetupMd).toContain('ANDROID_KEY_ALIAS');
        expect(phoneSetupMd).toContain('ANDROID_KEY_PASSWORD');
        expect(phoneSetupMd).toContain('Folia-Android-Release-APK');
    });
});
