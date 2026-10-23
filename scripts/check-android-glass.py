#!/usr/bin/env python3
"""Capture and compare the Expo fixture's real Android renderer.

Requires Python 3 and Pillow. Capture installs the explicitly supplied APK. Measure
never installs: it verifies the installed APK before launching a bounded workload.
Run measurements through the owning BB Resources benchmark reservation.
"""

import argparse
import hashlib
import io
import json
import math
import pathlib
import re
import shlex
import statistics
import subprocess
import sys
import time
import urllib.parse
import xml.etree.ElementTree as ET

from PIL import Image, ImageChops, ImageStat


ADB = "/Users/alex/Library/Android/sdk/platform-tools/adb"
PACKAGE = "com.glassyui.expoconsumer"
FIXED_BUDGET_NS = 16_666_667
FRAME_TRACKER_SOURCE = "https://android.googlesource.com/platform/frameworks/native/+/refs/heads/main/services/surfaceflinger/FrameTracker.cpp"
SURFACE_FLINGER_SOURCE = "https://android.googlesource.com/platform/frameworks/native/+/refs/heads/main/services/surfaceflinger/SurfaceFlinger.cpp"


def sha256(path):
    digest = hashlib.sha256()
    with pathlib.Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    pathlib.Path(path).write_text(json.dumps(value, indent=2) + "\n")


def bounds(node):
    values = [int(value) for value in re.findall(r"-?\d+", node.get("bounds", ""))]
    return tuple(values) if len(values) == 4 else None


def find_node(nodes, resource_id=None, label=None, text=None):
    for node in nodes:
        if resource_id is not None and node.get("resource-id") != resource_id:
            continue
        if label is not None and node.get("content-desc") != label:
            continue
        if text is not None and node.get("text") != text:
            continue
        rectangle = bounds(node)
        if rectangle and rectangle[2] > rectangle[0] and rectangle[3] > rectangle[1]:
            return node
    return None


def pixel_difference(first, second, region):
    if first.size != second.size:
        raise AssertionError(f"Image sizes differ: {first.size} versus {second.size}")
    first = first.convert("RGB").crop(region)
    second = second.convert("RGB").crop(region)
    difference = ImageChops.difference(first, second)
    channels = difference.split()
    changed = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
    histogram = changed.histogram()
    pixels = first.width * first.height
    channel_rms = ImageStat.Stat(difference).rms
    return {
        "region": list(region),
        "pixels": pixels,
        "changedPixels": pixels - histogram[0],
        "maxChannelError": max(high for low, high in difference.getextrema()),
        "rootMeanSquareChannelError": math.sqrt(sum(x * x for x in channel_rms) / 3),
    }


