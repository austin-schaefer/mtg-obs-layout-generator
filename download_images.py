#!/usr/bin/env python3
"""
OBS Layout Image Processor

Processes Magic: The Gathering card images into OBS streaming layouts.
"""

import subprocess
import sys
import time
import shutil
from pathlib import Path
from urllib.request import urlretrieve
from contextlib import contextmanager
from dataclasses import dataclass


# ANSI color codes
class Color:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
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
        import os
        os.chdir(path)
        yield
    finally:
        import os
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
        time.sleep(0.11)  # Scryfall API rate limiting
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
    """Resize artwork to fit within 1142x920 constraints."""
    print(f"{Color.BLUE}Resizing art images...{Color.RESET}")

    temp_dir = art_dir.parent / 'images_resized_art'
    temp_dir.mkdir(exist_ok=True)

    for art_file in sorted(art_dir.glob('*.png')):
        output_file = temp_dir / art_file.name
        geometry = calculate_resize_geometry(get_dimensions(art_file), 1142, 920)

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
        composite_image(card, background, export_dir / card.name, '+210+195')
        print(f"{Color.DIM}  {card.name}{Color.RESET}")

    print(f"{Color.GREEN}✓ Added all cards to backgrounds{Color.RESET}\n")


def overlay_art_on_backgrounds(art_dir: Path, base_dir: Path, output_dir: Path):
    """Overlay artwork onto backgrounds with dynamic centering."""
    print(f"{Color.BLUE}Adding art to backgrounds...{Color.RESET}")

    for art in sorted(art_dir.glob('*.png')):
        dim = get_dimensions(art)

        # Calculate centering offsets
        h_offset = 1000 + ((1494 - dim.width) // 2)
        v_offset = 70 + ((940 - dim.height) // 2)

        composite_image(art, base_dir / art.name, output_dir / art.name, f'+{h_offset}+{v_offset}')
        print(f"{Color.DIM}  {art.name}{Color.RESET}")

    print(f"{Color.GREEN}✓ Added all art to backgrounds{Color.RESET}\n")


def add_frames_and_transparency(input_dir: Path, frame_dir: Path, final_dir: Path, frame_path: Path):
    """Add host frames and transparency holes."""
    print(f"{Color.BLUE}Adding frames and transparency...{Color.RESET}")

    # Add frames
    for image in sorted(input_dir.glob('*.png')):
        composite_image(frame_path, image, frame_dir / image.name, '+0+0')

    # Punch transparency holes
    for image in sorted(frame_dir.glob('*.png')):
        run([
            'convert', str(image),
            '(', '+clone', '-fill', 'white', '-colorize', '100',
            '-fill', 'black',
            '-draw', 'rectangle 1010,858 1489,1337',
            '-draw', 'rectangle 2008,858 2487,1337', ')',
            '-alpha', 'off', '-compose', 'copy_opacity', '-composite',
            str(final_dir / image.name)
        ])
        print(f"{Color.DIM}  {image.name}{Color.RESET}")

    print(f"{Color.GREEN}✓ Added frames and transparency{Color.RESET}\n")


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
    geometry = calculate_resize_geometry(dim, 2500, 1400)

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


def main():
    """Main entry point."""
    try:
        # Get user input
        input_type = input("> Input type? Enter SCRY for Scryfall search, or BOOST for booster-builder: ").strip().upper()

        if input_type == "BOOST":
            # Get set code from user
            set_code = input(f"{Color.BOLD}> Enter set code: {Color.RESET}").strip().upper()
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
                print("ERROR: Could not determine grid layout from booster_builder.py")
                sys.exit(1)

            grid_arrangement = layout
            card_urls, art_urls = read_booster_urls()
            query = None  # Not used in BOOST mode

        elif input_type == "SCRY":
            query = input(f"{Color.BOLD}> Enter Scryfall search query: {Color.RESET}").strip()
            grid_arrangement = input(f"{Color.BOLD}> Enter grid arrangement (e.g. 8x0, 9x0, etc.): {Color.RESET}").strip()
            print()
            card_urls = None  # Will be fetched from Scryfall
            art_urls = None

        else:
            print(f"ERROR: Unknown input type '{input_type}'. Use SCRY or BOOST.")
            sys.exit(1)

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

        # Download images
        if card_urls is None:
            # SCRY mode: fetch from Scryfall
            card_urls = get_scryfall_urls(query, 'png')
            print(f"{Color.GREEN}✓ Found {len(card_urls)} cards{Color.RESET}\n")

        if art_urls is None:
            # SCRY mode: fetch from Scryfall
            art_urls = get_scryfall_urls(query, 'art_crop')
            print(f"{Color.GREEN}✓ Found {len(art_urls)} artworks{Color.RESET}\n")

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
        create_grid(dirs['card'], grid_arrangement, resources / 'title_background.png', base / 'grid.png')

        # Cleanup booster URL files if they exist
        if input_type == "BOOST":
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
