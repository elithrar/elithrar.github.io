---
layout: post
title: Connecting to a Coral TPU Dev Board with Windows
categories: windows, hardware, machine-learning
---

The Coral TPU's [setup instructions](https://coral.withgoogle.com/tutorials/devboard-datasheet/#serial-console-port) only document a native Linux process, but it's entirely possible to flash the boot image via native Windows (without WSL).  

### Pre-requisites

You'll need to install a few things: this is mostly a process of clicking "next" a few times (the USB drivers) and unzipping a folder (the Android Platform Tools).

- Install the CP210x USB to UART drivers: [https://www.silabs.com/products/development-tools/software/usb-to-uart-bridge-vcp-drivers](https://www.silabs.com/products/development-tools/software/usb-to-uart-bridge-vcp-drivers)
- Use the Android Platform Tools distribution for fastboot - [https://developer.android.com/studio/releases/platform-tools.html#download](https://developer.android.com/studio/releases/platform-tools.html#download) and set your `PATH` to point at the location of this (unzipped) folder - e.g. in cmd via `setx path "%path%;%userprofile%/Downloads/platform-tools`
- A serial console utility: [PuTTY](https://www.putty.org/) is my go-to on Windows.
- Ensure you have the right cables: a USB-C power cable, a micro-USB cable (for the serial console), and a USB-C data cable.

You should also be moderately familiar with serial consoles & have read through the Coral's [setup instructions](https://coral.withgoogle.com/tutorials/devboard/) to familiarize yourself with the process.

> **Note**: It's important to make sure you're using a data-capable USB-C cable when connecting to the USB-C data port. Like many things USB-C / USB 3.x, this can be non-obvious at first. You'll know when the Device Manager shows a "⚠ USB Download Gadget" in the Device Manager. If you use a power-only cable, nothing will show up and it'll seem as if the OS isn't seeing the device.

### Connecting to the Serial Console

Mostly identical to the Coral setup instructions:

1. **Connect to the dev board's micro-USB port**, and identify the COM port the device is attached to in the Device Manager by looking under "Ports (COM & LPT)" for the "CP2105 USB to UART (Standard)" device. In my case, it was COM3.
2. **Power on the board** by connecting the USB-C power cable to the power port (furthest from the HDMI port). 
3. **Open PuTTY**, select "Serial" as the connection option, set the COM port to the one you identified above, and the data rate to 115200bps. For confirmation, the serial comms settings should be at 8 data bits, no parity bits, 1 stop bit and XON/XOFF flow control. 

The serial port on the dev board accepts other settings, but I'm documenting an explicit list for those who don't have a background in serial comms.

You should now be at the dev board's uboot prompt, and ready to flash the bootloader & disk image. If not, check that the board is powered on, that the COM port is correct, and that the Device Manager lists the device.

### Flashing the Board

Connect the USB-C data cable to the dev board, and the other end to your PC.

In the Device Manager, you'll see a "USB Download Gadget" appear with a warning symbol. Right click, choose "Update Driver", select "Browse my computer for driver software" and then "Let me pick from a  list of available drivers from my computer". In the driver browser, choose "WinUsb Device" from the left side, and "ADB Device" (Android Debugger) from the right. Click "Next" and accept the warning. The Device Manager will refresh, and show the device under "Universal Serial Bus devices".

To confirm it's configured correctly and visible to the OS, head back to your command prompt and enter:
```sh
λ fastboot devices
122041d6ef944da7        fastboot
```
If you don't see anything, confirm the device is still showing in the Device Manager, and that you have the latest version of fastboot from the Android Platform Tools (linked above).

From here, you'll need to download and unzip the bootloader image and the disk image (identical to the official instructions), and confirm you see the contents below:
```sh
λ curl -O https://dl.google.com/aiyprojects/mendel/enterprise/mendel-enterprise-beaker-22.zip
λ unzip mendel-enterprise-beaker-22.zip
λ cd mendel-enterprise-beaker-22
λ ls
    boot_arm64.img  partition-table-16gb.img  partition-table-8gb.img  rootfs_arm64.img
    flash.sh*       partition-table-64gb.img  recovery.img             u-boot.imx
```
Unfortunately, the `flash.sh` script is a Bash script, which won't work for us: but we can easily replicate what it does:
```sh
λ tail -n 15 flash.sh
fi

# Flash bootloader
${FASTBOOT_CMD} flash bootloader0 ${PRODUCT_OUT}/u-boot.imx
${FASTBOOT_CMD} reboot-bootloader

# Flash partition table
${FASTBOOT_CMD} flash gpt ${PRODUCT_OUT}/${PART_IMAGE}
${FASTBOOT_CMD} reboot-bootloader

# Flash filesystems
${FASTBOOT_CMD} erase misc
${FASTBOOT_CMD} flash boot ${PRODUCT_OUT}/boot_${USERSPACE_ARCH}.img
${FASTBOOT_CMD} flash rootfs ${PRODUCT_OUT}/rootfs_${USERSPACE_ARCH}.img
${FASTBOOT_CMD} reboot
```
Where we see "FASTBOOT_CMD" we simply run `fastboot` - and where we see `USERSPACE_ARCH` we only have one choice for the dev board: `arm64`. We can work with this.

In the serial console (e.g. in PuTTY), put the dev board into fastboot mode:
```sh
fastboot 0
```
Then, in the command prompt and from within the `mendel-enterprise-beaker-22` directory, invoke the following commands. You should leave the serial console connected: you'll see the progress of each step.
```sh
fastboot flash bootloader0 u-boot.imx
fastboot reboot-bootloader
 
fastboot flash gpt partition-table-8gb.img
fastboot reboot-bootloader

fastboot erase misc
fastboot flash boot boot_arm64.img
fastboot flash rootfs rootfs_arm64.img
fastboot reboot
```
When the device reboots, you'll get a more familiar Linux login prompt in the serial console! Enter `mendel` (username) and `mendel` (password) to log in, and then follow the steps within the official documentation to [set up network connectivity](https://coral.withgoogle.com/tutorials/devboard/#connect-to-the-internet)! You'll then be able to log into the board remotely via SSH, and will only need to connect it to power unless you want to flash it again.

Beyond that: enjoy experimenting & building things on your Coral Dev Board! And if you run into issues, or find something unclear in these instructions, you can reach me on Twitter at [@elithrar](https://twitter.com/elithrar).