class Device:
    def __init__(self, serial):
        self.serial = serial
        self.width = 0
        self.height = 0
        self.density = 1
        self.offset_probes = []

    def adb(self, *arguments, binary=False, timeout=35):
        result = subprocess.run(
            [ADB, "-s", self.serial, *map(str, arguments)],
            capture_output=True,
            timeout=timeout,
            check=True,
        )
        return result.stdout if binary else (result.stdout + result.stderr).decode(errors="replace")

    def shell(self, *arguments, timeout=35):
        return self.adb("shell", shlex.join([str(value) for value in arguments]), timeout=timeout)

    def metadata(self):
        assert self.adb("get-state").strip() == "device", "ADB target is not ready"
        assert self.shell("getprop", "sys.boot_completed").strip() == "1", "Android has not booted"
        size = self.shell("wm", "size")
        density = self.shell("wm", "density")
        size_matches = re.findall(r"(?:Physical|Override) size: (\d+)x(\d+)", size)
        density_matches = re.findall(r"(?:Physical|Override) density: (\d+)", density)
        assert size_matches and density_matches, "Could not read Android display geometry"
        self.width, self.height = map(int, size_matches[-1])
        self.density = int(density_matches[-1]) / 160
        return {
            "serial": self.serial,
            "api": self.shell("getprop", "ro.build.version.sdk").strip(),
            "android": self.shell("getprop", "ro.build.version.release").strip(),
            "fingerprint": self.shell("getprop", "ro.build.fingerprint").strip(),
            "width": self.width,
            "height": self.height,
            "densityScale": self.density,
        }

    def system_strips(self):
        raw = self.shell("dumpsys", "window", "displays")
        pattern = (
            r"\b(statusBars|navigationBars|ITYPE_STATUS_BAR|ITYPE_NAVIGATION_BAR)\b"
            r"[^{}]*?(?:mFrame|frame)=\[\s*(\d+),\s*(\d+)\]\[\s*(\d+),\s*(\d+)\]"
        )
        sources = []
        for match in re.finditer(pattern, raw):
            kind = match[1]
            rectangle = tuple(map(int, match.groups()[1:]))
            if rectangle[0] == 0 and rectangle[2] == self.width:
                sources.append({"type": kind, "bounds": list(rectangle)})
        tops = [source["bounds"][3] for source in sources
                if source["type"] in ("statusBars", "ITYPE_STATUS_BAR") and source["bounds"][1] == 0]
        bottoms = [self.height - source["bounds"][1] for source in sources
                   if source["type"] in ("navigationBars", "ITYPE_NAVIGATION_BAR")
                   and source["bounds"][3] == self.height]
        assert tops and bottoms, (
            "Could not identify actual Android status/navigation InsetsSource rectangles; "
            "supply verified --exclude-top and --exclude-bottom pixel heights"
        )
        return max(tops), max(bottoms), sources

    def buffer_layer(self):
        raw = self.shell("dumpsys", "SurfaceFlinger", "--list")
        activity = f"{PACKAGE}/{PACKAGE}.MainActivity"
        pattern = re.compile(re.escape(activity) + r"(?:\(BLAST\))?(?:#\d+)?")
        candidates = []
        for line in raw.splitlines():
            name = line.strip()
            if name.startswith("RequestedLayerState{"):
                match = re.match(r"RequestedLayerState\{(.+?) parentId=", name)
                if not match:
                    continue
                name = match[1]
            if pattern.fullmatch(name):
                candidates.append(name)
        assert len(candidates) == 1, (
            f"Expected exactly one fixture activity buffer layer, found {candidates}; "
            "do not substitute an activity container, input sink or another application's layer"
        )
        return candidates[0], raw

    def launch(self, theme="light", mode="clear", screen="gallery", offset=0, opaque=False, motion=False):
        parameters = {
            "theme": theme,
            "mode": mode,
            "screen": screen,
            "offset": f"{offset:.3f}",
            "opaque": "1" if opaque else "0",
            "motion": "1" if motion else "0",
        }
        url = "glassyui-proof://capture?" + urllib.parse.urlencode(parameters)
        self.shell("am", "force-stop", PACKAGE)
        result = self.shell(
            "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", url, "-p", PACKAGE
        )
        assert "Status: ok" in result, f"Fixture launch failed: {result}"
        return url

    def tree(self):
        path = "/sdcard/glassyui-proof.xml"
        result = self.shell("uiautomator", "dump", path, timeout=30)
        assert "dumped to:" in result, f"Hierarchy did not settle: {result}"
        raw = self.shell("cat", path)
        return [dict(node.attrib) for node in ET.fromstring(raw).iter("node")]

    def wait_node(self, **selector):
        deadline = time.monotonic() + 30
        while True:
            nodes = self.tree()
            found = find_node(nodes, **selector)
            if found:
                return nodes, found
            if time.monotonic() >= deadline:
                raise AssertionError(f"Visible native node not found: {selector}")
            time.sleep(0.25)

    def tap(self, node, hold_ms=0):
        left, top, right, bottom = bounds(node)
        x, y = (left + right) // 2, (top + bottom) // 2
        assert 0 <= x < self.width and 0 <= y < self.height, "Tap target is outside display"
        if hold_ms > 0:
            self.shell("input", "swipe", x, y, x, y, hold_ms)
        else:
            self.shell("input", "tap", x, y)
        time.sleep(0.25)

    def image(self, timeout=35):
        result = self.adb("exec-out", "screencap", "-p", binary=True, timeout=timeout)
        picture = Image.open(io.BytesIO(result)).convert("RGB")
        assert picture.size == (self.width, self.height), "Screenshot/display geometry differs"
        return picture

    def swipe(self, upwards=True):
        start, end = (0.77, 0.43) if upwards else (0.43, 0.77)
        self.shell("input", "swipe", int(self.width * 0.92), int(self.height * start),
                   int(self.width * 0.92), int(self.height * end), 400)

    def discover_offset(self, resource_id, desired_dp):
        """Locate an anchor through reproducible launch offsets, never accumulated swipes."""
        top, bottom, unused = self.system_strips()
        grid = list(range(0, 12_351, 650))
        preferred = {"controls-input": 1300, "open-dialog": 5200}.get(resource_id, 0)
        probes = [preferred] + [offset for offset in grid if offset != preferred]
        deadline = time.monotonic() + 120
        for offset in probes:
            if time.monotonic() >= deadline:
                break
            url = self.launch(offset=offset)
            nodes, unused = self.wait_node(resource_id="gallery")
            found = find_node(nodes, resource_id=resource_id)
            rectangle = bounds(found) if found else None
            visible = bool(rectangle and rectangle[1] > top and rectangle[3] < self.height - bottom)
            probe = {"resourceId": resource_id, "requestedOffsetDP": offset, "launchUrl": url,
                     "nativeBounds": list(rectangle) if rectangle else None, "fullyVisible": visible}
            self.offset_probes.append(probe)
            print(json.dumps({"offsetProbe": probe}), flush=True)
            if visible:
                content_y = offset + rectangle[1] / self.density
                return max(0, content_y - desired_dp)
        raise AssertionError(
            f"Could not discover fully visible {resource_id} within 20 launch offsets/120 seconds; "
            "supply its explicit --offset option"
        )


