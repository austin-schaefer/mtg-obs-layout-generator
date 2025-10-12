#!/usr/bin/env python3
"""
OBS Layout Image Processor

Processes Magic: The Gathering card images into OBS streaming layouts.
"""

import os
import subprocess
import sys
import time
import shutil
from pathlib import Path
from urllib.request import urlretrieve
from contextlib import contextmanager
from dataclasses import dataclass


# Image processing constants
class ImageConfig:
    """Configuration constants for image processing."""
    # Art resize constraints
    MAX_ART_WIDTH = 1142
    MAX_ART_HEIGHT = 920

    # Card overlay position on background
    CARD_OFFSET = '+210+195'

    # Art centering calculations
    ART_H_BASE = 1000
    ART_H_RANGE = 1494
    ART_V_BASE = 70
    ART_V_RANGE = 940

    # Transparency hole coordinates
    TRANSPARENCY_RECT_1 = '1010,858 1489,1337'
    TRANSPARENCY_RECT_2 = '2008,858 2487,1337'

    # Grid resize constraints
    MAX_GRID_WIDTH = 2500
    MAX_GRID_HEIGHT = 1400

    # Scryfall API rate limit (seconds)
    API_DELAY = 0.11


# ANSI color codes
class Color:
    BLUE = '\033[34m'      # Standard blue
    GREEN = '\033[32m'     # Standard green
    YELLOW = '\033[33m'    # Standard yellow
    RED = '\033[31m'       # Standard red
    MAGENTA = '\033[35m'   # Standard magenta
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'


@dataclass
class Dimensions:
    """Image dimensions."""
    width: int
    height: int


@contextmanager
def working_directory(path: Path):
    """Context manager for temporarily changing working directory."""
    original = Path.cwd()
    try:
        os.chdir(path)
        yield
    finally:
        os.chdir(original)


def run(cmd: list[str], capture: bool = False) -> subprocess.CompletedProcess:
    """Run a command, optionally capturing output."""
    return subprocess.run(cmd, check=True, capture_output=capture, text=True)


def get_scryfall_urls(query: str, image_type: str) -> list[str]:
    """Get image URLs from Scryfall via the scry tool."""
    result = run(['python3', 'scry', query, f'--print=%{{image_uris.{image_type}}}'], capture=True)
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def download_images(urls: list[str], output_dir: Path, label: str):
    """Download images with rate limiting."""
    print(f"{Color.BLUE}Downloading {len(urls)} {label} images...{Color.RESET}")

    for i, url in enumerate(urls, 1):
        time.sleep(ImageConfig.API_DELAY)  # Scryfall API rate limiting
        filename = f"{i:05d}.png"
        urlretrieve(url, output_dir / filename)
        print(f"{Color.DIM}  {i}/{len(urls)}: {filename}{Color.RESET}")

    print(f"{Color.GREEN}✓ Downloaded all {label} images{Color.RESET}\n")


def get_dimensions(image: Path) -> Dimensions:
    """Get image dimensions using ImageMagick."""
    result = run(['identify', '-ping', '-format', '%w %h', str(image)], capture=True)
    width, height = result.stdout.strip().split()
    return Dimensions(int(width), int(height))


def calculate_resize_geometry(dim: Dimensions, max_width: int, max_height: int) -> str | None:
    """
    Calculate ImageMagick resize geometry string.
    Returns None if no resize needed.
    """
    too_wide = dim.width > max_width
    too_tall = dim.height > max_height
    too_small = dim.width < max_width and dim.height < max_height

    if too_wide and too_tall:
        return f'{max_width}x{max_height}'
    elif too_wide:
        return str(max_width)
    elif too_tall:
        return f'x{max_height}'
    elif too_small:
        return f'{max_width}x{max_height}'

    return None


