#!/usr/bin/env python3

from pathlib import Path
import argparse
import csv as csv_mod
import json
import serial.tools.list_ports
import subprocess
import sys
import tempfile
import time
import serial


PROJECT_ROOT = Path(__file__).resolve().parent
DEVICES_FILE = PROJECT_ROOT / "devices.json"
LOG_FILE     = PROJECT_ROOT / "provision_log.csv"

NVS_OFFSET = "0x9000"
NVS_SIZE   = "0x6000"

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"

def ok(msg):   print(f"{GREEN}✔  {msg}{RESET}")
def err(msg):  print(f"{RED}✘  {msg}{RESET}")
def info(msg): print(f"{CYAN}→  {msg}{RESET}")
def warn(msg): print(f"{YELLOW}!  {msg}{RESET}")


def load_devices(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(
            f"Devices file not found: {path}"
        )
    devices = json.loads(path.read_text())
    if not devices:
        raise ValueError(f"No devices found in {path}")
    return devices


def log_result(device_id: str, port: str, result: str) -> None:
    first_write = not LOG_FILE.exists()
    with LOG_FILE.open("a", newline="") as f:
        w = csv_mod.writer(f)
        if first_write:
            w.writerow(["timestamp", "device_id", "port", "result"])
        w.writerow([time.strftime("%Y-%m-%dT%H:%M:%S"), device_id, port, result])


def current_ports() -> set[str]:
    return {p.device for p in serial.tools.list_ports.comports()}


def wait_for_new_port(known: set[str], timeout: int = 60) -> str | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        new = current_ports() - known
        if new:
            return new.pop()
        time.sleep(0.5)
    return None


def wait_for_port_gone(port: str, timeout: int = 30) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port not in current_ports():
            return True
        time.sleep(0.5)
    return False


def run(cmd: list[str]) -> None:
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def generate_nvs(device: dict, out_bin: Path) -> None:
    csv_contents = (
        "key,type,encoding,value\n"
        "lwnode,namespace,,\n"
        f"appEui,data,string,{device['app_eui']}\n"
        f"appkey,data,string,{device['app_key']}\n"
    )
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write(csv_contents)
        csv_path = Path(f.name)
    try:
        run([
            str(Path.home() / ".platformio/penv/bin/python"),
            "-m", "esp_idf_nvs_partition_gen",
            "generate",
            str(csv_path),
            str(out_bin),
            NVS_SIZE,
        ])
    finally:
        csv_path.unlink(missing_ok=True)


def flash_nvs(port: str, nvs_bin: Path) -> None:
    run([
        str(Path.home() / ".platformio/penv/bin/python"),
        str(Path.home() / ".platformio/packages/tool-esptoolpy/esptool.py"),
        "--chip", "esp32s3",
        "--port", port,
        "write_flash",
        NVS_OFFSET,
        str(nvs_bin),
    ])


def flash_firmware(port: str) -> None:
    run(["pio", "run", "-t", "upload", "--upload-port", port])


def wait_for_join(port: str, timeout: int = 120) -> bool:
    info("Waiting for JOIN successful...")
    start = time.time()
    with serial.Serial(port, 115200, timeout=1) as ser:
        while time.time() - start < timeout:
            line = ser.readline().decode(errors="ignore").strip()
            if line:
                print(f"  {line}")
            if "JOIN successful" in line:
                return True
    return False


def provision(device_id: str, device: dict, port: str) -> bool:
    nvs_bin = PROJECT_ROOT / "nvs_temp.bin"
    try:
        generate_nvs(device, nvs_bin)
        flash_nvs(port, nvs_bin)
        flash_firmware(port)
        joined = wait_for_join(port)
        result = "PASS" if joined else "FAIL"
        log_result(device_id, port, result)
        if joined:
            ok(f"Device {device_id} — PASS: joined network")
        else:
            err(f"Device {device_id} — FAIL: join timeout")
        return joined
    except subprocess.CalledProcessError as e:
        log_result(device_id, port, "ERROR")
        err(f"Device {device_id} — ERROR: {e}")
        return False
    finally:
        nvs_bin.unlink(missing_ok=True)


def run_batch(devices: dict) -> int:
    ids = list(devices.keys())
    total = len(ids)
    results = {}

    print(f"\n{CYAN}{'─'*50}")
    print(f"  Batch provisioner — {total} device(s)")
    print(f"{'─'*50}{RESET}\n")

    for i, device_id in enumerate(ids, 1):
        print(f"\n{CYAN}[{i}/{total}] Device {device_id}{RESET}")

        before = current_ports()
        input(f"{YELLOW}  Plug in device {device_id} then press ENTER…{RESET}")
        time.sleep(1.5)

        port = wait_for_new_port(before, timeout=15)
        if not port:
            after = current_ports()
            new = after - before
            if new:
                port = new.pop()
            else:
                err(f"No new port detected for device {device_id} — skipping")
                results[device_id] = "SKIPPED"
                continue

        info(f"Detected port: {port}")
        passed = provision(device_id, devices[device_id], port)
        results[device_id] = "PASS" if passed else "FAIL"

        if i < total:
            warn("Unplug the device now…")
            wait_for_port_gone(port, timeout=30)

    print(f"\n{CYAN}{'─'*50}")
    print("  Summary")
    print(f"{'─'*50}{RESET}")
    for device_id, result in results.items():
        colour = GREEN if result == "PASS" else (YELLOW if result == "SKIPPED" else RED)
        print(f"  Device {device_id}: {colour}{result}{RESET}")
    print(f"{CYAN}{'─'*50}{RESET}")
    print(f"  Log written to: {LOG_FILE}\n")

    failures = sum(1 for r in results.values() if r != "PASS")
    return 0 if failures == 0 else 1


def main() -> int:
    devices = load_devices(DEVICES_FILE)

    parser = argparse.ArgumentParser(
        description="ESP32 LoRaWAN provisioner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python provisioner.py                        # batch all devices\n"
            "  python provisioner.py --device 2 --port /dev/ttyUSB0  # single\n"
        ),
    )
    parser.add_argument("--device", choices=devices.keys(), metavar="ID",
                        help=f"Single device ID to flash ({', '.join(devices.keys())})")
    parser.add_argument("--port", help="Serial port (required with --device)")
    args = parser.parse_args()

    if args.device and not args.port:
        parser.error("--port is required when --device is specified")
    if args.port and not args.device:
        parser.error("--device is required when --port is specified")

    if args.device:
        passed = provision(args.device, devices[args.device], args.port)
        return 0 if passed else 1
    else:
        return run_batch(devices)


if __name__ == "__main__":
    raise SystemExit(main())
