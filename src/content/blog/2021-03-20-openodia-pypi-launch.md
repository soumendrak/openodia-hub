---
title: "OpenOdia Python Package Launched on PyPI"
date: 2021-03-20
author: "@openodia"
tags: [tools, python]
excerpt: "The openodia Python package brought practical Odia text processing tools to every developer — installable with a single pip command."
source_url: "https://pypi.org/project/openodia/"
---

## What happened

The `openodia` Python package was published on PyPI, making Odia language processing accessible to any Python developer. The initial release included transliteration (Roman ↔ Odia script), text normalization, and basic tokenization utilities.

## Why it matters

Before `openodia`, developers working with Odia text had to write their own utilities from scratch — handling Unicode, dealing with non-standard encodings, and building transliteration logic. The package standardized these operations, lowering the barrier to entry for Odia NLP development.

## Get started

```bash
uv add openodia
```

```python
from openodia import transliterator

# Roman to Odia script
odia_text = transliterator.to_odia("odia bhasha")
print(odia_text)  # → ଓଡ଼ିଆ ଭାଷା

# Odia to Roman
roman_text = transliterator.to_roman("ଓଡ଼ିଆ")
print(roman_text)  # → odia
```

## Links

- [openodia on PyPI](https://pypi.org/project/openodia/)
- [GitHub Repository](https://github.com/soumendrak/openodia)
