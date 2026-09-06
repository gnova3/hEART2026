# hEART 2026 Paper Explorer

An interactive guide to the 232 papers in the hEART 2026 programme. Conference attendees can search titles, abstracts, authors, and author keywords; inspect a similarity landscape; compare research lines and trends; browse the daily programme; and save a personal shortlist in their browser.

## Live site

[gnova3.github.io/hEART2026](https://gnova3.github.io/hEART2026/)

## Data

The catalogue is built from the public EasyChair programme pages for 29 September–1 October 2026 and the public author-keyword index. Each record contains its title, authors, presenter, abstract, keywords, format, session, date, time, room, and original programme link.

The similarity map uses a deterministic TF–IDF projection of titles, abstracts, and keywords. The browser search ranks title and phrase matches first, followed by keyword, author, and abstract matches.

## Development

```bash
npm install
npm run dev
```

Create the production site with `npm run build`. The static output is written to `dist/client`.

## Refreshing the programme data

Download the three daily programme pages and `talk_keyword_index.html`, then run:

```bash
python3 scripts/build_paper_data.py \
  /tmp/heart29.html /tmp/heart30.html /tmp/heart01.html \
  --keywords /tmp/heart_keywords.html
```

The generated catalogue is saved to `public/data/papers.json`.

## Design

The visual system uses the CityAI Lab colour palette: teal and cyan as the primary research colours, with restrained yellow, orange, and coral accents.

## License

MIT
