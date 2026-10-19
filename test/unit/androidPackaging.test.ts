import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import capacitorConfig from '../../capacitor.config';

// test/unit/androidPackaging.test.ts
// Verifies Phase 1-4 Android Capacitor configuration, native project branding, Gradle wrapper JAR,
// and GitHub Actions debug APK workflows (including import-and-build-android.yml and PHONE_SETUP.md).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

describe('Android Capacitor packaging configuration', () => {
    it('keeps capacitor.config.ts and capacitor.config.json synchronized with Folia identity', () => {
        const rawJson = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'capacitor.config.json'), 'utf8'),
        );

        expect(capacitorConfig.appId).toBe('top.izuna.foliamajor');
        expect(capacitorConfig.appName).toBe('Folia');
        expect(capacitorConfig.webDir).toBe('dist');
        expect(capacitorConfig.backgroundColor).toBe('#09090b');
        expect(capacitorConfig.server?.androidScheme).toBe('https');
        expect((capacitorConfig.server as Record<string, unknown> | undefined)?.url).toBeUndefined();
        expect(rawJson).toEqual(capacitorConfig);
    });

    it('configures Android Gradle project with matching applicationId, SDK versions, Gradle wrapper JAR, and Folia branding', () => {
        const appBuildGradle = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/build.gradle'),
        'utf8');
        const variablesGradle = fs.readFileSync(
            path.join(REPO_ROOT, 'android/variables.gradle'),
        'utf8');
        const stringsXml = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/src/main/res/values/strings.xml'),
        'utf8');
        const colorsXml = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/src/main/res/values/colors.xml'),
        'utf8');
        const manifestXml = fs.readFileSync(
            path.join(REPO_ROOT, 'android/app/src/main/AndroidManifest.xml'),
        'utf8');

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

    it('defines Android build scripts in package.json, GitHub Actions workflows, and PHONE_SETUP.md', () => {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
        );
        const workflowPath = path.join(REPO_ROOT, '.github/workflows/android-debug-apk.yml');
        const importWorkflowPath = path.join(REPO_ROOT, '.github/workflows/import-and-build-android.yml');
        const phoneSetupPath = path.join(REPO_ROOT, 'PHONE_SETUP.md');

        expect(pkg.scripts['build:android:web']).toBe('cross-env ANDROID=true vite build');
        expect(pkg.scripts['android:sync']).toBe('node packaging/android/sync-android.mjs');
        expect(pkg.scripts['build:android']).toBe('npm run build:android:web && npm run android:sync');
        expect(pkg.scripts['android:apk:debug']).toContain('packaging/android/build-apk.mjs');
        expect(fs.existsSync(importWorkflowPath)).toBe(true);
        expect(fs.existsSync(phoneSetupPath)).toBe(true);

        if (fs.existsSync(workflowPath)) {
            const workflowYaml = fs.readFileSync(workflowPath, 'utf8');
            expect(workflowYaml).toContain('assembleDebug');
            expect(workflowYaml).toContain('folia-android-debug-apk');
        }

        const importYaml = fs.readFileSync(importWorkflowPath, 'utf8');
        expect(importYaml).toContain('folia-android-source.zip');
        expect(importYaml).toContain('workflow_dispatch');
        expect(importYaml).toContain('contents: write');
        expect(importYaml).toContain('Folia-Android-debug-APK');
        expect(importYaml).toContain('assembleDebug');
    });
});
