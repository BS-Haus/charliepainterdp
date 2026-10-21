# Charlie Painter — Director of Photography

Portfolio site for cinematographer Charlie Painter (narrative features, shorts and commercials).
Sister site to [Painter.Studio](https://github.com/BS-Haus/Painterstudio), his content studio.

Static HTML/CSS/JS, deployed on Vercel. No framework.

## Editing work

Films live in `content.json` (title, credits, Vimeo/YouTube id, stills). After editing, rebuild the page:

```bash
python3 build.py
```

This renders `template.html` + `content.json` into `public/index.html`.

- `public/media/stills/` — full-size frames (opened in the viewer); `public/media/thumbs/` — the same frames at 480px for the hover strips
- `public/media/reel-*.mp4` — muted narrative and commercial showreels that play up top
- Unlisted Vimeo films need their private hash in `video.hash`

## Local preview

```bash
npx serve public
```