class Capture:
    def __init__(self, args):
        self.args = args
        self.device = Device(args.serial)
        self.output = args.output
        self.output.mkdir(parents=True, exist_ok=False)
        self.report = {"command": "capture", "invocation": shlex.join([sys.executable, *sys.argv]),
                       "runnerSha256": sha256(__file__), "package": PACKAGE,
                       "scenes": [], "checks": [], "passed": False}

    def check(self, name, condition, **details):
        result = {"name": name, "passed": bool(condition), **details}
        self.report["checks"].append(result)
        assert condition, name

    def save(self, name, nodes=None, comparable=True, url=None):
        started = time.monotonic()
        picture = self.device.image(timeout=15)
        stabilization = None
        if comparable:
            region = (0, self.args.exclude_top, self.device.width,
                      self.device.height - self.args.exclude_bottom)
            assert 0 <= region[1] < region[3] <= self.device.height, "Invalid system-strip exclusions"
            changes = []
            unchanged = 0
            deadline = started + 15
            while unchanged < 3 or time.monotonic() - started < 1:
                remaining = deadline - time.monotonic()
                assert remaining > 0.25, f"Static scene {name} did not stabilize exactly within 15 seconds"
                time.sleep(0.25)
                next_picture = self.device.image(timeout=max(0.1, remaining - 0.25))
                difference = pixel_difference(picture, next_picture, region)
                changes.append(difference["changedPixels"])
                unchanged = unchanged + 1 if difference["changedPixels"] == 0 else 0
                picture = next_picture
            stabilization = {"captureAttempts": len(changes) + 1,
                             "elapsedSeconds": time.monotonic() - started,
                             "consecutiveExactTransitions": unchanged,
                             "changedProductPixelsPerAttempt": changes,
                             "region": list(region), "encodingDuringPolling": False}
        destination = self.output / (name + ".webp")
        picture.save(destination, "WEBP", lossless=True, method=6)
        self.report["scenes"].append({
            "name": name, "file": destination.name, "sha256": sha256(destination),
            "width": picture.width, "height": picture.height, "comparable": comparable,
            "rawRgbSha256": hashlib.sha256(picture.tobytes()).hexdigest(),
            "stabilization": stabilization, "launchUrl": url, "nodes": nodes or [],
        })
        return picture

    def launch(self, **parameters):
        url = self.device.launch(**parameters)
        screen = parameters.get("screen", "gallery")
        selector = {"text": "Backdrop boundary"} if screen == "boundary" else {
            "resource_id": "today" if screen == "today" else "gallery"
        }
        nodes, unused = self.device.wait_node(**selector)
        return url, nodes

    def change_checked(self, selector, name):
        nodes, node = self.device.wait_node(**selector)
        old = node.get("checked")
        assert old in ("true", "false"), f"Native checked state missing: {name}"
        self.device.tap(node)
        nodes, changed = self.device.wait_node(**selector)
        self.check(name, changed.get("checked") == ("false" if old == "true" else "true"),
                   before=old, after=changed.get("checked"))

    def input_text(self, name):
        nodes, node = self.device.wait_node(resource_id="controls-input")
        self.device.tap(node)
        self.device.shell("input", "keyevent", "KEYCODE_MOVE_END", *(["KEYCODE_DEL"] * 32))
        nodes, node = self.device.wait_node(resource_id="controls-input")
        placeholder = "you@example.com"
        reported = node.get("text")
        showing_placeholder = reported == placeholder and node.get("hint") == placeholder
        self.check(name + " focused and cleared or showing known placeholder",
                   node.get("focused") == "true" and (reported == "" or showing_placeholder),
                   clearMethod="KEYCODE_MOVE_END followed by 32 KEYCODE_DEL in one input keyevent invocation",
                   reportedNativeText=reported, placeholder=placeholder,
                   nativePlaceholderReportedAsText=showing_placeholder)
        expected = "native@test.invalid"
        self.device.shell("input", "text", expected)
        nodes, node = self.device.wait_node(resource_id="controls-input")
        self.check(name + " accepts exact text", node.get("text") == expected,
                   expected=expected, actual=node.get("text"))
        self.device.shell("input", "keyevent", "KEYCODE_BACK")

    def overlay(self, name, opener, closer, parameters):
        url, unused = self.launch(offset=self.report["offsets"]["overlays"], **parameters)
        nodes, node = self.device.wait_node(resource_id=opener)
        self.device.tap(node, hold_ms=180)
        nodes, close = self.device.wait_node(resource_id=closer)
        self.check(name + " opens", True, openerHoldMilliseconds=180,
                   openerInput="Stationary swipe; release after the native minimum press duration")
        self.save(name, nodes, url=url)
        self.device.tap(close)
        nodes = self.device.tree()
        self.check(name + " closes", find_node(nodes, resource_id=closer) is None)

    def boundary(self, theme):
        url, nodes = self.launch(screen="boundary", theme=theme)
        pictures = {}
        for state, button in [("before", None), ("phase", "proof-phase"),
                              ("geometry", "proof-geometry"), ("detach", "proof-detach"),
                              ("reattach", "proof-detach"), ("remount", "proof-remount")]:
            previous = find_node(nodes, text="subtle")
            if button:
                node = find_node(nodes, resource_id=button)
                assert node, f"Missing boundary control {button}"
                self.device.tap(node)
                nodes = self.device.tree()
            visible = find_node(nodes, text="subtle")
            self.check(theme + " boundary " + state + " surface presence", bool(visible) == (state != "detach"))
            if state == "geometry":
                self.check(theme + " boundary geometry moves surface", bounds(previous) != bounds(visible),
                           before=list(bounds(previous)), after=list(bounds(visible)))
            pictures[state] = self.save(f"{theme}-boundary-{state}", nodes, url=url)
            if state == "before":
                static_nodes = nodes
        region = (0, self.args.exclude_top, self.device.width, self.device.height - self.args.exclude_bottom)
        phase_diff = pixel_difference(pictures["before"], pictures["phase"], region)
        self.check(theme + " boundary backdrop changes", phase_diff["changedPixels"] > 0, **phase_diff)
        remount_diff = pixel_difference(pictures["reattach"], pictures["remount"], region)
        self.check(theme + " boundary remount retains pixels", remount_diff["changedPixels"] == 0, **remount_diff)

        self.device.launch(screen="boundary", theme=theme, motion=True)
        time.sleep(2)
        first = self.save(f"{theme}-boundary-live-0", comparable=False)
        time.sleep(0.65)
        second = self.save(f"{theme}-boundary-live-1", comparable=False)
        differences = []
        for label in ("subtle", "control", "standard", "prominent"):
            node = find_node(static_nodes, text=label)
            assert node, f"Missing static boundary material {label}"
            left, top, right, bottom = bounds(node)
            cx, cy = (left + right) / 2, (top + bottom) / 2
            density = self.device.density
            roi = (round(cx - 50 * density), round(cy + 24 * density),
                   round(cx + 50 * density), round(cy + 62 * density))
            assert 0 <= roi[0] < roi[2] <= self.device.width and 0 <= roi[1] < roi[3] <= self.device.height
            differences.append({"material": label, **pixel_difference(first, second, roi)})
        self.check(theme + " live backdrop changes inside glass", any(d["changedPixels"] for d in differences),
                   regions=differences, requestedSleepSeconds=0.65,
                   limit="Checks visible source updates; these moving frames are excluded from static parity.")

    def run(self):
        try:
            self.report["environment"] = self.device.metadata()
            self.report["profile"] = "quick" if self.args.quick else "full"
            if self.args.exclude_top is None or self.args.exclude_bottom is None:
                top, bottom, sources = self.device.system_strips()
                self.args.exclude_top = top if self.args.exclude_top is None else self.args.exclude_top
                self.args.exclude_bottom = bottom if self.args.exclude_bottom is None else self.args.exclude_bottom
                self.report["systemRegionEvidence"] = {"command": "dumpsys window displays", "sources": sources}
            else:
                self.report["systemRegionEvidence"] = {"source": "Explicit operator-verified pixel heights"}
            self.report["staticComparison"] = {"excludedTopPixels": self.args.exclude_top,
                                                "excludedBottomPixels": self.args.exclude_bottom,
                                                "automaticMasks": False}
            self.report["apk"] = {"path": str(self.args.apk.resolve()), "sha256": sha256(self.args.apk)}
            self.device.adb("install", "--no-incremental", "-r", str(self.args.apk.resolve()), timeout=180)
            if self.args.quick:
                self.report["offsets"] = {}
                url, nodes = self.launch()
                self.save("light-clear-gallery", nodes, url=url)
                url, nodes = self.launch(screen="today")
                self.save("light-clear-today", nodes, url=url)
                self.change_checked({"label": "Focus"}, "quick Focus switch changes")
                self.change_checked({"label": "Review the launch notes"}, "quick task changes")
                self.boundary("light")
                self.report["limit"] = "Quick harness preflight; omits full themes, modes, controls and overlays."
                self.report["passed"] = True
                return
            if self.args.offsets_from:
                baseline = json.loads(self.args.offsets_from.read_text())
                assert baseline["profile"] == "full", "Full captures require offsets from a full baseline capture"
                self.report["offsets"] = baseline["offsets"]
            else:
                self.report["offsets"] = {}
                self.report["offsetDiscovery"] = self.device.offset_probes
                for name, supplied, resource_id, desired in (
                    ("controls", self.args.controls_offset, "controls-input", 160),
                    ("overlays", self.args.overlays_offset, "open-dialog", 140),
                ):
                    offset = supplied if supplied is not None else self.device.discover_offset(resource_id, desired)
                    self.report["offsets"][name] = offset
                    write_json(self.output / "capture.json", self.report)
            for theme in self.args.themes:
                for mode in self.args.modes:
                    parameters = {"theme": theme, "mode": mode}
                    prefix = f"{theme}-{mode}"
                    url, nodes = self.launch(**parameters)
                    for identifier, expected in [("toggle-theme", "Dark" if theme == "light" else "Light"),
                                                  ("toggle-mode", "Tinted" if mode == "clear" else "Clear"),
                                                  ("toggle-transparency", "Opaque"), ("toggle-motion", "Motion")]:
                        node = find_node(nodes, resource_id=identifier)
                        self.check(prefix + " " + identifier, bool(node) and node.get("content-desc") == expected)
                    self.save(prefix + "-gallery", nodes, url=url)
                    url, nodes = self.launch(offset=self.report["offsets"]["controls"], **parameters)
                    self.check(prefix + " controls visible", find_node(nodes, resource_id="controls-input") is not None)
                    self.save(prefix + "-controls", nodes, url=url)
                    self.input_text(prefix + " input")
                    self.overlay(prefix + "-dialog", "open-dialog", "dialog-cancel", parameters)
                    self.overlay(prefix + "-sheet", "open-sheet", "sheet-copy", parameters)
                    url, nodes = self.launch(screen="today", **parameters)
                    self.save(prefix + "-today", nodes, url=url)
                    self.change_checked({"label": "Focus"}, prefix + " Focus switch changes")
                    self.change_checked({"label": "Review the launch notes"}, prefix + " task changes")
                    nodes, week = self.device.wait_node(label="Week")
                    self.device.tap(week)
                    nodes, week = self.device.wait_node(label="Week")
                    self.check(prefix + " Week selected", week.get("checked") == "true")
                for screen in ("gallery", "today"):
                    url, nodes = self.launch(theme=theme, screen=screen, opaque=True)
                    self.save(f"{theme}-opaque-{screen}", nodes, url=url)
                self.boundary(theme)
            self.report["passed"] = True
        except Exception as error:
            self.report["failure"] = f"{type(error).__name__}: {error}"
            if self.device.width:
                try:
                    self.save("failure", comparable=False)
                except Exception as screenshot_error:
                    self.report["failureScreenshotError"] = str(screenshot_error)
            raise
        finally:
            self.report["retainedBytes"] = sum(path.stat().st_size for path in self.output.iterdir() if path.is_file())
            write_json(self.output / "capture.json", self.report)


