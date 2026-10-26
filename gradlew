#!/usr/bin/env bash

# Resolve application directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If system gradle is installed, use it directly
if command -v gradle >/dev/null 2>&1; then
    exec gradle "$@"
fi

# Ensure gradle-wrapper.jar exists
WRAPPER_DIR="$DIR/gradle/wrapper"
WRAPPER_JAR="$WRAPPER_DIR/gradle-wrapper.jar"

if [ ! -f "$WRAPPER_JAR" ]; then
    mkdir -p "$WRAPPER_DIR"
    echo "Downloading gradle-wrapper.jar..."
    if command -v curl >/dev/null 2>&1; then
        curl -sLo "$WRAPPER_JAR" "https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar" || \
        curl -sLo "$WRAPPER_JAR" "https://repo1.maven.org/maven2/org/gradle/gradle-wrapper/8.5/gradle-wrapper-8.5.jar"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$WRAPPER_JAR" "https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar" || \
        wget -qO "$WRAPPER_JAR" "https://repo1.maven.org/maven2/org/gradle/gradle-wrapper/8.5/gradle-wrapper-8.5.jar"
    fi
fi

if [ -f "$WRAPPER_JAR" ]; then
    exec java -Dorg.gradle.appname=gradlew -classpath "$WRAPPER_JAR" org.gradle.wrapper.GradleWrapperMain "$@"
else
    echo "Error: Neither gradle nor gradle-wrapper.jar could be found or downloaded."
    exit 1
fi
