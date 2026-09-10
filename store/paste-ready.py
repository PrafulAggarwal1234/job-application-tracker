#!/usr/bin/env python3
"""Render store/listing.md into store/paste-ready.txt.

listing.md is hard-wrapped for reading in a repo; the Chrome Web Store fields
want single-line paragraphs. Edit listing.md, run this, paste from the output.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'store', 'listing.md')).read()


def section(start, end):
    return src[src.index(start) + len(start): src.index(end)].strip('\n')


def unwrap(block):
    """Join hard-wrapped prose into single lines, keeping bullets and blanks."""
    out, buf = [], []
    for line in block.split('\n'):
        s = line.rstrip()
        bullet = s.lstrip().startswith(('•', '-')) or (s.isupper() and s.strip())
        if not s.strip() or bullet:
            if buf:
                out.append(' '.join(buf))
                buf = []
            out.append(s.strip() if bullet else '')
            continue
        if out and out[-1].startswith('•') and s.startswith('  '):
            out[-1] += ' ' + s.strip()
            continue
        buf.append(s.strip())
    if buf:
        out.append(' '.join(buf))
    return '\n'.join(out).strip('\n')


detailed = unwrap(section('## Detailed description', '## Category'))
purpose = unwrap(section('## Single purpose (required by review)', '## Permission justifications'))
perms = unwrap(section('## Permission justifications (required by review)', '## Privacy')).replace('**', '')

OUT = f"""PASTE-READY STORE LISTING — Job Application Tracker
Generated from store/listing.md. Do not hand-edit; edit listing.md and re-run
  python3 store/paste-ready.py

================================================================
NAME (max 45)
================================================================
Job Application Tracker

================================================================
SHORT DESCRIPTION (max 132)
================================================================
Save any job posting with one click and track your applications. All data stays in your browser — nothing is ever uploaded.

================================================================
DETAILED DESCRIPTION
================================================================
{detailed}

================================================================
CATEGORY / LANGUAGE
================================================================
Productivity / English

================================================================
SUPPORT URL  (use this instead of an email — keeps your address off the listing)
================================================================
https://github.com/PrafulAggarwal1234/job-application-tracker/issues

================================================================
PRIVACY POLICY URL
================================================================
https://prafulaggarwal1234.github.io/job-application-tracker/

================================================================
SINGLE PURPOSE
================================================================
{purpose}

================================================================
PERMISSION JUSTIFICATIONS
================================================================
{perms}

================================================================
DATA USE DISCLOSURES
================================================================
Check NOTHING in every category. Then tick all three certification boxes.
Remote code: No.
"""

path = os.path.join(ROOT, 'store', 'paste-ready.txt')
open(path, 'w').write(OUT)
print(f'wrote {os.path.relpath(path, ROOT)}')
