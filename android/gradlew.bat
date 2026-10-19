@rem
@rem Gradle startup script for Windows generated for Folia Android (Capacitor).
@rem
@if "%DEBUG%"=="" @echo off
setlocal enabledelayedexpansion

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
set APP_HOME=%DIRNAME%
set WRAPPER_JAR=%APP_HOME%gradle\wrapper\gradle-wrapper.jar

if defined JAVA_HOME (
    set JAVA_EXE=%JAVA_HOME:"=%\bin\java.exe
    if not exist "!JAVA_EXE!" (
        echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME% 1>&2
        exit /b 1
    )
) else (
    set JAVA_EXE=java.exe
    !JAVA_EXE! -version >NUL 2>&1
    if errorlevel 1 (
        echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH. 1>&2
        exit /b 1
    )
)

if exist "%WRAPPER_JAR%" (
    "!JAVA_EXE!" -Xmx64m -Xms64m "-Dorg.gradle.appname=gradlew" -classpath "%WRAPPER_JAR%" org.gradle.wrapper.GradleWrapperMain %*
    exit /b !ERRORLEVEL!
)

set GRADLE_VERSION=8.14.3
if defined GRADLE_USER_HOME (
    set CACHE_ROOT=%GRADLE_USER_HOME%\wrapper\dists\gradle-%GRADLE_VERSION%-bootstrap
) else (
    set CACHE_ROOT=%USERPROFILE%\.gradle\wrapper\dists\gradle-%GRADLE_VERSION%-bootstrap
)
set GRADLE_BAT=%CACHE_ROOT%\gradle-%GRADLE_VERSION%\bin\gradle.bat

if not exist "%GRADLE_BAT%" (
    echo [gradlew.bat] Bootstrapping Gradle %GRADLE_VERSION%...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ErrorActionPreference = 'Stop'; New-Item -ItemType Directory -Force -Path '%CACHE_ROOT%' | Out-Null; $zip = '%CACHE_ROOT%\gradle.zip'; Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip' -OutFile $zip; Expand-Archive -Path $zip -DestinationPath '%CACHE_ROOT%' -Force; Remove-Item $zip -Force"
    if errorlevel 1 exit /b 1
)

call "%GRADLE_BAT%" -p "%APP_HOME%" %*
exit /b %ERRORLEVEL%
