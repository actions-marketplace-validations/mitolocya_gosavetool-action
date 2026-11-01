# GoSaveTool Text & Subtitles Action

Text and subtitle tools for GitHub workflows from [GoSaveTool](https://www.gosavetool.com/). Count words and characters, check social media and SEO character limits, make URL slugs, change case, clean whitespace, and convert, shift or repair SRT and WebVTT subtitles.

Everything runs inside the runner. No API key, no network calls, no dependencies.

## Usage

```yaml
- uses: mitolocya/gosavetool-action@v1
  id: stats
  with:
    command: stats
    file: README.md

- run: echo "${{ steps.stats.outputs.words }} words, ${{ steps.stats.outputs.read-seconds }} s to read"
```

### Commands

| `command` | What it does | Extra inputs | Outputs |
|---|---|---|---|
| `stats` | Words, characters, lines, sentences, reading time | | `words`, `chars`, `read-seconds`, `json` |
| `limits` | Checks X, Instagram, TikTok, YouTube, LinkedIn, Pinterest, SEO title and meta description limits | `limits`, `fail-on-exceed` | `fits`, `chars`, `json` |
| `slug` | URL slug, with Turkish and accented letters (`Ölçü Birimi` → `olcu-birimi`) | `output-file` | `result` |
| `case` | `upper`, `lower`, `title`, `sentence`, `camel`, `snake`, `kebab` | `to`, `output-file` | `result` |
| `clean` | Removes trailing spaces, double spaces and extra blank lines | `output-file` | `result` |
| `convert-subtitles` | SRT ↔ WebVTT | `to` (`srt`/`vtt`), `output-file` | `result`, `cues` |
| `shift-subtitles` | Moves every cue earlier or later | `shift-ms`, `to`, `output-file` | `result`, `cues` |
| `repair-subtitles` | Fixes cue order, overlaps, end-before-start and empty cues | `min-duration`, `to`, `output-file` | `result`, `cues`, `fixed` |

Text comes from `text` or from `file` (a path in the workspace). Every command also sets `result` and `json`, and adds a short report to the job summary unless `summary: false`.

## Examples

Fail a pull request whose title is longer than an SEO title (60 characters):

```yaml
- uses: mitolocya/gosavetool-action@v1
  with:
    command: limits
    text: ${{ github.event.pull_request.title }}
    limits: seo-title
    fail-on-exceed: true
```

Convert every SRT file to WebVTT:

```yaml
- uses: mitolocya/gosavetool-action@v1
  with:
    command: convert-subtitles
    file: subtitles/episode-1.srt
    to: vtt
    output-file: subtitles/episode-1.vtt
```

Shift subtitles 1.5 seconds earlier:

```yaml
- uses: mitolocya/gosavetool-action@v1
  with:
    command: shift-subtitles
    file: movie.srt
    shift-ms: -1500
    output-file: movie.srt
```

Make a slug for a blog post:

```yaml
- uses: mitolocya/gosavetool-action@v1
  id: slug
  with:
    command: slug
    text: 'Çok Satan Ürünler: 2026 Rehberi'
- run: echo "${{ steps.slug.outputs.result }}"   # cok-satan-urunler-2026-rehberi
```

## Online tools

The same tools work in the browser, no sign-up:

- [Character counter](https://www.gosavetool.com/character-counter)
- [VTT subtitle generator](https://www.gosavetool.com/vtt-subtitle-generator)
- [All GoSaveTool tools](https://www.gosavetool.com/)

The code comes from the [GoSaveTool open source tools](https://github.com/mitolocya/gosavetool) (`@gosavetool/text` and `@gosavetool/subtitles`).

## License

MIT
