# monaco-meld a tool for fast merging

A lightweight Electron based app for fast diffing 2 files.

# Features

- fast start.

# Requirements

Some might need to run .appImages on Ubuntu 24.04.

```sh
sudo apt install libfuse2
```

# hotfix

As mentioned in the reference documentation, the problem is that Ubuntu 24.04 implemented new restrictions for AppImage apps, which restricts the use of sandboxes.

The solution is to lift the restrictions that Ubuntu 24.04 implements in the AppImages.

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
for deactivate restrictions

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=1
for activate restrictions

