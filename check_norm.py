import os
import unicodedata

root = "public/juben"
for d in os.listdir(root):
    if "BWG" in d:
        print(f"Name: {d}")
        print(f"Is NFC: {unicodedata.is_normalized('NFC', d)}")
        print(f"Is NFD: {unicodedata.is_normalized('NFD', d)}")
        print(f"Hex: {d.encode('utf-8').hex()}")