def compare(args):
    before = json.loads((args.before / "capture.json").read_text())
    after = json.loads((args.after / "capture.json").read_text())
    assert before["passed"] and after["passed"], "Both capture procedures must pass before visual comparison"
    assert before.get("profile") == after.get("profile"), "Quick and full capture profiles cannot be compared"
    assert before["offsets"] == after["offsets"], "Reuse baseline offsets with --offsets-from"
    assert before["environment"] == after["environment"], "Before/after Android environment differs"
    assert before["staticComparison"] == after["staticComparison"], "Comparison exclusions differ"
    top = before["staticComparison"]["excludedTopPixels"]
    bottom = before["staticComparison"]["excludedBottomPixels"]
    assert args.exclude_top is None or args.exclude_top == top, "Use the recorded status-strip exclusion"
    assert args.exclude_bottom is None or args.exclude_bottom == bottom, "Use the recorded navigation-strip exclusion"
    first_scenes = {scene["name"]: scene for scene in before["scenes"] if scene["comparable"]}
    second_scenes = {scene["name"]: scene for scene in after["scenes"] if scene["comparable"]}
    assert first_scenes.keys() == second_scenes.keys(), "Static scene coverage differs"
    results = []
    for name, scene in first_scenes.items():
        other = second_scenes[name]
        source, destination = args.before / scene["file"], args.after / other["file"]
        assert sha256(source) == scene["sha256"] and sha256(destination) == other["sha256"], "Capture hash changed"
        with Image.open(source) as first, Image.open(destination) as second:
            region = (0, top, first.width, first.height - bottom)
            assert 0 <= region[1] < region[3] <= first.height, "Invalid system-strip exclusions"
            results.append({"name": name, **pixel_difference(first, second, region)})
    report = {"before": str(args.before.resolve()), "after": str(args.after.resolve()),
              "profile": before.get("profile"), "excludedTopPixels": top, "excludedBottomPixels": bottom,
              "automaticMasks": False, "scenes": results,
              "pixelIdentical": all(result["changedPixels"] == 0 for result in results),
              "note": "Every nonzero product-region difference needs inspection; no tolerance is applied."}
    args.output.mkdir(parents=True, exist_ok=False)
    write_json(args.output / "comparison.json", report)
    print(json.dumps({"scenes": len(results), "pixelIdentical": report["pixelIdentical"]}))
    return 0 if report["pixelIdentical"] else 1


