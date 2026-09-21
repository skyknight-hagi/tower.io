#!/usr/bin/env python3
"""Dreamy slow Japanese indie-pop night loop (Moonlit Window mood)."""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SR = 44100
BPM = 72
BEAT = 60.0 / BPM
BARS = 16
BEATS_PER_BAR = 4
DUR = BARS * BEATS_PER_BAR * BEAT
N = int(SR * DUR)

# D yo-ish / natural minor palette
D3, F3, G3, A3, C4 = 146.83, 174.61, 196.00, 220.00, 261.63
D4, E4, F4, G4, A4, C5, D5 = 293.66, 329.63, 349.23, 392.00, 440.00, 523.25, 587.33
Bb3, C3 = 233.08, 130.81

# i  VI  III VII
CHORDS = [
    (D3, F3, A3, D4),
    (Bb3 / 2, Bb3, D4, F4),
    (F3, A3, C4, F4),
    (C3, G3, C4, E4),
]


def clamp(x: float) -> float:
    return -1.0 if x < -1 else 1.0 if x > 1 else x


def env(i: int, a: int, d: int, total: int) -> float:
    if i < a:
        return i / max(1, a)
    if i > total - d:
        return max(0.0, (total - i) / max(1, d))
    return 1.0


def sine(t: float, f: float, ph: float = 0.0) -> float:
    return math.sin(2 * math.pi * f * t + ph)


L = [0.0] * N
R = [0.0] * N

# pad + bass
bar_len = int(BEAT * 4 * SR)
for bar in range(BARS):
    chord = CHORDS[bar % 4]
    start = bar * bar_len
    for i in range(bar_len):
        if start + i >= N:
            break
        t = (start + i) / SR
        e = env(i, int(0.12 * SR), int(0.35 * SR), bar_len)
        pad = 0.0
        for k, f in enumerate(chord):
            det = 1 + (0.003 if k % 2 == 0 else -0.003)
            pad += sine(t, f * det, k) * 0.16
            pad += sine(t, f * 2 * det, k + 0.4) * 0.05
        bass = sine(t, chord[0] * 0.5, 0.2) * 0.22 * e
        v = (pad * e + bass)
        L[start + i] += v * 0.92
        R[start + i] += v * 1.08

# melody
melody = [
    D4, E4, G4, A4, G4, E4, D4, None,
    A4, C5, A4, G4, E4, G4, D4, None,
    F4, G4, A4, D5, C5, A4, G4, E4,
    D4, E4, F4, E4, D4, C4, D4, None,
]
step = int(BEAT * SR)
for idx, note in enumerate(melody * (BARS // 4)):
    if note is None:
        continue
    start = idx * step
    length = int(BEAT * 0.9 * SR)
    for i in range(length):
        p = start + i
        if p >= N:
            break
        t = p / SR
        e = env(i, int(0.02 * SR), int(0.22 * SR), length)
        pluck = sine(t, note, 0) * 0.18 + sine(t, note * 2.01, 0.3) * 0.05
        L[p] += pluck * e * 1.05
        R[p] += pluck * e * 0.9

# soft pulse on beats 1 and 3
for b in range(int(DUR / BEAT)):
    start = int(b * BEAT * SR)
    if b % 2 != 0:
        continue
    for i in range(int(0.12 * SR)):
        p = start + i
        if p >= N:
            break
        t = i / SR
        e = math.exp(-t * 18)
        kick = math.sin(2 * math.pi * (62 * math.exp(-t * 8)) * t) * 0.18 * e
        L[p] += kick
        R[p] += kick

# night air
for i in range(N):
    t = i / SR
    air = (math.sin(2 * math.pi * 0.12 * t) * 0.02 + ((i * 1103515245 + 12345) % 32768) / 32768 * 0.012 - 0.006)
    fade = 1.0
    if i < SR:
        fade = i / SR
    if i > N - SR:
        fade = (N - i) / SR
    L[i] = clamp((L[i] + air) * 0.72 * fade)
    R[i] = clamp((R[i] + air * 0.85) * 0.72 * fade)

out = Path("/workspace/public/audio/moonlit-window.wav")
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "w") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for i in range(N):
        frames += struct.pack("<hh", int(L[i] * 32000), int(R[i] * 32000))
    w.writeframes(frames)
print("wrote", out, "seconds", round(DUR, 2))