def resize_art_images(art_dir: Path):
    """Resize artwork to fit within configured constraints."""
    print(f"{Color.BLUE}Resizing art images...{Color.RESET}")

    temp_dir = art_dir.parent / 'images_resized_art'
    temp_dir.mkdir(exist_ok=True)

    for art_file in sorted(art_dir.glob('*.png')):
        output_file = temp_dir / art_file.name
        geometry = calculate_resize_geometry(
            get_dimensions(art_file),
            ImageConfig.MAX_ART_WIDTH,
            ImageConfig.MAX_ART_HEIGHT
        )

        if geometry:
            run(['convert', str(art_file), '-geometry', geometry, str(output_file)])
            print(f"{Color.DIM}  Resized {art_file.name}{Color.RESET}")
        else:
            shutil.copy2(art_file, output_file)
            print(f"{Color.DIM}  Copied {art_file.name} (no resize needed){Color.RESET}")

    shutil.rmtree(art_dir)
    temp_dir.rename(art_dir)
    print(f"{Color.GREEN}✓ Resized all art images{Color.RESET}\n")


def composite_image(foreground: Path, background: Path, output: Path, geometry: str):
    """Composite one image onto another at a specific position."""
    run(['magick', 'composite', '-geometry', geometry, str(foreground), str(background), str(output)])


def overlay_cards_on_backgrounds(card_dir: Path, export_dir: Path, background: Path):
    """Overlay card images onto marble backgrounds."""
    print(f"{Color.BLUE}Adding cards to backgrounds...{Color.RESET}")

    for card in sorted(card_dir.glob('*.png')):
        composite_image(card, background, export_dir / card.name, ImageConfig.CARD_OFFSET)
        print(f"{Color.DIM}  {card.name}{Color.RESET}")

    print(f"{Color.GREEN}✓ Added all cards to backgrounds{Color.RESET}\n")