def parse_frames(raw):
    total = re.search(r"^Total frames rendered: (\d+)", raw, re.M)
    jank = re.search(r"^Janky frames: (\d+)", raw, re.M)
    assert total and jank, "Android graphics totals are missing"
    header = None
    seen = set()
    rows = []
    for line in raw.splitlines():
        if line.startswith("Flags,"):
            header = line.strip(",").split(",")
        elif header and re.match(r"^\d+,", line):
            values = line.strip(",").split(",")
            if len(values) != len(header):
                continue
            row = dict(zip(header, map(int, values)))
            intended = row["IntendedVsync"]
            duration = row["FrameCompleted"] - intended
            if row["Flags"] == 0 and 0 < duration < 10_000_000_000 and intended not in seen:
                seen.add(intended)
                rows.append(row)
    assert rows, "No eligible frame samples; workload produced no measurable Android frames"
    durations = sorted((row["FrameCompleted"] - row["IntendedVsync"]) / 1e6 for row in rows)
    memory = re.search(r"RenderTarget: ([\d.]+) (\w+) \((\d+) entries\)", raw)
    budgets = [(row["FrameDeadline"] - row["IntendedVsync"]) / 1e6 for row in rows if "FrameDeadline" in row]
    return {
        "aggregateFrames": int(total[1]), "androidAdaptiveJankyFrames": int(jank[1]),
        "availableUniqueFrames": len(rows), "fixedBudgetMs": FIXED_BUDGET_NS / 1e6,
        "availableFramesExceedingFixedBudget": sum(
            row["FrameCompleted"] - row["IntendedVsync"] > FIXED_BUDGET_NS for row in rows),
        "medianAvailableFrameLatencyMs": statistics.median(durations),
        "p95AvailableFrameLatencyMs": durations[min(len(durations) - 1, math.ceil(len(durations) * 0.95) - 1)],
        "availableSampleSpanSeconds": (max(seen) - min(seen)) / 1e9,
        "medianDeclaredDeadlineBudgetMs": statistics.median(budgets) if budgets else None,
        "scratchRenderTarget": {"value": float(memory[1]), "androidUnitLabel": memory[2], "entries": int(memory[3])} if memory else None,
        "frameLatencyMs": durations,
        "limit": "Eligible rolling framestats samples, not all window frames or pure GPU time; no FPS conversion.",
    }


