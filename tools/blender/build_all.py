"""
build_all.py — runs every asset script in order, headless, via the current
Blender python interpreter. Invoke this FROM Blender:

    xvfb-run -a blender -b --python tools/blender/build_all.py

(each mk_*.py script also runs standalone the same way — this just chains
them so a full library rebuild is one command). See build.sh for the wrapper
that also handles the Xvfb requirement.
"""
import sys
import os
import importlib
import traceback

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Order matters only for a readable log — every script fully resets the
# scene itself, so failures are isolated per-asset.
SCRIPTS = [
    "mk_fuse_core",
    "mk_breaker_panel",
    "mk_valve_wheel",
    "mk_handheld_lamp",
    "mk_hands",
    "mk_surveyor",
]


def main():
    results = {}
    for name in SCRIPTS:
        print(f"\n{'=' * 70}\nBUILDING {name}\n{'=' * 70}")
        try:
            mod = importlib.import_module(name)
            tris = mod.build()
            results[name] = ("OK", tris)
        except Exception as e:
            traceback.print_exc()
            results[name] = ("FAILED", str(e))

    print(f"\n{'=' * 70}\nSUMMARY\n{'=' * 70}")
    for name, (status, info) in results.items():
        print(f"  {name:20s} {status:8s} {info}")


if __name__ == "__main__":
    main()
