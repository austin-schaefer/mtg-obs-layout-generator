# OBS Magic: The Gathering Layout Generator

An automated tool for creating custom OBS layouts and card grids for Magic: The Gathering streaming and content creation. Used to create slideshows for the [Clock Spinning Podcast](https://www.youtube.com/@clockspinning).

## Quick start

### Option 1: Build from Scryfall search query

1. **Generate card layouts:**
   ```bash
   ./download_images.py
   ```

2. **Choose SCRY mode** and enter your search query (e.g., `set:neo`, `type:creature`, `cmc:3`)

3. **Choose grid arrangement** (e.g., `8x0`, `9x0`, `10x0`)

4. **Find your files:**
   - Individual card layouts: `images_export_final/`
   - Card grid: `grid.png`

### Option 2: Build a random booster pack

1. **Generate booster pack layouts:**
   ```bash
   ./download_images.py
   ```

2. **Choose BOOST mode** and enter a set code (e.g., `NEO`, `ONS`, `TSP`)

3. The script will:
   - Automatically build a randomized booster pack for that set
   - Handle set-specific booster structures (including mythics, timeshifted cards, etc.)
   - Generate layouts in booster order (commons → uncommons → rares → mythics)
   - Automatically determine the correct grid arrangement

4. **Find your files:**
   - Individual card layouts: `images_export_final/`
   - Booster pack grid: `grid.png`

### Cleanup

```bash
# Python version (recommended)
./cleanup.py
```

## What this tool creates

- **Individual card layouts**: Each card composited with artwork on a marble background, ready for OBS overlay
- **Card grids**: Montage arrangements of multiple cards for deck discussions or set overviews
- **Streaming-ready graphics**: Pre-positioned transparency holes for webcam/chat overlays

## Search query examples

- `set:neo` - All cards from Kamigawa: Neon Dynasty
- `type:creature cmc:3` - All 3-mana creatures
- `commander:legal` - All Commander-legal cards
- `c:red type:instant` - All red instant spells
- `rarity:mythic` - All mythic rare cards

See [Scryfall syntax guide](https://scryfall.com/docs/syntax) for advanced queries.

## Grid arrangements

- `8x0` - 8 cards wide, auto height
- `9x0` - 9 cards wide, auto height
- `4x4` - 4x4 grid (16 cards)
- `5x3` - 5 wide, 3 tall (15 cards)

## Requirements

- Python 3 (required)
- ImageMagick (`brew install imagemagick` on macOS)
- wget (`brew install wget` on macOS)
- Bash/Zsh shell (only required for bash version)

## Booster pack builder

You can also use it standalone to see booster composition:

```bash
./booster_builder.py
```

Enter a set code and it will build a randomized booster pack with the correct structure for that set, handling:

- Historical sets with unique structures (Arabian Nights, The Dark, etc.)
- Pre-mythic era sets (11/3/1 structure)
- Modern sets with mythic rarity (1/8 chance)
- Special cards (Time Spiral timeshifted sheet)
- Proper card ordering (commons first, then uncommons, rares, mythics)

## File structure

```
obs-layouts/
├── booster_builder.py          # Booster composition tool
├── cleanup.py                  # Cleanup utility
├── download_images.py          # Main workflow script
├── scry                        # Scryfall API client
├── resources/                  # Background assets
├── [generated dirs]            # Created during processing
└─┬ legacy_bash_scripts/        # Bash scripts that the Python ones are based on
  ├── booster-builder-bash.sh   # Booster composition tool (Bash)
  ├── cleanup.sh                # Cleanup utility (Bash)
  └── download_images.sh        # Main workflow script (Bash)   
```

The scripts were originally human-written in Bash; the Python versions are Claude Code because Bash was getting brittle A.F.

## Troubleshooting

**"Command not found" errors**: Install missing dependencies (ImageMagick, wget, Python 3)

## Licensing

This repository's code is MIT-licensed (copyright 2025 Austin Schaefer). See [LICENSE](LICENSE) for full text.

**Exception**: All images and assets in the `/resources/` directory are all rights reserved and may not be copied, modified, or distributed without permission.

This repository bundles the [scrycall](https://github.com/0xdanelia/scrycall) utility as a binary for convenience. Scrycall is MIT-licensed. 