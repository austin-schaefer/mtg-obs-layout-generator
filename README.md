# OBS Magic: The Gathering Layout Generator

An automated tool for creating custom OBS layouts and card grids for Magic: The Gathering streaming and content creation.

## Quick Start

1. **Generate card layouts:**
   ```bash
   ./download_images.sh
   ```

2. **Enter your search query** (e.g., `set:neo`, `type:creature`, `cmc:3`)

3. **Choose grid arrangement** (e.g., `8x0`, `9x0`, `10x0`)

4. **Find your files:**
   - Individual card layouts: `images_export_final/`
   - Card grid: `grid.png`

5. **Clean up when done:**
   ```bash
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

- Python 3
- ImageMagick (`brew install imagemagick` on macOS)
- wget (`brew install wget` on macOS)
- Bash/Zsh shell

## File Structure

```
obs-layouts/
├── download_images.sh     # Main workflow script
├── cleanup.sh            # Cleanup utility
├── scry                  # Scryfall API client
├── resources/            # Background assets
└── [generated dirs]      # Created during processing
```

## Troubleshooting

**"Command not found" errors**: Install missing dependencies (ImageMagick, wget, Python 3)

**Rate limiting**: The tool includes automatic delays to respect Scryfall's API limits

**Large file sizes**: Generated images are high-resolution for streaming quality

---

*This tool uses the [Scryfall API](https://scryfall.com/docs/api) to fetch Magic: The Gathering card data.*