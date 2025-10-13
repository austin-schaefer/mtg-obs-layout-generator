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

    # === Horizontal Image Settings ===
    # Horizontal images are wide/landscape orientation (MTG card art, custom horizontal images)
    MAX_HORIZONTAL_WIDTH = 1142
    MAX_HORIZONTAL_HEIGHT = 920
    HORIZONTAL_REGION_X = 1000
    HORIZONTAL_REGION_Y = 70
    HORIZONTAL_REGION_WIDTH = 1494
    HORIZONTAL_REGION_HEIGHT = 940

    # === Vertical Image Settings ===
    # Vertical images are tall/portrait orientation (MTG cards, custom vertical images, hero images)
    MAX_VERT_WIDTH = 850
    MAX_VERT_HEIGHT = 1250
    VERT_REGION_X = 75
    VERT_REGION_Y = 95
    VERT_REGION_WIDTH = 850
    VERT_REGION_HEIGHT = 1210

    # === Transparency and Grid Settings ===
    TRANSPARENCY_RECT_1 = '1010,858 1489,1337'
    TRANSPARENCY_RECT_2 = '2008,858 2487,1337'
    MAX_GRID_WIDTH = 2500
    MAX_GRID_HEIGHT = 1400

    # === Scryfall API Settings ===
    API_DELAY = 0.11  # Rate limit in seconds


# ANSI color codes
C = {
    'blue': '\033[34m', 'green': '\033[32m', 'yellow': '\033[33m',
    'red': '\033[31m', 'magenta': '\033[35m', 'bold': '\033[1m',
    'dim': '\033[2m', 'reset': '\033[0m'
}


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
    print(f"{C['blue']}Downloading {len(urls)} {label} images...{C['reset']}")

    for i, url in enumerate(urls, 1):
        time.sleep(ImageConfig.API_DELAY)  # Scryfall API rate limiting
        filename = f"{i:05d}.png"
        urlretrieve(url, output_dir / filename)
        print(f"{C['dim']}  {i}/{len(urls)}: {filename}{C['reset']}")

    print(f"{C['green']}✓ Downloaded all {label} images{C['reset']}\n")


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


def resize_image(input_path: Path, output_path: Path, max_width: int, max_height: int) -> bool:
    """
    Resize a single image to fit within max dimensions.
    Returns True if image was resized, False if copied without resizing.
    """
    dim = get_dimensions(input_path)
    geometry = calculate_resize_geometry(dim, max_width, max_height)

    if geometry:
        run(['convert', str(input_path), '-geometry', geometry, str(output_path)])
        return True
    else:
        shutil.copy2(input_path, output_path)
        return False


