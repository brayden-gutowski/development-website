# Prepared Tokyo flight assets

Country view: NASA Blue Marble / GIBS, natural-color Next Generation imagery.
https://nasa-gibs.github.io/gibs-api-docs/access-basics/

Regional/city view: 地理院タイル / GSI seamlessphoto.
https://maps.gsi.go.jp/development/ichiran.html
Landsat data: GSI, TSIC, GEO Grid/AIST, USGS; seafloor: GEBCO.

Fifteen WebP atlases (zoom 4–18) are stitched locally by
`tools/prepare-flight-assets.cjs`. The script uses NASA through zoom 8,
then GSI. At zoom 9–13, the GSI elevation tile NoData value (128,0,0)
identifies sea around Japan and replaces differently exposed water photos
with one continuous dark ocean tone. Elevation data contains no map labels:
https://maps.gsi.go.jp/development/demtile.html
These are modified imagery assets, not live or current satellite views.

`manifest.json` preserves each atlas's tile origin, grid and zoom so it maps
onto the existing globe without changing the camera route. All imagery
credits remain visible during the flight and in the project drawer.

`cloud-volume.bin.gz` contains the existing procedural cloud density,
baked light, and ground shadow (128³ RG8 plus 128² RGBA8). It is produced
once offline by tools/cloud-volume.mjs. The runtime only decompresses and
uploads it; it does not rebuild the noise on the browser's main thread.
