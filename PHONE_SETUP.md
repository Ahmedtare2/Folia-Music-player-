# Folia Android — Phone-Only GitHub Setup & APK Build Guide

This guide explains how to deploy your completed **Folia Android** project and build an installable **Android Debug APK** using **only your Android phone's web browser** and **GitHub Actions** — no PC, no Android Studio, and no terminal required.

## Before You Begin: Download the 2 Files to Your Phone

Make sure you have downloaded these files onto your Android phone:

1. **`import-and-build-android.yml`** — The GitHub Actions workflow file that automatically unpacks your ZIP, commits the project files, and builds the Android APK.
2. **`folia-android-source.zip`** — The complete, ready-to-build Folia Android project archive.

> **Important Tip for Mobile Browsers**: When using `github.com` in Chrome on Android, open the Chrome menu (`⋮` in the top-right corner) and check **Desktop site** if any button (such as **Add file → Upload files**) is hidden by the compact mobile layout.

## Step 1: Create a New GitHub Repository on Your Phone

1. Open [github.com](https://github.com/) in your phone's browser and sign in.
2. Tap the **`+`** icon in the top-right corner and select **New repository**.
3. Enter a **Repository name** (for example, `folia-android`).
4. Choose **Public** or **Private** (GitHub Actions includes free build minutes on Public repositories and standard free-tier minutes on Private repositories).
5. **Crucial**: Check **Add a README file** so GitHub initializes your default **`main`** branch immediately.
6. Scroll to the bottom and tap **Create repository**.

## Step 2: Add the Workflow File First (`.github/workflows/import-and-build-android.yml`)

You must create the workflow file **before** uploading the ZIP file so GitHub knows what to do as soon as the ZIP arrives.

1. Inside your new repository on GitHub, tap **Add file** (near the top right of the file list) and select **Create new file**.
2. In the **Name your file...** box at the top, type this exact path (including the leading dot and slashes):
   ```text
   .github/workflows/import-and-build-android.yml
   ```
3. Open the downloaded **`import-and-build-android.yml`** file on your phone, copy all of its text, and paste it into the GitHub file editor box.
4. Tap **Commit changes...** (green button), keep **Commit directly to the `main` branch** selected, and tap **Commit changes**.

## Step 3: Upload `folia-android-source.zip` to the Repository Root

1. Return to the main page (root) of your GitHub repository by tapping the repository name at the top.
2. Tap **Add file** and select **Upload files**.
   *(If you don't see **Add file**, turn on **Desktop site** in your browser's `⋮` menu.)*
3. Tap **choose your files** and select **`folia-android-source.zip`** from your phone's **Downloads** folder.
4. Wait for the upload progress bar to finish (the archive is optimized to stay under GitHub's 25 MiB browser upload limit).
5. Scroll down, keep **Commit directly to the `main` branch** selected, and tap **Commit changes**.

## Step 4: Watch the Build (or Run It Manually) in GitHub Actions

1. Tap the **Actions** tab at the top of your repository.
2. You will see a workflow run named **Import Source ZIP and Build Android Debug APK** running automatically (yellow spinning dot).
3. **If you ever want to start a build manually**:
   - Tap **Import Source ZIP and Build Android Debug APK** in the left list under **Actions**.
   - Tap the **Run workflow** dropdown button on the right, keep `main` selected, and tap the green **Run workflow** button.
4. Tap the active workflow run title to watch live progress. The build typically takes **5 to 9 minutes**:
   - It validates and extracts `folia-android-source.zip`.
   - It commits the extracted project files directly into your repository root.
   - It installs Node.js 24, JDK 21, Android SDK 36, and Gradle 8.14.3, builds the web bundle, syncs Capacitor, and compiles the Android Debug APK.

## Step 5: Download `Folia-Android-debug-APK` from GitHub

1. Once the workflow run shows a **green checkmark (✓)**, open the completed workflow run page (make sure you are on the **Summary** view of that run, not inside an individual step log).
2. Scroll down to the **Artifacts** section at the bottom of the page.
3. Tap **`Folia-Android-debug-APK`** to download `Folia-Android-debug-APK.zip` to your phone.

## Step 6: Extract and Install the APK on Your Android Phone

GitHub packages all workflow artifacts inside a outer `.zip` container, so you extract it once before installing:

1. Open the **Files by Google** (or Samsung **My Files**) app on your phone and go to **Downloads**.
2. Tap **`Folia-Android-debug-APK.zip`** and tap **Extract** (or **Unzip**).
3. Inside the extracted folder, you will see:
   - **`Folia-0.7.21-android-debug.apk`** (and **`app-debug.apk`**)
   - **`BUILD_INFO.txt`**
4. Tap **`Folia-0.7.21-android-debug.apk`** (or **`app-debug.apk`**).
5. If Android asks for permission to **Install unknown apps** from your Files app, tap **Settings**, toggle **Allow from this source** on, go back, and tap **Install**.
6. If Google Play Protect shows an "Unrecognized app developer" prompt (normal for self-built debug APKs), tap **More details** → **Install anyway**.
7. Open **Folia**, tap **Select Music Folder** on the Library screen, choose your phone's `Music` folder, and enjoy offline playback and synchronized Arabic/multilingual lyrics!

## Step 7: Troubleshooting if a Build Fails

If the workflow run shows a **red X**:

1. Tap the failed workflow run in the **Actions** tab, then tap the job named **Extract Source ZIP, Commit & Build Android Debug APK**.
2. GitHub will automatically expand the step that failed. Also check the step named **Print build failure diagnostics** right below it.
3. Look at Which Step Failed:
   - **`Validate and extract folia-android-source.zip into staging`**: Make sure the uploaded file is named **`folia-android-source.zip`** (not renamed by Android to `folia-android-source (1).zip`) and sits in the root folder of your repository.
   - **`Commit and push extracted project files to branch`**: Go to your repository **Settings → Actions → General**, scroll to **Workflow permissions**, select **Read and write permissions**, and tap **Save**, then re-run the workflow.
   - **`Build production Android web bundle`** or **`Build Android Debug APK with Gradle`**: Copy the last 30–50 lines of error output from the failed step and the **Print build failure diagnostics** step to share for troubleshooting.
