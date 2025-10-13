# OBS Magic: The Gathering Layout Generator

Creates OBS streaming layouts and card grids for Magic: The Gathering. Used by [Clock Spinning Podcast](https://www.youtube.com/@clockspinning).

## Quick Start

Run the script and choose a mode:

```bash
./download_images.py
```

Three modes available:
- **SCRY**: Fetch cards from Scryfall search query
- **BOOST**: Generate a random booster pack
- **CUSTOM**: Use your own images

### SCRY Mode

Fetch cards from Scryfall and create layouts.

```bash
./download_images.py
```

1. Choose `SCRYFALL` mode
2. Enter search query (e.g., `set:neo`, `type:creature cmc:3`)
3. Enter grid arrangement (e.g., `8x0`, `9x0`)

See [Scryfall syntax](https://scryfall.com/docs/syntax) for search queries.

**Example queries:**
- `set:neo` - Kamigawa: Neon Dynasty cards
- `type:creature cmc:3` - 3-mana creatures
- `c:red type:instant` - Red instants
- `rarity:mythic` - Mythic rares

### BOOST Mode

Generate a random booster pack for any set.

```bash
./download_images.py
```

1. Choose `BOOSTER` mode
2. Enter set code (e.g., `NEO`, `ONS`, `TSP`)

The script handles set-specific booster structures automatically:
- Historical sets (Arabian Nights, The Dark, etc.)
- Pre-mythic era (11/3/1 structure)
- Modern sets (mythic rarity, 1/8 chance)
- Special cards (Time Spiral timeshifted)

Grid arrangement is determined automatically.

### CUSTOM Mode

Use your own images instead of MTG cards.

```bash
./download_images.py
```

1. Choose `CUSTOM` mode
2. Enter grid arrangement (e.g., `8x0`, `9x0`)

**Image requirements:**

Create a `/custom/` directory with paired images:
- Each pair needs a vertical (portrait) and horizontal (landscape) image
- Naming format: `{number}v.{ext}` and `{number}h.{ext}`
- Supported formats: `png`, `jpg`, `jpeg`, `gif`

**Example:**
```
custom/
  1v.png    # First vertical image
  1h.jpg    # First horizontal image
  2v.png    # Second vertical image
  2h.gif    # Second horizontal image
  3v.jpg    # Third vertical image
  3h.png    # Third horizontal image
```

Both images in each pair are required. Numbers can be non-sequential but must match.

## Output

All modes produce:
- **Individual layouts**: `images_export_final/` - Each image on marble background with frame and transparency
- **Card grid**: `grid.png` - Montage of all images on title background

## Hero Image (Optional)

Add a custom image to first and last title slides:

1. Add `hero.jpg`, `hero.png`, `hero.jpeg`, or `hero.gif` to `/resources/`
2. Answer `y` when prompted for hero image

The hero image is resized (max 850×1250px) and centered on title slides.

## Grid Arrangements

Format: `{width}x{height}`

Examples:
- `8x0` - 8 wide, auto height
- `9x0` - 9 wide, auto height
- `4x4` - 4×4 grid (16 images)
- `5x3` - 5 wide, 3 tall (15 images)

Use `0` for auto-calculated dimension.

## Cleanup

Remove generated files:

```bash
./cleanup.py
```

## Requirements

- Python 3
- ImageMagick: `brew install imagemagick`
- wget: `brew install wget`

## Standalone Booster Builder

View booster composition without generating images:

```bash
./booster_builder.py
```

Enter a set code to see card composition and rarity breakdown.

## File Structure

```
obs-layouts/
├── booster_builder.py          # Booster composition tool
├── cleanup.py                  # Cleanup utility
├── download_images.py          # Main script
├── scry                        # Scryfall API client
├── resources/                  # Background assets
└── legacy_bash_scripts/        # Original bash implementations
```

The Python scripts replaced brittle bash implementations. Bash versions preserved in `legacy_bash_scripts/` for reference.

## Troubleshooting

**"Command not found"**: Install missing dependencies (ImageMagick, wget, Python 3)

**Custom directory validation errors**: Ensure all numbered pairs have both `v` and `h` images with matching numbers

## License

Code: MIT License (Copyright 2025 Austin Schaefer). See [LICENSE](LICENSE).

Assets in `/resources/`: All rights reserved. May not be copied, modified, or distributed without permission.

Bundles [scrycall](https://github.com/0xdanelia/scrycall) (MIT licensed) for convenience.
