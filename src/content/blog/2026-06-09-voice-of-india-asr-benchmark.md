---
title: "Voice of India: A Large-Scale Speech Recognition Benchmark for Indic Languages"
date: 2026-06-09
author: "@openodia"
tags: [research, asr, dataset, speech]
excerpt: "A new benchmark covering 15 Indian languages including Odia — 536 hours of telephonic speech from 36,691 speakers across 139 regional clusters — aims to fix what's broken in Indic ASR evaluation."
source_url: "https://arxiv.org/abs/2604.19151"
---

## What happened

Researchers from academia and industry released **Voice of India**, a closed-source benchmark for real-world speech recognition across 15 major Indian languages — including **Odia**. The dataset contains 306,230 utterances totaling 536 hours of telephonic speech from 36,691 speakers across 139 regional clusters, with transcripts that account for natural spelling variations.

## Why it matters

Existing Indic ASR benchmarks suffer from three problems:

1. **Clean, scripted speech** — they don't reflect how people actually talk on the phone
2. **Dataset-specific overfitting** — leaderboard chasing encourages gaming metrics instead of building robust systems
3. **Single-reference WER** — penalizes valid spelling variations in Indian languages, especially code-mixed English-origin words

Voice of India addresses all three by using unscripted telephonic conversations with multi-reference transcripts. The benchmark also provides district-level geographic performance analysis, revealing disparities in ASR quality across regions.

## Key findings

- The paper analyzes performance across audio quality, speaking rate, gender, and device type
- District-level analysis reveals where current ASR systems struggle most
- Provides concrete insights for improving real-world Indic ASR systems

## Odia relevance

Odia is one of the 15 languages covered, with speakers from multiple regional clusters. For the Odia NLP/ASR community, this benchmark provides:

- A more realistic evaluation of Odia ASR performance
- Insights into where Odia ASR falls short compared to other Indic languages
- A standardized benchmark for tracking Odia speech recognition progress

## Paper details

**Title:** Voice of India: A Large-Scale Benchmark for Real-World Speech Recognition in India  
**Authors:** Kaushal Bhogale, Manas Dhir, Amritansh Walecha, Manmeet Kaur, Vanshika Chhabra, Aaditya Pareek, Hanuman Sidh, Mahima Manik, Sagar Jain, Bhaskar Singh, Utkarsh Singh, Tahir Javed, Shobhit Banga, Mitesh M. Khapra  
**Format:** 6 pages, 4 figures

## Links

- [Paper on arXiv](https://arxiv.org/abs/2604.19151)
- [PDF](https://arxiv.org/pdf/2604.19151)