def parse_presentations(raw):
    """AOSP dumpStats: refresh ns, then desired/actual/ready presentation ns."""
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    assert lines and re.fullmatch(r"\d+", lines[0]), "SurfaceFlinger refresh period is missing"
    refresh = int(lines[0])
    assert refresh > 0, "SurfaceFlinger refresh period is zero"
    triples = []
    for line in lines[1:]:
        values = line.split()
        assert len(values) == 3 and all(re.fullmatch(r"-?\d+", value) for value in values), (
            "Unexpected SurfaceFlinger latency row; expected desired/actual/ready nanoseconds"
        )
        triples.append(tuple(map(int, values)))
    # FrameTracker::isFrameValidLocked tests the actual timestamp against these bounds.
    actual = [row[1] for row in triples if 0 < row[1] < (1 << 63) - 1]
    unique = sorted(set(actual))
    assert len(unique) >= 2, "Fewer than two valid app presentations; cadence cannot be measured"
    intervals_ns = [right - left for left, right in zip(unique, unique[1:])]
    intervals_ms = [value / 1e6 for value in intervals_ns]
    ordered = sorted(intervals_ms)
    return {
        "source": "SurfaceFlinger --latency, actualPresentTime column",
        "sourceContracts": [FRAME_TRACKER_SOURCE, SURFACE_FLINGER_SOURCE],
        "refreshPeriodNs": refresh, "refreshRateHz": 1e9 / refresh,
        "returnedTimestampRows": len(triples), "validPresentationRows": len(actual),
        "invalidOrPendingPresentationRows": len(triples) - len(actual),
        "duplicateActualPresentationTimes": len(actual) - len(unique),
        "uniqueActualPresentations": len(unique), "intervalSamples": len(intervals_ms),
        "sampleSpanSeconds": (unique[-1] - unique[0]) / 1e9,
        "meanPresentationIntervalMs": statistics.mean(intervals_ms),
        "medianPresentationIntervalMs": statistics.median(intervals_ms),
        "p95PresentationIntervalMs": ordered[max(0, math.ceil(len(ordered) * 0.95) - 1)],
        "intervalsOverOneAndHalfRefresh": sum(value > 1.5 * refresh for value in intervals_ns),
        "oneAndHalfRefreshThresholdMs": 1.5 * refresh / 1e6,
        "actualPresentationTimesNs": unique, "presentationIntervalsMs": intervals_ms,
        "limit": (
            "Bounded rolling platform buffer, not all workload frames; returnedTimestampRows records "
            "this platform's actual capacity. Presentation spacing is distinct from gfxinfo frame latency. "
            "Intervals during idle UI cannot establish FPS."
        ),
    }


