"""Independent integer oracle. Run Python to regenerate reference-vectors.json.
xoshiro128** 1.1 and SplitMix64: Blackman/Vigna, https://prng.di.unimi.it/
FNV-1a: RFC 9923. This oracle uses arbitrary-precision integers, not JS shifts.
"""
import json
from pathlib import Path

M32, M64 = (1 << 32) - 1, (1 << 64) - 1

def rot(x, k):
    return ((x << k) | (x >> (32 - k))) & M32

def sequence(words, count):
    s = list(words)
    values = []
    for _ in range(count):
        values.append((rot((s[1] * 5) & M32, 7) * 9) & M32)
        t = (s[1] << 9) & M32
        s[2] ^= s[0]
        s[3] ^= s[1]
        s[1] ^= s[2]
        s[0] ^= s[3]
        s[2] ^= t
        s[3] = rot(s[3], 11)
    return dict(initial=words, values=values, final=s)

def derive(seed, owner, purpose):
    key = json.dumps(["env-v1", seed, owner, purpose], ensure_ascii=False, separators=(",", ":"))
    h = 14695981039346656037
    for byte in key.encode("utf-8"):
        h = ((h ^ byte) * 1099511628211) & M64
    words = []
    for _ in range(2):
        h = (h + 0x9e3779b97f4a7c15) & M64
        z = h
        z = ((z ^ (z >> 30)) * 0xbf58476d1ce4e5b9) & M64
        z = ((z ^ (z >> 27)) * 0x94d049bb133111eb) & M64
        z ^= z >> 31
        words.extend([z & M32, z >> 32])
    return dict(seed=seed, systemId=owner, purpose=purpose, **sequence(words, 8))

vectors = dict(raw=[sequence([1, 2, 3, 4], 12), sequence([M32, 2147483648, 7, M32], 12)],
               derived=[derive("0123456789abcdef", "alpha", "sample"),
                        derive("0000000000000000", "beta", "accuracy"),
                        derive("ffffffffffffffff", "sensor-ñ", "visión-🤖")])
Path(__file__).with_name("reference-vectors.json").write_text(json.dumps(vectors, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