def overlay_art_on_backgrounds(art_dir: Path, base_dir: Path, output_dir: Path):
    """Overlay artwork onto backgrounds with dynamic centering."""
    print(f"{Color.BLUE}Adding art to backgrounds...{Color.RESET}")

    for art in sorted(art_dir.glob('*.png')):
        dim = get_dimensions(art)

        # Calculate centering offsets
        h_offset = ImageConfig.ART_H_BASE + ((ImageConfig.ART_H_RANGE - dim.width) // 2)
        v_offset = ImageConfig.ART_V_BASE + ((ImageConfig.ART_V_RANGE - dim.height) // 2)

        composite_image(art, base_dir / art.name, output_dir / art.name, f'+{h_offset}+{v_offset}')
        print(f"{Color.DIM}  {art.name}{Color.RESET}")

    print(f"{Color.GREEN}✓ Added all art to backgrounds{Color.RESET}\n")


def add_frames_and_transparency(input_dir: Path, frame_dir: Path, final_dir: Path, frame_path: Path):
    """Add host frames and transparency holes."""
    # Add frames
    print(f"{Color.BLUE}Adding frames...{Color.RESET}")
    for image in sorted(input_dir.glob('*.png')):
        composite_image(frame_path, image, frame_dir / image.name, '+0+0')
        print(f"{Color.DIM}  {image.name}{Color.RESET}")
    print(f"{Color.GREEN}✓ Added all frames{Color.RESET}\n")

    # Punch transparency holes
    print(f"{Color.BLUE}Adding transparency...{Color.RESET}")
    for image in sorted(frame_dir.glob('*.png')):
        run([
            'convert', str(image),
            '(', '+clone', '-fill', 'white', '-colorize', '100',
            '-fill', 'black',
            '-draw', f'rectangle {ImageConfig.TRANSPARENCY_RECT_1}',
            '-draw', f'rectangle {ImageConfig.TRANSPARENCY_RECT_2}', ')',
            '-alpha', 'off', '-compose', 'copy_opacity', '-composite',
            str(final_dir / image.name)
        ])
        print(f"{Color.DIM}  {image.name}{Color.RESET}")
    print(f"{Color.GREEN}✓ Added all transparency{Color.RESET}\n")


def create_grid(card_dir: Path, grid_arrangement: str, title_background: Path, output: Path):
    """Create and composite the card grid."""
    print(f"{Color.BLUE}Creating grid...{Color.RESET}")

    # Create montage in card directory (montage only works well with relative paths)
    with working_directory(card_dir):
        card_files = sorted([f.name for f in card_dir.glob('*.png')])
        run(['montage', '-density', '200', '-tile', grid_arrangement,
             '-geometry', '+10+40', '-background', 'none', *card_files, 'grid.png'])

    grid_path = card_dir / 'grid.png'
    print(f"{Color.GREEN}✓ Created montage{Color.RESET}\n")

    # Resize grid if needed
    print(f"{Color.BLUE}Resizing grid...{Color.RESET}")
    dim = get_dimensions(grid_path)
    geometry = calculate_resize_geometry(dim, ImageConfig.MAX_GRID_WIDTH, ImageConfig.MAX_GRID_HEIGHT)

    if geometry:
        temp_grid = output.parent / 'grid_temp.png'
        run(['convert', str(grid_path), '-geometry', geometry, str(temp_grid)])
        grid_path = temp_grid

    # Composite onto title background (centered)
    run(['magick', 'composite', '-gravity', 'center', str(grid_path), str(title_background), str(output)])

    # Cleanup
    if (output.parent / 'grid_temp.png').exists():
        (output.parent / 'grid_temp.png').unlink()

    print(f"{Color.GREEN}✓ Final grid created{Color.RESET}\n")


def read_booster_urls() -> tuple[list[str], list[str]]:
    """Read booster URLs from files created by booster_builder.py."""
    base = Path.cwd()
    card_urls_file = base / 'booster_card_urls.txt'
    art_urls_file = base / 'booster_art_urls.txt'

    with open(card_urls_file) as f:
        card_urls = [line.strip() for line in f if line.strip()]

    with open(art_urls_file) as f:
        art_urls = [line.strip() for line in f if line.strip()]

    return card_urls, art_urls


@dataclass
class InputMode:
    """User input mode configuration."""
    mode: str  # "SCRY" or "BOOST"
    grid_arrangement: str
    card_urls: list[str] | None = None
    art_urls: list[str] | None = None
    query: str | None = None  # Only used in SCRY mode


def check_existing_files() -> bool:
    """
    Check for existing export files and directories.
    Returns True if user wants to continue, False if they want to exit.
    """
    base = Path.cwd()

    # Check for directories and files
    paths_to_check = [
        base / 'images_card',
        base / 'images_art',
        base / 'images_export',
        base / 'images_resized_art',
        base / 'images_export_w_art',
        base / 'images_export_w_art_and_frame',
        base / 'images_export_final',
        base / 'grid.png',
        base / 'grid_temp.png',
        base / 'booster_card_urls.txt',
        base / 'booster_art_urls.txt',
    ]

    existing = [p for p in paths_to_check if p.exists()]

    if not existing:
        return True

    # Found existing files - warn the user
    print(f"{Color.YELLOW}Warning: Found existing export files/directories:{Color.RESET}")
    for path in existing:
        path_str = f"{path.name}/" if path.is_dir() else path.name
        print(f"{Color.DIM}  {path_str}{Color.RESET}")

    print()
    response = input(f"{Color.BOLD}{Color.MAGENTA}> Continue anyway? (y/n): {Color.RESET}").strip().lower()

    if response == 'y':
        print()
        return True
    else:
        print(f"\n{Color.YELLOW}Exiting. Run './cleanup.py' to remove existing files.{Color.RESET}")
        return False


def get_user_input_mode() -> InputMode:
    """Get user input and determine processing mode."""
    input_type = input(
        f"{Color.BOLD}{Color.MAGENTA}> Input type? "
        f"Enter SCRYFALL for Scryfall search, or BOOSTER for booster pack: {Color.RESET}"
    ).strip().upper()

    # Handle BOOST/BOOSTER mode
    if input_type in ("BOOST", "BOOSTER"):
        set_code = input(f"{Color.BOLD}{Color.MAGENTA}> Enter set code: {Color.RESET}").strip().upper()
        print()

        # Call booster_builder.py to build the booster
        print(f"{Color.YELLOW}Building booster pack...{Color.RESET}\n")
        result = run(['python3', 'booster_builder.py', set_code], capture=True)

        # Parse output to get layout
        layout = None
        for line in result.stdout.splitlines():
            if line.startswith("LAYOUT:"):
                layout = line.split(":", 1)[1]
            else:
                print(line)  # Echo booster_builder output

        if not layout:
            raise ValueError("Could not determine grid layout from booster_builder.py")

        card_urls, art_urls = read_booster_urls()
        return InputMode(mode="BOOST", grid_arrangement=layout, card_urls=card_urls, art_urls=art_urls)

    # Handle SCRY/SCRYFALL mode
    elif input_type in ("SCRY", "SCRYFALL"):
        query = input(f"{Color.BOLD}{Color.MAGENTA}> Enter Scryfall search query: {Color.RESET}").strip()
        grid_arrangement = input(
            f"{Color.BOLD}{Color.MAGENTA}> Enter grid arrangement (e.g. 8x0, 9x0, etc.): {Color.RESET}"
        ).strip()
        print()
        return InputMode(mode="SCRY", grid_arrangement=grid_arrangement, query=query)

    # Unknown input type
    else:
        raise ValueError(f"Unknown input type '{input_type}'. Use SCRY/SCRYFALL or BOOST/BOOSTER.")


def main():
    """Main entry point."""
    try:
        # Check for existing files before starting
        if not check_existing_files():
            sys.exit(0)

        # Get user input and mode configuration
        mode = get_user_input_mode()

        # Setup paths
        base = Path.cwd()
        resources = base / 'resources'

        dirs = {
            'card': base / 'images_card',
            'art': base / 'images_art',
            'export': base / 'images_export',
            'export_w_art': base / 'images_export_w_art',
            'export_w_frame': base / 'images_export_w_art_and_frame',
            'final': base / 'images_export_final',
        }

        # Create directories
        for d in dirs.values():
            d.mkdir(exist_ok=True)

        # Fetch or use URLs based on mode
        if mode.mode == "SCRY":
            # SCRY mode: fetch from Scryfall
            card_urls = get_scryfall_urls(mode.query, 'png')
            print(f"{Color.GREEN}✓ Found {len(card_urls)} cards{Color.RESET}\n")

            art_urls = get_scryfall_urls(mode.query, 'art_crop')
            print(f"{Color.GREEN}✓ Found {len(art_urls)} artworks{Color.RESET}\n")
        else:
            # BOOST mode: use pre-fetched URLs
            card_urls = mode.card_urls
            art_urls = mode.art_urls

        download_images(card_urls, dirs['card'], 'card')
        download_images(art_urls, dirs['art'], 'art')

        # Process images
        resize_art_images(dirs['art'])
        overlay_cards_on_backgrounds(dirs['card'], dirs['export'], resources / 'marble-background.png')
        overlay_art_on_backgrounds(dirs['art'], dirs['export'], dirs['export_w_art'])
        add_frames_and_transparency(
            dirs['export_w_art'],
            dirs['export_w_frame'],
            dirs['final'],
            resources / 'host-frames-card-discussion.png'
        )

        # Cleanup temp directories
        for d in [dirs['export'], dirs['export_w_art'], dirs['export_w_frame']]:
            shutil.rmtree(d)
        print(f"{Color.GREEN}✓ Cleaned up temporary directories{Color.RESET}\n")

        # Copy title background with frame to final directory as first and last slides
        shutil.copy2(resources / 'title_background_w_frame.png', dirs['final'] / '00000.png')
        shutil.copy2(resources / 'title_background_w_frame.png', dirs['final'] / '99999.png')
        print(f"{Color.GREEN}✓ Added title background to final directory (first and last slides){Color.RESET}\n")

        # Create final grid
        create_grid(dirs['card'], mode.grid_arrangement, resources / 'title_background.png', base / 'grid.png')

        # Cleanup booster URL files if in BOOST mode
        if mode.mode == "BOOST":
            for f in [base / 'booster_card_urls.txt', base / 'booster_art_urls.txt']:
                if f.exists():
                    f.unlink()

        print(f"{Color.BOLD}{Color.GREEN}Finished! Check /images_export_final/ for output.{Color.RESET}")

    except KeyboardInterrupt:
        print(f"\n{Color.YELLOW}Interrupted by user{Color.RESET}")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"\n{Color.RED}ERROR: Command failed: {' '.join(e.cmd)}{Color.RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Color.RED}ERROR: {e}{Color.RESET}")
        sys.exit(1)


if __name__ == '__main__':
    main()
