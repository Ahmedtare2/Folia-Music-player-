#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// packaging/android/build-apk.mjs
// Verifies Java/Android SDK prerequisites, validates signing configuration when building
// a signed production release, invokes Gradle to build the Android APK, and reports the output size.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const ANDROID_DIR = path.join(ROOT_DIR, 'android');
const CAP_ANDROID_MODULE_DIR = path.join(ROOT_DIR, 'node_modules/@capacitor/android/capacitor');

const isRelease = process.argv.includes('--release') || !process.argv.includes('--debug');
const requireSigned = process.argv.includes('--require-signed');
const gradleTask = isRelease ? 'assembleRelease' : 'assembleDebug';

const log = (message) => console.log(`[android:apk] ${message}`);
const fail = (message) => {
    console.error(`\n[android:apk] ERROR: ${message}\n`);
    process.exit(1);
};

// 1. If --require-signed is requested for a release build, verify signing credentials upfront
if (isRelease && requireSigned) {
    const storeFile = process.env.FOLIA_UPLOAD_STORE_FILE || process.env.ANDROID_KEYSTORE_PATH || '';
    const storePassword = process.env.FOLIA_UPLOAD_STORE_PASSWORD || process.env.ANDROID_KEYSTORE_PASSWORD || '';
    const keyAlias = process.env.FOLIA_UPLOAD_KEY_ALIAS || process.env.ANDROID_KEY_ALIAS || '';
    const keyPassword = process.env.FOLIA_UPLOAD_KEY_PASSWORD || process.env.ANDROID_KEY_PASSWORD || '';

    const missing = [];
    if (!storeFile) missing.push('FOLIA_UPLOAD_STORE_FILE (or ANDROID_KEYSTORE_PATH)');
    else if (!fs.existsSync(storeFile)) missing.push(`Keystore file not found at: ${storeFile}`);
    if (!storePassword) missing.push('FOLIA_UPLOAD_STORE_PASSWORD (or ANDROID_KEYSTORE_PASSWORD)');
    if (!keyAlias) missing.push('FOLIA_UPLOAD_KEY_ALIAS (or ANDROID_KEY_ALIAS)');
    if (!keyPassword) missing.push('FOLIA_UPLOAD_KEY_PASSWORD (or ANDROID_KEY_PASSWORD)');

    if (missing.length > 0) {
        fail(
            'Cannot build a signed Android release APK because signing credentials are missing:\n' +
            missing.map(item => `  - ${item}`).join('\n') + '\n\n' +
            'Never substitute an ephemeral signing key for a production release.\n' +
            'In GitHub Actions, configure repository secrets:\n' +
            '  - ANDROID_KEYSTORE_BASE64\n' +
            '  - ANDROID_KEYSTORE_PASSWORD\n' +
            '  - ANDROID_KEY_ALIAS\n' +
            '  - ANDROID_KEY_PASSWORD\n' +
            'See PHONE_SETUP.md for step-by-step instructions.',
        );
    }
}

// 2. Check @capacitor/android in node_modules
if (!fs.existsSync(CAP_ANDROID_MODULE_DIR)) {
    fail(
        `Missing Capacitor Android native library at ${CAP_ANDROID_MODULE_DIR}.\n` +
        'Run "npm ci" or "npm install" so @capacitor/android is unpacked in node_modules.',
    );
}

// 3. Check Java version (Capacitor 8 / AGP 8.13 requires JDK 21+)
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
        'Set JAVA_HOME to a JDK 21 installation or run the GitHub Actions workflow (.github/workflows/import-and-build-android.yml).',
    );
}

// 4. Check Android SDK location
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const localPropertiesPath = path.join(ANDROID_DIR, 'local.properties');
if (!sdkRoot && !fs.existsSync(localPropertiesPath)) {
    fail(
        'Android SDK location is not configured.\n' +
        'Set ANDROID_HOME (or ANDROID_SDK_ROOT) to your Android SDK path, or create android/local.properties with sdk.dir=/path/to/Android/Sdk.\n' +
        'To build without local Android Studio/SDK setup, trigger the GitHub Actions workflow: .github/workflows/import-and-build-android.yml.',
    );
}

// 5. Verify synced web assets exist inside android/app/src/main/assets/public/
const syncedIndexHtml = path.join(ANDROID_DIR, 'app/src/main/assets/public/index.html');
if (!fs.existsSync(syncedIndexHtml)) {
    fail(
        `Missing synced web bundle at ${syncedIndexHtml}.\n` +
        'Run "npm run build:android" before building the APK.',
    );
}

// 6. Execute Gradle build
const gradlew = process.platform === 'win32'
    ? path.join(ANDROID_DIR, 'gradlew.bat')
    : './gradlew';

const gradleArgs = [gradleTask, '--stacktrace', '--no-daemon'];
if (isRelease && requireSigned) {
    gradleArgs.push('-PrequireReleaseSigning=true');
}

log(`Running ${gradlew} ${gradleArgs.join(' ')} in ${ANDROID_DIR}...`);
const buildResult = spawnSync(gradlew, gradleArgs, {
    cwd: ANDROID_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

if (buildResult.status !== 0) {
    fail(`Gradle task "${gradleTask}" failed with exit code ${buildResult.status ?? 1}. Inspect the stacktrace above for details.`);
}

const signedReleasePath = path.join(ANDROID_DIR, 'app/build/outputs/apk/release/app-release.apk');
const unsignedReleasePath = path.join(ANDROID_DIR, 'app/build/outputs/apk/release/app-release-unsigned.apk');
const debugApkPath = path.join(ANDROID_DIR, 'app/build/outputs/apk/debug/app-debug.apk');

let apkPath = debugApkPath;
if (isRelease) {
    if (fs.existsSync(signedReleasePath)) {
        apkPath = signedReleasePath;
    } else if (!requireSigned && fs.existsSync(unsignedReleasePath)) {
        apkPath = unsignedReleasePath;
    } else {
        fail(
            `Expected signed release APK was not found at ${signedReleasePath}.\n` +
            'Verify that your keystore credentials are valid and signingConfigs.release is active.',
        );
    }
}

if (!fs.existsSync(apkPath) || fs.statSync(apkPath).size === 0) {
    fail(`Gradle succeeded, but expected non-empty APK was not found at ${apkPath}.`);
}

const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const version = pkgJson.version || '0.7.21';
const releaseDir = path.join(ROOT_DIR, 'release');
fs.mkdirSync(releaseDir, { recursive: true });
const friendlyFilename = isRelease
    ? (apkPath === signedReleasePath
        ? `Folia-${version}-android-release.apk`
        : `Folia-${version}-android-release-unsigned.apk`)
    : `Folia-${version}-android-debug.apk`;
const copiedPath = path.join(releaseDir, friendlyFilename);
fs.copyFileSync(apkPath, copiedPath);

const sizeBytes = fs.statSync(copiedPath).size;
const sizeMiB = (sizeBytes / (1024 * 1024)).toFixed(2);
log(`Successfully built Android ${isRelease ? 'Release' : 'Debug'} APK:`);
log(`  Source APK : ${apkPath}`);
log(`  Output APK : ${copiedPath}`);
log(`  Size       : ${sizeBytes.toLocaleString()} bytes (${sizeMiB} MiB)`);
