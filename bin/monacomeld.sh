#!/usr/bin/env bash

# Find the actual location of the installed package
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Different path resolution based on installation type
if [[ $SCRIPT_DIR == *"/.nvm/"* ]]; then
    # NVM installation
    NVM_DIR=$(dirname $SCRIPT_DIR)
    APP_PATH="$NVM_DIR/lib/node_modules/monacomeld"
elif [[ $SCRIPT_DIR == *"node_modules/.bin"* ]]; then
    # Global npm installation
    NODE_ROOT=$(dirname $(dirname $(dirname $SCRIPT_DIR)))
    APP_PATH="$NODE_ROOT/lib/node_modules/monacomeld"
elif [[ $SCRIPT_DIR == *"node_modules"* ]]; then
    # Local npm installation
    APP_PATH="$SCRIPT_DIR/../"
else
    # Development
    APP_PATH="$SCRIPT_DIR/../lib/node_modules/monacomeld"
fi

ELECTRON_PATH="$(which electron)"
MAIN_PATH="$APP_PATH/src/main.cjs"

# Debug path resolution
echo "Resolved paths:"
echo "SCRIPT_DIR: $SCRIPT_DIR"
echo "APP_PATH: $APP_PATH"
echo "MAIN_PATH: $MAIN_PATH"

# Verify main.js exists
if [ ! -f "$MAIN_PATH" ]; then
    echo "Error: Cannot find main.cjs at $MAIN_PATH"
    exit 1
fi

# Ensure electron is available
if [ -z "$ELECTRON_PATH" ]; then
    echo "Error: electron not found. Please ensure electron is installed globally with:"
    echo "npm install -g electron"
    exit 1
fi


# Pass APP_PATH as environment variable
export APP_PATH

# Execute electron with all passed arguments
exec "$ELECTRON_PATH" "$MAIN_PATH" "--no-sandbox" "$@"
