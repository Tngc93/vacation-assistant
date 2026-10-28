# Place data (ODbL)

The `*.json` files in this folder are a **derivative database of OpenStreetMap
data**, © OpenStreetMap contributors, made available under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See <https://www.openstreetmap.org/copyright>.

- Produced by `npm run data:places` (`scripts/fetch-places.mts`) from the
  Overpass API, and refreshed monthly by `.github/workflows/refresh-places.yml`.
- If you use or share these files publicly, credit "© OpenStreetMap
  contributors". If you share an adapted version of this database, it must
  also be under the ODbL.
- Wikipedia language counts, must-see places and the cocktail bars OSM does not
  tag come from [Wikidata](https://www.wikidata.org) (CC0). Photo metadata comes from [Wikimedia Commons](https://commons.wikimedia.org);
  each photo keeps its own licence (only CC0, public domain, CC BY and CC BY-SA
  are stored) and author, which the app shows next to it.
- The rest of this repository is MIT-licensed; the ODbL applies to this data
  folder only.
