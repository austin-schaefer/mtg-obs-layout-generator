# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository is an OBS (Open Broadcaster Software) layout generator for Magic: The Gathering card displays. It automates the creation of card grids and custom backgrounds for streaming/broadcasting purposes.

## Core Architecture

The project consists of four main components:

1. **`scry` (Python executable)**: A Scryfall API client for fetching Magic: The Gathering card data
2. **`download_images.py`**: Main workflow script (Python implementation - recommended)
3. **`download_images.sh`**: Main workflow script (Bash implementation - legacy)
4. **`cleanup.sh`**: Utility script for removing generated files and temporary directories

### Image Processing Pipeline

The image processing pipeline (implemented in both Python and Bash) orchestrates the following workflow:

1. **Data Fetching**: Uses the `scry` tool to query Scryfall API for card images and artwork
2. **Image Download**: Downloads both card images and artwork crops with rate limiting (0.11s delays)
3. **Art Resizing**: Intelligently resizes artwork to fit within 1142x920 pixel constraints
4. **Background Composition**: Overlays cards onto marble backgrounds at specific coordinates (+210+195)
5. **Art Integration**: Centers artwork on backgrounds with dynamic positioning calculations
6. **Frame Overlay**: Applies host frame graphics for streaming layout
7. **Transparency Effects**: Punches transparency holes at specific coordinates for overlay effects
8. **Grid Generation**: Creates montage grids with customizable tile arrangements

### Resource Assets

The `resources/` directory contains:
- `marble-background.png`: Base background template (4.6MB)
- `host-frames-card-discussion.png`: Overlay frame graphics (174KB)
- `title_background.png` & `title_background_w_frame.png`: Title screen backgrounds (5.2MB & 5.6MB)

## Common Commands

### Running the Image Generation Pipeline
```bash
# Python version (recommended)
./download_images.py

# Or bash version
./download_images.sh
```
Both scripts will prompt for:
- Scryfall search query (e.g., "set:neo", "type:creature")
- Grid arrangement (e.g., "8x0", "9x0")

### Querying Card Data
```bash
python3 scry "search_query" --print="%{image_uris.png}"
python3 scry "search_query" --print="%{image_uris.art_crop}"
```

### Cleanup Generated Files
```bash
./cleanup.sh
```

## Dependencies

- **Python 3**: For the `scry` Scryfall client and `download_images.py` script
- **ImageMagick**: For image processing (`convert`, `magick composite`, `montage`, `identify`)
- **wget**: For downloading images
- **Bash/Zsh**: Shell environment (only required for bash version; bash script uses Zsh-specific syntax)

## Generated Directory Structure

The pipeline creates several temporary directories:
- `images_card/`: Downloaded card images
- `images_art/`: Downloaded and resized artwork
- `images_export/`: Cards composited with backgrounds
- `images_export_w_art/`: Backgrounds with artwork added
- `images_export_w_art_and_frame/`: With host frames applied
- `images_export_final/`: Final output with transparency effects

## Image Processing Parameters

- **Art resize constraints**: 1142x920 pixels maximum
- **Card overlay position**: +210+195 offset on background
- **Art centering**: Dynamic calculation based on image dimensions
- **Transparency holes**: Rectangles at coordinates (1010,858 1489,1337) and (2008,858 2487,1337)
- **Grid resize limits**: 2500x1400 pixels maximum for final output

## Development Guidelines

**CRITICAL: This codebase is precious to the repository owner. Follow these rules strictly:**

1. **Work in Small Increments**: Make small, focused changes. Avoid complex or sprawling modifications.
2. **Commit Often**: Create git commits frequently so changes can be rolled back if needed.
3. **Document Everything**: Update the README.md file with any changes you make so the owner can understand and use your work.

## Development Notes

- The `scry` executable is a self-contained Python application with embedded dependencies
- Rate limiting is implemented (0.11s delays) to respect Scryfall API guidelines
- Image processing uses precise coordinate positioning for streaming overlay compatibility
- The pipeline is designed for batch processing of card sets for streaming layouts

## Python vs Bash Implementation

The Python version (`download_images.py`) is the recommended implementation:
- **Object-oriented design**: Uses an `ImageProcessor` class for clean organization
- **Better error handling**: Comprehensive error checking and reporting
- **Cross-platform**: Works consistently across different operating systems
- **Maintainable**: Easier to extend and modify
- **Type hints**: Better code documentation and IDE support

The Bash version (`download_images.sh`) is preserved for:
- Backwards compatibility
- Reference implementation
- Users who prefer shell scripting