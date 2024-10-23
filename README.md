# monaco-meld 

A drop in replacement for meld with monaco diff. A lightweight Electron based app for fast diffing 2 files.

## Features

- Hopefully lightweight, so fast start
- Arrow based navigation
  - ⌥ Alt + ⬆︎: Navigate to previous change
  - ⌥ Alt + ⬇︎: Navigate to next change
  - ⌥ Alt + ⬅︎: Accept current change from right to left
- Syntax highlighting with Monaco

## Usage

Basic file comparison:
```sh
./monaco-meld-1.0.0.AppImage file1.js file2.js
```

Compare file with stdin content:
```sh
./monaco-meld-1.0.0.AppImage file1.js <(echo "modified content")
```

Compare with multiline content:
```sh
./monaco-meld-1.0.0.AppImage file1.js <(cat <<EOF
new content here
with multiple lines
EOF
)
```

## Building
Processing diff with AI for higher quality...

```sh
npm install
npm run build
```

## Requirements

Some might need to run .appImages on Ubuntu 24.04.

```sh
sudo apt install libfuse2
```

## Troubleshooting

As mentioned in the reference documentation, the problem is that Ubuntu 24.04 implemented new restrictions for AppImage apps, which restricts the use of sandboxes.

The solution is to lift the restrictions that Ubuntu 24.04 implements in the AppImages.

```sh
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
# to deactivate restrictions

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=1
# to activate restrictions
```