def overlay_centered(
    image_path: Path,
    background_path: Path,
    output_path: Path,
    region_x: int,
    region_y: int,
    region_width: int,
    region_height: int
):
    """
    Overlay an image centered within a specific region on a background.
    Calculates the centering offset and composites the image.
    """
    dim = get_dimensions(image_path)

    # Calculate centering offset within region
    x_offset = region_x + ((region_width - dim.width) // 2)
    y_offset = region_y + ((region_height - dim.height) // 2)

    composite_image(image_path, background_path, output_path, f'+{x_offset}+{y_offset}')


def composite_image(foreground: Path, background: Path, output: Path, geometry: str):
    """Composite one image onto another at a specific position."""
    run(['magick', 'composite', '-geometry', geometry, str(foreground), str(background), str(output)])


def process_mtg_images(dirs: dict, resources: Path):
    """
    Process MTG card and art images.
    MTG images are already perfect size from Scryfall, so we skip resizing.
    """
    # Resize horizontal art images
    print(f"{C['blue']}Resizing art images...{C['reset']}")
    temp_dir = dirs['horizontal'].parent / f'temp_resize_{dirs["horizontal"].name}'
    temp_dir.mkdir(exist_ok=True)
    for img in sorted(dirs['horizontal'].glob('*.png')):
        resized = resize_image(img, temp_dir / img.name, ImageConfig.MAX_HORIZONTAL_WIDTH, ImageConfig.MAX_HORIZONTAL_HEIGHT)
        print(f"{C['dim']}  {'Resized' if resized else 'Copied'}: {img.name}{C['reset']}")
    shutil.rmtree(dirs['horizontal'])
    temp_dir.rename(dirs['horizontal'])
    print(f"{C['green']}✓ Resized art images{C['reset']}\n")

    # Overlay cards centered in vertical region (no resize - cards are already perfect)
    print(f"{C['blue']}Adding cards to backgrounds...{C['reset']}")
    for img in sorted(dirs['vertical'].glob('*.png')):
        overlay_centered(img, resources / 'marble-background.png', dirs['export'] / img.name,
                        ImageConfig.VERT_REGION_X, ImageConfig.VERT_REGION_Y,
                        ImageConfig.VERT_REGION_WIDTH, ImageConfig.VERT_REGION_HEIGHT)
        print(f"{C['dim']}  {img.name}{C['reset']}")
    print(f"{C['green']}✓ Added cards{C['reset']}\n")

    # Overlay art centered in horizontal region
    print(f"{C['blue']}Adding art to backgrounds...{C['reset']}")
    for img in sorted(dirs['horizontal'].glob('*.png')):
        overlay_centered(img, dirs['export'] / img.name, dirs['export_w_horizontal'] / img.name,
                        ImageConfig.HORIZONTAL_REGION_X, ImageConfig.HORIZONTAL_REGION_Y,
                        ImageConfig.HORIZONTAL_REGION_WIDTH, ImageConfig.HORIZONTAL_REGION_HEIGHT)
        print(f"{C['dim']}  {img.name}{C['reset']}")
    print(f"{C['green']}✓ Added art{C['reset']}\n")


def process_custom_images(dirs: dict, resources: Path):
    """
    Process custom vertical and horizontal images.
    Custom images need to be resized to fit within max constraints before centering.
    """
    # Resize vertical images
    print(f"{C['blue']}Resizing vertical images...{C['reset']}")
    temp_dir = dirs['vertical'].parent / f'temp_resize_{dirs["vertical"].name}'
    temp_dir.mkdir(exist_ok=True)
    for img in sorted(dirs['vertical'].glob('*.png')):
        resized = resize_image(img, temp_dir / img.name, ImageConfig.MAX_VERT_WIDTH, ImageConfig.MAX_VERT_HEIGHT)
        print(f"{C['dim']}  {'Resized' if resized else 'Copied'}: {img.name}{C['reset']}")
    shutil.rmtree(dirs['vertical'])
    temp_dir.rename(dirs['vertical'])
    print(f"{C['green']}✓ Resized vertical images{C['reset']}\n")

    # Resize horizontal images
    print(f"{C['blue']}Resizing horizontal images...{C['reset']}")
    temp_dir = dirs['horizontal'].parent / f'temp_resize_{dirs["horizontal"].name}'
    temp_dir.mkdir(exist_ok=True)
    for img in sorted(dirs['horizontal'].glob('*.png')):
        resized = resize_image(img, temp_dir / img.name, ImageConfig.MAX_HORIZONTAL_WIDTH, ImageConfig.MAX_HORIZONTAL_HEIGHT)
        print(f"{C['dim']}  {'Resized' if resized else 'Copied'}: {img.name}{C['reset']}")
    shutil.rmtree(dirs['horizontal'])
    temp_dir.rename(dirs['horizontal'])
    print(f"{C['green']}✓ Resized horizontal images{C['reset']}\n")

    # Overlay vertical images centered in vertical region
    print(f"{C['blue']}Adding vertical images to backgrounds...{C['reset']}")
    for img in sorted(dirs['vertical'].glob('*.png')):
        overlay_centered(img, resources / 'marble-background.png', dirs['export'] / img.name,
                        ImageConfig.VERT_REGION_X, ImageConfig.VERT_REGION_Y,
                        ImageConfig.VERT_REGION_WIDTH, ImageConfig.VERT_REGION_HEIGHT)
        print(f"{C['dim']}  {img.name}{C['reset']}")
    print(f"{C['green']}✓ Added vertical images{C['reset']}\n")

    # Overlay horizontal images centered in horizontal region
    print(f"{C['blue']}Adding horizontal images to backgrounds...{C['reset']}")
    for img in sorted(dirs['horizontal'].glob('*.png')):
        overlay_centered(img, dirs['export'] / img.name, dirs['export_w_horizontal'] / img.name,
                        ImageConfig.HORIZONTAL_REGION_X, ImageConfig.HORIZONTAL_REGION_Y,
                        ImageConfig.HORIZONTAL_REGION_WIDTH, ImageConfig.HORIZONTAL_REGION_HEIGHT)
        print(f"{C['dim']}  {img.name}{C['reset']}")
    print(f"{C['green']}✓ Added horizontal images{C['reset']}\n")


def add_frames_and_transparency(input_dir: Path, frame_dir: Path, final_dir: Path, frame_path: Path):
    """Add host frames and transparency holes."""
    # Add frames
    print(f"{C['blue']}Adding frames...{C['reset']}")
    for image in sorted(input_dir.glob('*.png')):
        composite_image(frame_path, image, frame_dir / image.name, '+0+0')
        print(f"{C['dim']}  {image.name}{C['reset']}")
    print(f"{C['green']}✓ Added all frames{C['reset']}\n")

    # Punch transparency holes
    print(f"{C['blue']}Adding transparency...{C['reset']}")
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
        print(f"{C['dim']}  {image.name}{C['reset']}")
    print(f"{C['green']}✓ Added all transparency{C['reset']}\n")


def create_grid(vertical_dir: Path, grid_arrangement: str, title_background: Path, output: Path):
    """Create and composite the image grid from vertical images."""
    print(f"{C['blue']}Creating grid...{C['reset']}")

    # Create montage in vertical directory (montage only works well with relative paths)
    with working_directory(vertical_dir):
        image_files = sorted([f.name for f in vertical_dir.glob('*.png')])
        run(['montage', '-density', '200', '-tile', grid_arrangement,
             '-geometry', '+10+40', '-background', 'none', *image_files, 'grid.png'])

    grid_path = vertical_dir / 'grid.png'
    print(f"{C['green']}✓ Created montage{C['reset']}\n")

    # Resize grid if needed
    print(f"{C['blue']}Resizing grid...{C['reset']}")
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

    print(f"{C['green']}✓ Final grid created{C['reset']}\n")


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
class CustomImagePair:
    """A pair of vertical and horizontal custom images."""
    number: int
    vertical_path: Path
    horizontal_path: Path


def validate_custom_directory(custom_dir: Path) -> list[CustomImagePair]:
    """Validate custom directory and return sorted image pairs (format: number[vh].ext)."""
    import re

    if not custom_dir.is_dir():
        raise ValueError(f"Custom directory missing or not a directory: {custom_dir}")

    files = [f for f in custom_dir.iterdir() if f.is_file()]
    if not files:
        raise ValueError(f"Custom directory is empty: {custom_dir}")

    pattern = re.compile(r'^(\d+)(v|h)\.(png|jpg|jpeg|gif)$', re.IGNORECASE)
    vertical, horizontal, invalid = {}, {}, []

    for f in files:
        if not (match := pattern.match(f.name)):
            invalid.append((f.name, "must be number[vh].ext (e.g., 1v.png)"))
            continue

        num, orient = int(match[1]), match[2].lower()
        target = vertical if orient == 'v' else horizontal

        if num in target:
            raise ValueError(f"Duplicate {orient} image for {num}: {f.name} and {target[num].name}")
        target[num] = f

    if invalid:
        errors = '\n'.join(f"  - {name}: {reason}" for name, reason in invalid)
        raise ValueError(f"Invalid files:\n{errors}")

    all_nums = set(vertical) | set(horizontal)
    missing = [f"  - {n}: missing {('v' if n not in vertical else 'h')} image"
               for n in sorted(all_nums) if n not in vertical or n not in horizontal]

    if missing:
        raise ValueError("Incomplete pairs:\n" + "\n".join(missing))

    return [CustomImagePair(n, vertical[n], horizontal[n]) for n in sorted(all_nums)]


def load_custom_images(pairs: list[CustomImagePair], vertical_dir: Path, horizontal_dir: Path):
    """
    Load custom images from pairs into processing directories.
    Converts images to PNG format and renames them sequentially (00001.png, 00002.png, etc.).
    Uses [0] notation to extract only the first frame from animated GIFs.
    """
    print(f"{C['blue']}Loading {len(pairs)} custom image pairs...{C['reset']}")

    for i, pair in enumerate(pairs, 1):
        output_filename = f"{i:05d}.png"

        # Convert and copy vertical image (use [0] to get only first frame if animated)
        vertical_output = vertical_dir / output_filename
        run(['convert', f'{str(pair.vertical_path)}[0]', str(vertical_output)])
        print(f"{C['dim']}  Loaded vertical: {pair.vertical_path.name} -> {output_filename}{C['reset']}")

        # Convert and copy horizontal image (use [0] to get only first frame if animated)
        horizontal_output = horizontal_dir / output_filename
        run(['convert', f'{str(pair.horizontal_path)}[0]', str(horizontal_output)])
        print(f"{C['dim']}  Loaded horizontal: {pair.horizontal_path.name} -> {output_filename}{C['reset']}")

    print(f"{C['green']}✓ Loaded all custom images{C['reset']}\n")


def find_hero_image(resources_dir: Path) -> Path | None:
    """
    Find hero image in resources directory.
    Looks for hero.{jpg,jpeg,png,gif} and returns the first match.
    """
    for ext in ['jpg', 'jpeg', 'png', 'gif']:
        hero_path = resources_dir / f'hero.{ext}'
        if hero_path.exists():
            return hero_path
    return None


def create_hero_title_slide(hero_path: Path, resources_dir: Path, output_path: Path):
    """
    Create title slide with centered hero image.
    Resizes hero to fit within max constraints, then centers it in the vertical region.
    """
    print(f"{C['blue']}Creating hero title slide...{C['reset']}")

    # Create temp directory for resized hero
    temp_hero_dir = Path.cwd() / 'temp_hero'
    temp_hero_dir.mkdir(exist_ok=True)

    # Resize hero image
    resized_hero = temp_hero_dir / 'hero_resized.png'
    resized = resize_image(hero_path, resized_hero, ImageConfig.MAX_VERT_WIDTH, ImageConfig.MAX_VERT_HEIGHT)
    status = "Resized hero image" if resized else "Hero image already correct size"
    print(f"{C['dim']}  {status}{C['reset']}")

    # Overlay hero centered in vertical region
    title_bg = resources_dir / 'title_background_w_frame.png'
    overlay_centered(resized_hero, title_bg, output_path,
                     ImageConfig.VERT_REGION_X, ImageConfig.VERT_REGION_Y,
                     ImageConfig.VERT_REGION_WIDTH, ImageConfig.VERT_REGION_HEIGHT)

    # Cleanup temp directory
    shutil.rmtree(temp_hero_dir)

    print(f"{C['green']}✓ Created hero title slide{C['reset']}\n")


@dataclass
class InputMode:
    """User input mode configuration."""
    mode: str  # "SCRY", "BOOST", or "CUSTOM"
    grid_arrangement: str
    card_urls: list[str] | None = None
    art_urls: list[str] | None = None
    query: str | None = None  # Only used in SCRY mode
    custom_pairs: list[CustomImagePair] | None = None  # Only used in CUSTOM mode


def check_existing_files() -> bool:
    """
    Check for existing export files and directories.
    Returns True if user wants to continue, False if they want to exit.
    """
    base = Path.cwd()

    # Check for all possible generated paths
    paths_to_check = [
        base / 'images_vertical',
        base / 'images_horizontal',
        base / 'images_export',
        base / 'images_export_w_horizontal',
        base / 'images_export_w_horizontal_and_frame',
        base / 'images_export_final',
        base / 'temp_hero',
        base / 'grid.png',
        base / 'grid_temp.png',
        base / 'temp_hero_title.png',
        base / 'booster_card_urls.txt',
        base / 'booster_art_urls.txt',
    ]

    # Add temp resize directories (dynamically generated names)
    paths_to_check.extend([p for p in base.glob('temp_resize_*') if p.is_dir()])

    existing = [p for p in paths_to_check if p.exists()]

    if not existing:
        return True

    print(f"{C['yellow']}Warning: Found existing export files/directories:{C['reset']}")
    for path in existing:
        path_str = f"{path.name}/" if path.is_dir() else path.name
        print(f"{C['dim']}  {path_str}{C['reset']}")

    print()
    response = input(f"{C['bold']}{C['magenta']}> Continue anyway? (y/n): {C['reset']}").strip().lower()

    if response == 'y':
        print()
        return True
    else:
        print(f"\n{C['yellow']}Exiting. Run './cleanup.py' to remove existing files.{C['reset']}")
        return False


def get_user_input_mode() -> InputMode:
    """Get user input and determine processing mode."""
    input_type = input(
        f"{C['bold']}{C['magenta']}> Input type? "
        f"Enter SCRYFALL for Scryfall search, BOOSTER for booster pack, or CUSTOM for custom images: {C['reset']}"
    ).strip().upper()

    # Handle CUSTOM mode
    if input_type == "CUSTOM":
        grid_arrangement = input(
            f"{C['bold']}{C['magenta']}> Enter grid arrangement (e.g. 8x0, 9x0, etc.): {C['reset']}"
        ).strip()
        print()

        # Validate custom directory
        custom_dir = Path.cwd() / 'custom'
        print(f"{C['blue']}Validating custom directory...{C['reset']}")

        try:
            pairs = validate_custom_directory(custom_dir)
            print(f"{C['green']}✓ Found {len(pairs)} valid image pairs{C['reset']}\n")
            return InputMode(mode="CUSTOM", grid_arrangement=grid_arrangement, custom_pairs=pairs)
        except ValueError as e:
            print(f"{C['red']}ERROR: Custom directory validation failed:{C['reset']}")
            print(f"{C['yellow']}{e}{C['reset']}")
            sys.exit(1)

    # Handle BOOST/BOOSTER mode
    elif input_type in ("BOOST", "BOOSTER"):
        set_code = input(f"{C['bold']}{C['magenta']}> Enter set code: {C['reset']}").strip().upper()
        print()

        # Call booster_builder.py to build the booster
        print(f"{C['yellow']}Building booster pack...{C['reset']}\n")
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
        query = input(f"{C['bold']}{C['magenta']}> Enter Scryfall search query: {C['reset']}").strip()
        grid_arrangement = input(
            f"{C['bold']}{C['magenta']}> Enter grid arrangement (e.g. 8x0, 9x0, etc.): {C['reset']}"
        ).strip()
        print()
        return InputMode(mode="SCRY", grid_arrangement=grid_arrangement, query=query)

    # Unknown input type
    else:
        raise ValueError(f"Unknown input type '{input_type}'. Use SCRY/SCRYFALL, BOOST/BOOSTER, or CUSTOM.")


def main():
    """Main entry point."""
    try:
        # Check for existing files before starting
        if not check_existing_files():
            sys.exit(0)

        # Get user input and mode configuration first
        mode = get_user_input_mode()

        # Check if user wants a hero image
        hero_response = input(f"{C['bold']}{C['magenta']}> Do you want a hero image on the title slide? (y/n): {C['reset']}").strip().lower()
        print()

        hero_path = None
        if hero_response == 'y':
            # Look for hero image in resources
            resources = Path.cwd() / 'resources'
            hero_path = find_hero_image(resources)

            if hero_path is None:
                print(f"{C['red']}ERROR: No hero image found in /resources/{C['reset']}")
                print(f"{C['yellow']}Please add a file named 'hero' with extension .jpg, .jpeg, .png, or .gif{C['reset']}")
                sys.exit(1)

            print(f"{C['green']}✓ Found hero image: {hero_path.name}{C['reset']}\n")

        # Setup paths
        base = Path.cwd()
        resources = base / 'resources'

        # Use generic naming: vertical images go in images_vertical, horizontal in images_horizontal
        dirs = {
            'vertical': base / 'images_vertical',
            'horizontal': base / 'images_horizontal',
            'export': base / 'images_export',
            'export_w_horizontal': base / 'images_export_w_horizontal',
            'export_w_frame': base / 'images_export_w_horizontal_and_frame',
            'final': base / 'images_export_final',
        }

        # Create directories
        for d in dirs.values():
            d.mkdir(exist_ok=True)

        # Fetch/load images based on mode
        if mode.mode == "CUSTOM":
            load_custom_images(mode.custom_pairs, dirs['vertical'], dirs['horizontal'])
            process_custom_images(dirs, resources)

        elif mode.mode == "SCRY":
            card_urls = get_scryfall_urls(mode.query, 'png')
            print(f"{C['green']}✓ Found {len(card_urls)} cards{C['reset']}\n")

            art_urls = get_scryfall_urls(mode.query, 'art_crop')
            print(f"{C['green']}✓ Found {len(art_urls)} artworks{C['reset']}\n")

            download_images(card_urls, dirs['vertical'], 'card')
            download_images(art_urls, dirs['horizontal'], 'art')
            process_mtg_images(dirs, resources)

        else:  # BOOST mode
            download_images(mode.card_urls, dirs['vertical'], 'card')
            download_images(mode.art_urls, dirs['horizontal'], 'art')
            process_mtg_images(dirs, resources)
        add_frames_and_transparency(
            dirs['export_w_horizontal'],
            dirs['export_w_frame'],
            dirs['final'],
            resources / 'host-frames-card-discussion.png'
        )

        # Cleanup temp directories
        for d in [dirs['export'], dirs['export_w_horizontal'], dirs['export_w_frame']]:
            shutil.rmtree(d)
        print(f"{C['green']}✓ Cleaned up temporary directories{C['reset']}\n")

        # Create title slides (first and last slides)
        if hero_path:
            # Create hero title slide
            hero_title_slide = base / 'temp_hero_title.png'
            create_hero_title_slide(hero_path, resources, hero_title_slide)

            # Copy to first and last positions
            shutil.copy2(hero_title_slide, dirs['final'] / '00000.png')
            shutil.copy2(hero_title_slide, dirs['final'] / '99999.png')

            # Cleanup temp file
            hero_title_slide.unlink()

            print(f"{C['green']}✓ Added hero title slides to final directory (first and last slides){C['reset']}\n")
        else:
            # Copy plain title background with frame
            shutil.copy2(resources / 'title_background_w_frame.png', dirs['final'] / '00000.png')
            shutil.copy2(resources / 'title_background_w_frame.png', dirs['final'] / '99999.png')
            print(f"{C['green']}✓ Added title background to final directory (first and last slides){C['reset']}\n")

        # Create final grid from vertical images
        create_grid(dirs['vertical'], mode.grid_arrangement, resources / 'title_background.png', base / 'grid.png')

        # Cleanup booster URL files if in BOOST mode
        if mode.mode == "BOOST":
            for f in [base / 'booster_card_urls.txt', base / 'booster_art_urls.txt']:
                if f.exists():
                    f.unlink()

        print(f"{C['bold']}{C['green']}Finished! Check /images_export_final/ for output.{C['reset']}")

    except KeyboardInterrupt:
        print(f"\n{C['yellow']}Interrupted by user{C['reset']}")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"\n{C['red']}ERROR: Command failed: {' '.join(e.cmd)}{C['reset']}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{C['red']}ERROR: {e}{C['reset']}")
        sys.exit(1)


if __name__ == '__main__':
    main()