def measure(args):
    args.output.mkdir(parents=True, exist_ok=False)
    device = Device(args.serial)
    report = {"command": "measure", "invocation": shlex.join([sys.executable, *sys.argv]),
              "runnerSha256": sha256(__file__), "passed": False}
    try:
        report["environment"] = device.metadata()
        report["apkSha256"] = sha256(args.apk)
        paths = device.shell("pm", "path", PACKAGE).splitlines()
        bases = [line.removeprefix("package:") for line in paths if line.endswith("/base.apk")]
        assert len(bases) == 1, "Cannot identify installed fixture APK"
        installed_hash = device.shell("sha256sum", bases[0]).split()[0]
        assert installed_hash == report["apkSha256"], "Installed fixture APK differs from --apk; capture/install it first"
        report["launchUrl"] = device.launch(theme=args.theme, mode=args.mode, screen=args.screen,
                                             offset=args.offset, motion=True)
        time.sleep(3)
        controls = None
        if args.screen == "today":
            nodes, unused = device.wait_node(label="Week")
            controls = [find_node(nodes, label=label) for label in ("Week", "Day", "Focus")]
            assert all(controls), "Today controls are not visible before timing"
        layer = None
        if args.screen in ("gallery", "boundary"):
            layer, layers_raw = device.buffer_layer()
            report["presentationLayer"] = layer
            (args.output / "surfaceflinger-layers.txt").write_text(layers_raw)
            device.shell("dumpsys", "SurfaceFlinger", "--latency-clear", layer)
            presentation_cleared = time.monotonic()
        else:
            report["presentationCadence"] = {
                "collected": False,
                "limit": "Today contains idle periods between control taps; no presentation-FPS interpretation.",
            }
        device.shell("dumpsys", "gfxinfo", PACKAGE, "reset")
        started = time.monotonic()
        for index in range(10):
            if controls:
                device.tap(controls[index % len(controls)])
            else:
                device.swipe(upwards=index % 2 == 0)
        workload_ended = time.monotonic()
        report["workloadWallSeconds"] = workload_ended - started
        raw_names = ["gfxinfo.txt", "meminfo.txt"]
        if layer:
            presentation_raw = device.shell("dumpsys", "SurfaceFlinger", "--latency", layer)
            (args.output / "surfaceflinger-latency.txt").write_text(presentation_raw)
            report["presentationCadence"] = {
                "collected": True, "continuousScene": args.screen,
                "clearCompletedSecondsBeforeWorkload": started - presentation_cleared,
                "readCompletedSecondsAfterWorkload": time.monotonic() - workload_ended,
                **parse_presentations(presentation_raw),
            }
            raw_names.extend(["surfaceflinger-layers.txt", "surfaceflinger-latency.txt"])
        raw = device.shell("dumpsys", "gfxinfo", PACKAGE, "framestats")
        report["windowWallSeconds"] = time.monotonic() - started
        (args.output / "gfxinfo.txt").write_text(raw)
        report.update(parse_frames(raw))
        memory = device.shell("dumpsys", "meminfo", PACKAGE)
        (args.output / "meminfo.txt").write_text(memory)
        report["rawHashes"] = {name: sha256(args.output / name) for name in raw_names}
        report["workload"] = (
            "Ten Week/Day/Focus taps" if controls else "Ten alternating 400 ms vertical swipes"
        ) + "; command/renderer delays are included in wall time."
        report["passed"] = True
    except Exception as error:
        report["failure"] = f"{type(error).__name__}: {error}"
        raise
    finally:
        write_json(args.output / "measurement.json", report)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    capture = commands.add_parser("capture", help="Install supplied APK and capture deterministic real app scenes")
    capture.add_argument("--apk", type=pathlib.Path, required=True)
    capture.add_argument("--output", type=pathlib.Path, required=True)
    capture.add_argument("--serial", default="emulator-5554")
    capture.add_argument("--controls-offset", type=float)
    capture.add_argument("--overlays-offset", type=float)
    capture.add_argument("--offsets-from", type=pathlib.Path, help="Baseline capture.json; mandatory reuse for patched captures")
    capture.add_argument("--quick", action="store_true", help="Light/clear gallery, Today and boundary preflight; not full acceptance")
    capture.add_argument("--themes", nargs="+", choices=["light", "dark"], default=["light", "dark"])
    capture.add_argument("--modes", nargs="+", choices=["clear", "tinted"], default=["clear", "tinted"])
    comparison = commands.add_parser("compare", help="Count every product-region pixel difference without tolerance")
    comparison.add_argument("--before", type=pathlib.Path, required=True)
    comparison.add_argument("--after", type=pathlib.Path, required=True)
    comparison.add_argument("--output", type=pathlib.Path, required=True)
    for command in (capture, comparison):
        command.add_argument("--exclude-top", type=int, help="Verified status strip pixels; default actual InsetsSource/recorded height")
        command.add_argument("--exclude-bottom", type=int, help="Verified navigation strip pixels; default actual InsetsSource/recorded height")
    measurement = commands.add_parser("measure", help="Verify installed APK, then measure; does not install or capture UI")
    measurement.add_argument("--apk", type=pathlib.Path, required=True)
    measurement.add_argument("--output", type=pathlib.Path, required=True)
    measurement.add_argument("--serial", default="emulator-5554")
    measurement.add_argument("--theme", choices=["light", "dark"], default="light")
    measurement.add_argument("--mode", choices=["clear", "tinted"], default="clear")
    measurement.add_argument("--screen", choices=["gallery", "today", "boundary"], default="gallery")
    measurement.add_argument("--offset", type=float, default=0)
    args = parser.parse_args()
    if args.command == "capture":
        Capture(args).run()
        return 0
    if args.command == "compare":
        return compare(args)
    measure(args)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (AssertionError, subprocess.SubprocessError, OSError, ValueError) as error:
        print(f"Android glass proof failed: {error}", file=sys.stderr)
        sys.exit(1)
