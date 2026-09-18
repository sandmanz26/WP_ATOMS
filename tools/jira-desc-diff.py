#!/usr/bin/env python3
"""Show what actually changed in a Jira ticket's description.

Why this exists: the Leave tickets are edited constantly, and most edits are
Jira reflowing its own table markup — column widths, a wiki table becoming an
embedded ADF one. Reading the raw `fromString`/`toString` pair drowns a
one-word rule change in hundreds of lines of noise. This normalises both sides
to a list of table *cells* first, so a formatting-only edit prints nothing and
a real edit prints exactly the sentence that moved.

Usage:
    python3 tools/jira-desc-diff.py <tool-result.json> <since-YYYY-MM-DD>

The input is the JSON a `getJiraIssue` call with `expand: changelog` writes to
disk when its output is too large to return inline — i.e.
`{"issues": {"nodes": [{"key": ..., "changelog": {"histories": [...]}}]}}`.

Each description edit at or after `since` prints as its own block, with the
timestamp and author, so several edits on one day stay separable. Nothing
printed under a block means that edit was formatting only.
"""

import difflib
import json
import sys


def adf_text(node, out):
    """Flatten an embedded ADF fragment, marking cell and block boundaries."""
    if isinstance(node, dict):
        if node.get('type') == 'text':
            out.append(node.get('text', ''))
        for child in node.get('content', []) or []:
            adf_text(child, out)
        if node.get('type') in ('tableRow', 'paragraph', 'tableCell', 'tableHeader'):
            out.append(' | ')
    elif isinstance(node, list):
        for child in node:
            adf_text(child, out)


def cells(body):
    """Split a description into comparable units: one per line, or per table cell.

    Splitting ADF tables down to individual cells is the point. Comparing whole
    tables makes any edit inside one look like the entire table was replaced.
    """
    out = []
    for line in body.split('\n'):
        line = line.strip()
        if not line:
            continue
        if line.startswith('{"type":'):
            try:
                flat = []
                adf_text(json.loads(line), flat)
                out += [c.strip() for c in ''.join(flat).split('|') if c.strip()]
                continue
            except Exception:
                # Not valid ADF after all — fall through and treat it as text.
                pass
        out.append(line)
    return out


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    path, since = sys.argv[1], sys.argv[2]
    with open(path) as fh:
        node = json.load(fh)['issues']['nodes'][0]

    print('###', node['key'], node.get('fields', {}).get('summary', ''))

    found = False
    for history in sorted(node['changelog']['histories'], key=lambda h: h['created']):
        if history['created'][:10] < since:
            continue
        for item in history['items']:
            if item.get('field') != 'description':
                continue
            before = cells(item.get('fromString') or '')
            after = cells(item.get('toString') or '')
            lines = [
                line for line in difflib.unified_diff(before, after, lineterm='', n=0)
                if line.startswith(('+', '-'))
                and not line.startswith(('---', '+++'))
                and line[1:].strip()
            ]
            found = True
            author = history.get('author', {}).get('displayName', 'unknown')
            print(f"\n--- edit at {history['created']} by {author} ({len(lines)} lines)")
            if not lines:
                print('    (formatting only)')
            for line in lines:
                print('  ', line[:500])

    if not found:
        print('\n(no description edits since', since + ')')
    return 0


if __name__ == '__main__':
    sys.exit(main())
