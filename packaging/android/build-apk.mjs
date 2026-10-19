#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// packaging/android/build-apk.mjs
// Verifies Java/Android SDK prerequisites, invokes Gradle to build the Android APK,
// and prints actionable diagnostics if any toolchain component is missing.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const ANDROID_DIR = path.join(ROOT_DIR, 'android');
const CAP_ANDROID_MODULE_DIR = path.join(ROOT_DIR, 'node_modules/@capacitor/android/capacitor');

const isRelease = process.argv.includes('--release');
const gradleTask = isRelease ? 'assembleRelease' : 'assembleDebug';

const log = (message) => console.log(`[android:apk] ${message}`);
const fail = (message) => {
    console.error(`\n[android:apk] ERROR: ${message}\n`);
    process.exit(1);
};

// 1. Check @capacitor/android in node_modules
if (!fs.existsSync(CAP_ANDROID_MODULE_DIR)) {
    fail(
        `Missing Capacitor Android native library at ${CAP_ANDROID_MODULE_DIR}.\n` +
        'Run "npm ci" or "npm install" so @capacitor/android is unpacked in node_modules.',
    );
}

// 2. Check Java version (Capacitor 8 / AGP 8.13 requires JDK 21+)
const javaCheck = spawnSync('java', ['-version'], { encoding: 'utf8' });
if (javaCheck.error || javaCheck.status !== 0) {
    fail('Java runtime not found on PATH. Install JDK 21 (Temurin 21 recommended) and set JAVA_HOME.');
}
const javaVersionOutput = `${javaCheck.stdout ?? ''}\n${javaCheck.stderr ?? ''}`;
const versionMatch = /version "(?:1\.)?(\d+)/.exec(javaVersionOutput);
const majorJava = versionMatch ? Number(versionMatch[1]) : 0;
if (majorJava > 0 && majorJava < 21) {
    fail(
        `Detected Java ${majorJava} (${javaVersionOutput.trim().split('\n')[0]}), but Capacitor 8 and Android Gradle Plugin 8.13 require JDK 21 or newer.\n` +
        'Set JAVA_HOME to a JDK 21 installation or run the GitHub Actions workflow (.github/workflows/android-debug-apk.yml).',
    );
}

// 3. Check Android SDK location
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const localPropertiesPath = path.join(ANDROID_DIR, 'local.properties');
if (!sdkRoot && !fs.existsSync(localPropertiesPath)) {
    fail(
        'Android SDK location is not configured.\n' +
        'Set ANDROID_HOME (or ANDROID_SDK_ROOT) to your Android SDK path, or create android/local.properties with sdk.dir=/path/to/Android/Sdk.\n' +
        'To build without local Android Studio/SDK setup, trigger the GitHub Actions workflow: .github/workflows/android-debug-apk.yml.',
    );
}

// 4. Verify synced web assets exist inside android/app/src/main/assets/public/
const syncedIndexHtml = path.join(ANDROID_DIR, 'app/src/main/assets/public/index.html');
if (!fs.existsSync(syncedIndexHtml)) {
    fail(
        `Missing synced web bundle at ${syncedIndexHtml}.\n` +
        'Run "npm run build:android" before building the APK.',
    );
}

// 5. Execute Gradle build
const gradlew = process.platform === 'win32'
    ? path.join(ANDROID_DIR, 'gradlew.bat')
    : './gradlew';

log(`Running ${gradlew} ${gradleTask} --stacktrace in ${ANDROID_DIR}...`);
const buildResult = spawnSync(gradlew, [gradleTask, '--stacktrace'], {
    cwd: ANDROID_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

if (buildResult.status !== 0) {
    fail(`Gradle task "${gradleTask}" failed with exit code ${buildResult.status ?? 1}. Inspect the stacktrace above for details.`);
}

const apkSubpath = isRelease
    ? 'app/build/outputs/apk/release/app-release-unsigned.apk'
    : 'app/build/outputs/apk/debug/app-debug.apk';
const apkPath = path.join(ANDROID_DIR, apkSubpath);

if (!fs.existsSync(apkPath)) {
    fail(`Gradle succeeded, but expected APK was not found at ${apkPath}.`);
}

const sizeMiB = (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2);
log(`Successfully built Android APK: ${apkPath} (${sizeMiB} MiB)`);
