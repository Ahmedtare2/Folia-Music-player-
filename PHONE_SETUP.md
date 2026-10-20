# Folia Android — Phone-Only GitHub Setup, Release Signing & APK Build Guide

This guide explains how to deploy your completed **Folia Android** project and build an optimized, cryptographically signed **Android Production Release APK (`Folia-Android-Release-APK`)** — plus a separate diagnostic **Debug APK (`Folia-Android-Debug-APK`)** — using **your Android phone's web browser** and **GitHub Actions**.

## Overview of Deliverable Artifacts Built by the Workflow

Every workflow run compiles the production Vite web bundle (`npm run build:android:web`), syncs Capacitor (`npm run android:sync`), runs the unit test suite, and produces:

1. **`Folia-Android-Release-APK` (Primary Production Artifact)**:
   - Built with `./gradlew assembleRelease -PrequireReleaseSigning=true` using R8 code shrinking/obfuscation (`minifyEnabled true`), safe resource shrinking (`shrinkResources true`), and cryptographic APK Signing Scheme v1/v2/v3/v4 via your repository signing secrets.
   - Contains `Folia-0.7.21-android-release.apk`, `app-release.apk`, and `RELEASE_BUILD_INFO.txt`.
2. **`Folia-Android-Debug-APK` (Separate Diagnostic Artifact)**:
   - Built with `./gradlew assembleDebug` and uploaded even if you have not configured release signing secrets yet, so you always have a diagnostic build available for troubleshooting.
   - Contains `Folia-0.7.21-android-debug.apk` and `BUILD_INFO.txt`.

## Step 1: Configure Stable Release Signing Secrets in GitHub Actions

To produce an installable, update-compatible **Production Release APK**, Android requires a stable signing keystore managed outside the source archive and repository. **Never commit `.jks` / `.keystore` files or passwords into Git.** If the signing secrets below are not configured, the release signing step fails clearly with setup instructions rather than silently substituting an ephemeral key (which would block future app updates from installing over your existing installation).

### Required Repository Secret Names and Expected Formats

In your GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret** and create these **4 exact secrets**:

| Secret Name | Expected Format | Example / Notes |
| :--- | :--- | :--- |
| **`ANDROID_KEYSTORE_BASE64`** | Single-line Base64 string of your `.jks` or `.keystore` binary file | `MIIJ...` (no spaces or line breaks required; the workflow strips whitespace automatically before decoding) |
| **`ANDROID_KEYSTORE_PASSWORD`** | Plaintext password string (minimum 6 characters) | Password protecting the keystore file (`--ks-pass`) |
| **`ANDROID_KEY_ALIAS`** | Plaintext key alias string | e.g., `folia-release` (`--ks-key-alias`) |
| **`ANDROID_KEY_PASSWORD`** | Plaintext password string (minimum 6 characters) | Password for the key alias entry (`--key-pass`; usually the same as `ANDROID_KEYSTORE_PASSWORD`) |

### How to Generate Your Release Keystore & Base64 String (One-Time Setup)

Run this command once in **GitHub Codespaces** (accessible in your phone's browser via **Code → Codespaces → Create codespace on main**), **Termux** on Android (`pkg install openjdk-21`), or any computer terminal:

```bash
keytool -genkeypair -v \
  -keystore folia-release-key.jks \
  -storetype JKS \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias folia-release \
  -storepass "YOUR_STRONG_PASSWORD" \
  -keypass "YOUR_STRONG_PASSWORD" \
  -dname "CN=Folia Music Player, OU=Mobile, O=Folia, L=Cairo, S=Cairo, C=EG"

base64 -w 0 folia-release-key.jks > folia-release-key.base64.txt
```

- Copy the contents of `folia-release-key.base64.txt` into the **`ANDROID_KEYSTORE_BASE64`** secret.
- Set **`ANDROID_KEYSTORE_PASSWORD`** to `YOUR_STRONG_PASSWORD`.
- Set **`ANDROID_KEY_ALIAS`** to `folia-release`.
- Set **`ANDROID_KEY_PASSWORD`** to `YOUR_STRONG_PASSWORD`.
- Store a backup of `folia-release-key.jks` in your personal password manager or encrypted cloud drive, then delete `folia-release-key.jks` and `folia-release-key.base64.txt` from the working directory so they are never committed.

## Step 2: Update or Add `.github/workflows/import-and-build-android.yml`

1. Open your repository on [github.com](https://github.com/) in your phone's browser.
2. If you are setting up a new repository, tap **Add file → Create new file**, name it `.github/workflows/import-and-build-android.yml`, paste the contents of **`import-and-build-android.yml`**, and tap **Commit changes** directly to `main`.
3. If the workflow file already exists in your repository, navigate to **`.github/workflows/import-and-build-android.yml`**, tap the **pencil icon (Edit this file)**, replace the text with the updated **`import-and-build-android.yml`**, and tap **Commit changes**.

## Step 3: Upload `folia-android-source.zip` to the Repository Root

1. Return to the root of your GitHub repository.
2. Tap **Add file → Upload files** (enable **Desktop site** in Chrome's `⋮` menu if hidden on mobile).
3. Select **`folia-android-source.zip`** (`20.45 MiB`, well under GitHub's `25 MiB` mobile browser upload limit).
4. Wait for the upload progress bar to complete and tap **Commit changes** directly to `main`.

## Step 4: Run the Workflow and Download `Folia-Android-Release-APK`

1. Tap the **Actions** tab in your repository and open the running **Import Source ZIP and Build Android Release & Debug APKs** workflow run (or trigger it manually via **Run workflow**).
2. The workflow performs the following verified steps:
   - Extracts and validates `folia-android-source.zip` and commits the project files to your branch with `[skip ci]` (excluding `.github/workflows/*` to avoid infinite triggers or token permission errors).
   - Runs TypeScript checks, unit tests, `npm run build:android:web`, and `npm run android:sync` (verifying that no development server URL or PWA service worker is present in the packaged assets).
   - Builds the diagnostic Debug APK (`assembleDebug`) and uploads **`Folia-Android-Debug-APK`**.
   - Validates your 4 release signing secrets, decodes the keystore outside the repo tree, runs `./gradlew assembleRelease -PrequireReleaseSigning=true`, verifies the v1/v2/v3 cryptographic signature with `apksigner verify`, reports the exact APK filename, byte size, and SHA-256 in the workflow summary, and uploads **`Folia-Android-Release-APK`** (plus publishes to GitHub Releases under tag `android-release-latest`).
3. On the completed workflow run summary page:
   - Tap the direct one-tap download link for **`Folia-0.7.21-android-release.apk`** in the run summary, **or**
   - Scroll to **Artifacts** and download **`Folia-Android-Release-APK`** (and extract `Folia-Android-Release-APK.zip` in your phone's Files app).
4. Note for switching from an older Debug APK to the Signed Release APK:
   - Because Android requires all updates for `top.izuna.foliamajor` to share the same signing certificate, uninstall the old debug-signed installation once before installing `Folia-0.7.21-android-release.apk`. All future updates signed with your `ANDROID_KEYSTORE_BASE64` key will install seamlessly in place.
