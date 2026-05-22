---
title: "OdiaGenAI Releases Llama-3 Fine-Tuned for Odia Language"
date: 2025-06-10
author: "@openodia"
tags: [models, llm, research]
excerpt: "The first publicly available large language model fine-tuned specifically for Odia language generation and understanding was released on Hugging Face."
source_url: "https://huggingface.co/shantipriyap/Llama3_Odia"
---

## What happened

OdiaGenAI and community contributors released `Llama3_Odia` — a fine-tuned version of Meta's Llama 3 specifically adapted for the Odia language. This marked the first time a major open-source LLM was optimized for Odia text generation and comprehension.

## Why it matters

Large language models are the backbone of modern AI applications — chatbots, content generation, summarization, translation. Having an Odia-specific LLM means developers can build applications that truly understand and produce natural Odia text, rather than relying on English-centric models that treat Odia as an afterthought.

## How to use

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("shantipriyap/Llama3_Odia")
tokenizer = AutoTokenizer.from_pretrained("shantipriyap/Llama3_Odia")

inputs = tokenizer("ଓଡ଼ିଆ ଭାଷା ହେଉଛି", return_tensors="pt")
outputs = model.generate(**inputs, max_length=100)
print(tokenizer.decode(outputs[0]))
```

## Links

- [Llama3_Odia on Hugging Face](https://huggingface.co/shantipriyap/Llama3_Odia)
- [OdiaGenAI on GitHub](https://github.com/OdiaGenAI)
