"""Measures a rendered link-preview loop. render.mjs runs it after the encode:

    python3 check.py <frames-folder> <loop.mp4> <poster.jpg> <key-frames> <fps>

The frames folder is the render's temporary folder: lossless key frames as source-NNN.png, and
seam.png, the frame one loop after the first. It prints one JSON report of measurements, not
taste: decoded key frames against the lossless render, the seam between the last frame and the
first, and banding by Netflix's CAMBI from the local libvmaf on the decoded loop and the poster.
Below about 1, CAMBI banding is not visible.
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image


def psnr(a, b):
    error = np.mean((a.astype(np.float64) - b.astype(np.float64)) ** 2)

    return float("inf") if error == 0 else round(float(10 * np.log10(255**2 / error)), 2)


def compare_decoded(folder, video, keys):
    """Decodes the key frames from the encode and compares them with the lossless key frames."""
    results = []

    for frame in keys:
        decoded_path = folder / f"decoded-{frame:03d}.png"
        # Accurate rounding and full chroma interpolation keep the conversion itself unbiased.
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", f"select=eq(n\\,{frame}),scale=flags=accurate_rnd+full_chroma_int", "-vsync", "0", "-frames:v", "1", str(decoded_path)],
            check=True,
        )
        decoded = np.asarray(Image.open(decoded_path).convert("RGB"))
        source = np.asarray(Image.open(folder / f"source-{frame:03d}.png").convert("RGB"))

        if source.shape != decoded.shape:
            sys.exit(f"check: frame {frame} decodes at {decoded.shape}, its source is {source.shape}")

        results.append({"frame": frame, "psnr_db": psnr(source, decoded)})

    return results


def seam(folder):
    """The frame one loop after the first against the first: equal but for grain and dither."""
    first = np.asarray(Image.open(folder / "source-000.png").convert("RGB"))
    again = np.asarray(Image.open(folder / "seam.png").convert("RGB"))
    delta = np.abs(first.astype(np.int16) - again.astype(np.int16))

    return {"psnr_db": psnr(first, again), "max_channel_delta": int(delta.max()), "mean_abs_delta": round(float(delta.mean()), 3)}


def cambi(y4m):
    """CAMBI for every frame of a Y4M file."""
    with tempfile.TemporaryDirectory() as folder:
        report = Path(folder) / "cambi.json"
        subprocess.run(
            ["vmaf", "-r", str(y4m), "-d", str(y4m), "--feature", "cambi", "--no_prediction", "--json", "-o", str(report), "-q", "--threads", "8"],
            capture_output=True,
            check=True,
        )

        return [frame["metrics"]["cambi"] for frame in json.loads(report.read_text())["frames"]]


def summary(values, fps, every):
    ordered = sorted(values)

    return {
        "frames": len(values),
        "mean": round(float(np.mean(values)), 3),
        "p95": round(float(ordered[int(0.95 * (len(ordered) - 1))]), 3),
        "max": round(float(max(values)), 3),
        "worst_at_seconds": round(int(np.argmax(values)) * every / fps, 3),
    }


def banding_of_video(path, fps, every=2):
    with tempfile.TemporaryDirectory() as folder:
        sampled = Path(folder) / "sampled.y4m"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(path), "-vf", f"select=not(mod(n\\,{every}))", "-vsync", "0", "-pix_fmt", "yuv420p", "-strict", "-1", "-f", "yuv4mpegpipe", str(sampled)],
            check=True,
        )

        return summary(cambi(sampled), fps, every)


def banding_of_image(path):
    """CAMBI for a still, converted at 10 bits so the measurement adds no steps of its own."""
    with tempfile.TemporaryDirectory() as folder:
        y4m = Path(folder) / "still.y4m"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(path), "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int", "-pix_fmt", "yuv420p10le", "-strict", "-1", "-f", "yuv4mpegpipe", str(y4m)],
            check=True,
        )

        return round(cambi(y4m)[0], 3)


def main():
    folder, video, poster = (Path(value) for value in sys.argv[1:4])
    keys = [int(value) for value in sys.argv[4].split(",")]
    fps = float(sys.argv[5])
    print(
        json.dumps(
            {
                "decoded": compare_decoded(folder, video, keys),
                "seam": seam(folder),
                "banding": {"loop": banding_of_video(video, fps), "poster": banding_of_image(poster)},
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
