# OBS Magic: The Gathering Layout Generator

An automated tool for creating custom OBS layouts and card grids for Magic: The Gathering streaming and content creation.

## Quick Start

### Option 1: Build from Scryfall Search Query

1. **Generate card layouts:**
   ```bash
   ./download_images.py
   ```

2. **Choose SCRY mode** and enter your search query (e.g., `set:neo`, `type:creature`, `cmc:3`)

3. **Choose grid arrangement** (e.g., `8x0`, `9x0`, `10x0`)

4. **Find your files:**
   - Individual card layouts: `images_export_final/`
   - Card grid: `grid.png`

### Option 2: Build a Random Booster Pack

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

# Or bash version
./cleanup.sh
```

## What This Tool Creates

- **Individual Card Layouts**: Each card composited with artwork on a marble background, ready for OBS overlay
- **Card Grids**: Montage arrangements of multiple cards for deck discussions or set overviews
- **Streaming-Ready Graphics**: Pre-positioned transparency holes for webcam/chat overlays

## Search Query Examples

- `set:neo` - All cards from Kamigawa: Neon Dynasty
- `type:creature cmc:3` - All 3-mana creatures
- `commander:legal` - All Commander-legal cards
- `c:red type:instant` - All red instant spells
- `rarity:mythic` - All mythic rare cards

See [Scryfall syntax guide](https://scryfall.com/docs/syntax) for advanced queries.

## Grid Arrangements

- `8x0` - 8 cards wide, auto height
- `9x0` - 9 cards wide, auto height
- `4x4` - 4x4 grid (16 cards)
- `5x3` - 5 wide, 3 tall (15 cards)

## Requirements

- Python 3 (required)
- ImageMagick (`brew install imagemagick` on macOS)
- wget (`brew install wget` on macOS)
- Bash/Zsh shell (only required for bash version)

## Booster Pack Builder

The booster builder is now integrated into `download_images.py` - just choose **BOOST** mode when prompted!

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

## File Structure

```
obs-layouts/
├── download_images.py        # Main workflow script (Python)
├── download_images.sh        # Main workflow script (Bash)
├── booster_builder.py        # Booster composition tool (Python)
├── booster-builder-bash.sh   # Booster composition tool (Bash)
├── cleanup.sh                # Cleanup utility
├── scry                      # Scryfall API client
├── resources/                # Background assets
└── [generated dirs]          # Created during processing
```

## Implementation Notes

**Python vs Bash**: The Python version (`download_images.py`) is the recommended implementation. It offers:
- Better error handling and logging
- Cross-platform compatibility
- More maintainable code structure
- Object-oriented design for easier extension

The bash version (`download_images.sh`) is preserved for reference and compatibility.

## Troubleshooting

**"Command not found" errors**: Install missing dependencies (ImageMagick, wget, Python 3)

**Rate limiting**: The tool includes automatic delays to respect Scryfall's API limits

**Large file sizes**: Generated images are high-resolution for streaming quality

---

*This tool uses the [Scryfall API](https://scryfall.com/docs/api) to fetch Magic: The Gathering card data.*