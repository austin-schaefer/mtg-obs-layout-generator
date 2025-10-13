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

    # Horizontal image centering calculations (dynamic positioning on backgrounds)
    HORIZONTAL_H_BASE = 1000
    HORIZONTAL_H_RANGE = 1494
    HORIZONTAL_V_BASE = 70
    HORIZONTAL_V_RANGE = 940

    # === Vertical Image Settings ===
    # Vertical images are tall/portrait orientation (MTG cards, custom vertical images)

    # MTG card overlay position on marble background
    CARD_OFFSET = '+210+195'

    # Custom vertical image constraints and centering region (on marble-background.png)
    MAX_CUSTOM_VERT_WIDTH = 850
    MAX_CUSTOM_VERT_HEIGHT = 1250
    CUSTOM_VERT_REGION_X = 75
    CUSTOM_VERT_REGION_Y = 95
    CUSTOM_VERT_REGION_WIDTH = 850
    CUSTOM_VERT_REGION_HEIGHT = 1210

    # === Hero Image Settings ===
    # Hero images appear on title slides
    MAX_HERO_WIDTH = 850
    MAX_HERO_HEIGHT = 1250
    HERO_REGION_X = 50
    HERO_REGION_Y = 95
    HERO_REGION_WIDTH = 850
    HERO_REGION_HEIGHT = 1240

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


def resize_horizontal_images(horizontal_dir: Path):
    """Resize horizontal images to fit within configured constraints."""
    return resize_images_generic(
        horizontal_dir,
        ImageConfig.MAX_HORIZONTAL_WIDTH,
        ImageConfig.MAX_HORIZONTAL_HEIGHT,
        "horizontal"
    )


def composite_image(foreground: Path, background: Path, output: Path, geometry: str):
    """Composite one image onto another at a specific position."""
    run(['magick', 'composite', '-geometry', geometry, str(foreground), str(background), str(output)])


def overlay_cards_on_backgrounds(card_dir: Path, export_dir: Path, background: Path):
    """Overlay card images onto marble backgrounds."""
    print(f"{C['blue']}Adding cards to backgrounds...{C['reset']}")

    for card in sorted(card_dir.glob('*.png')):
        composite_image(card, background, export_dir / card.name, ImageConfig.CARD_OFFSET)
        print(f"{C['dim']}  {card.name}{C['reset']}")

    print(f"{C['green']}✓ Added all cards to backgrounds{C['reset']}\n")


def overlay_horizontal_on_backgrounds(horizontal_dir: Path, base_dir: Path, output_dir: Path):
    """Overlay horizontal images onto backgrounds with dynamic centering."""
    print(f"{C['blue']}Adding horizontal images to backgrounds...{C['reset']}")

    for image in sorted(horizontal_dir.glob('*.png')):
        dim = get_dimensions(image)

        # Calculate centering offsets
        h_offset = ImageConfig.HORIZONTAL_H_BASE + ((ImageConfig.HORIZONTAL_H_RANGE - dim.width) // 2)
        v_offset = ImageConfig.HORIZONTAL_V_BASE + ((ImageConfig.HORIZONTAL_V_RANGE - dim.height) // 2)

        composite_image(image, base_dir / image.name, output_dir / image.name, f'+{h_offset}+{v_offset}')
        print(f"{C['dim']}  {image.name}{C['reset']}")

    print(f"{C['green']}✓ Added all horizontal images to backgrounds{C['reset']}\n")


def resize_images_generic(
    input_dir: Path,
    max_width: int,
    max_height: int,
    label: str
) -> Path:
    """
    Generic image resizing function.
    Returns path to directory containing resized images.
    """
    print(f"{C['blue']}Resizing {label} images...{C['reset']}")

    temp_dir = input_dir.parent / f'images_resized_{label.replace(" ", "_").lower()}'
    temp_dir.mkdir(exist_ok=True)

    for image_file in sorted(input_dir.glob('*.png')):
        output_file = temp_dir / image_file.name
        geometry = calculate_resize_geometry(
            get_dimensions(image_file),
            max_width,
            max_height
        )

        if geometry:
            run(['convert', str(image_file), '-geometry', geometry, str(output_file)])
            print(f"{C['dim']}  Resized {image_file.name}{C['reset']}")
        else:
            shutil.copy2(image_file, output_file)
            print(f"{C['dim']}  Copied {image_file.name} (no resize needed){C['reset']}")

    shutil.rmtree(input_dir)
    temp_dir.rename(input_dir)
    print(f"{C['green']}✓ Resized all {label} images{C['reset']}\n")

    return input_dir


def overlay_images_centered_in_region(
    image_dir: Path,
    background: Path,
    output_dir: Path,
    region_x: int,
    region_y: int,
    region_width: int,
    region_height: int,
    label: str
):
    """
    Generic function to overlay images centered within a specific region on a background.
    Used for both custom vertical images and hero images.
    """
    print(f"{C['blue']}Adding {label} to backgrounds...{C['reset']}")

    for image in sorted(image_dir.glob('*.png')):
        dim = get_dimensions(image)

        # Calculate centering offset within region
        x_offset = region_x + ((region_width - dim.width) // 2)
        y_offset = region_y + ((region_height - dim.height) // 2)

        composite_image(image, background, output_dir / image.name, f'+{x_offset}+{y_offset}')
        print(f"{C['dim']}  {image.name}{C['reset']}")

    print(f"{C['green']}✓ Added all {label} to backgrounds{C['reset']}\n")


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
    """
    Validate custom directory and return sorted list of image pairs.

    Validates:
    - Directory exists
    - All files are images (png, jpg, jpeg, gif)
    - All files follow naming convention (number[vh].extension, e.g., 1v.png, 2h.jpg)
    - Each number has both v and h variants

    Returns sorted list of CustomImagePair objects.
    Raises ValueError with detailed error message if validation fails.
    """
    import re

    # Check directory exists
    if not custom_dir.exists():
        raise ValueError(f"Custom directory does not exist: {custom_dir}")

    if not custom_dir.is_dir():
        raise ValueError(f"Path exists but is not a directory: {custom_dir}")

    # Get all files in directory
    all_files = list(custom_dir.iterdir())

    if not all_files:
        raise ValueError(f"Custom directory is empty: {custom_dir}")

    # Valid image extensions
    valid_extensions = {'.png', '.jpg', '.jpeg', '.gif'}

    # Pattern for valid filename: number[vh].extension (e.g., 1v.png, 2h.jpg)
    filename_pattern = re.compile(r'^(\d+)(v|h)\.(png|jpg|jpeg|gif)$', re.IGNORECASE)

    # Validate each file
    vertical_images = {}  # number -> path
    horizontal_images = {}  # number -> path
    invalid_files = []

    for file_path in all_files:
        # Skip directories
        if file_path.is_dir():
            invalid_files.append((file_path.name, "is a directory"))
            continue

        filename = file_path.name

        # Check if it's an image file
        if file_path.suffix.lower() not in valid_extensions:
            invalid_files.append((filename, f"invalid extension (must be {', '.join(valid_extensions)})"))
            continue

        # Check if filename matches pattern
        match = filename_pattern.match(filename)
        if not match:
            invalid_files.append((filename, "invalid naming pattern (must be: number[vh].extension, e.g., 1v.png or 2h.jpg)"))
            continue

        number = int(match.group(1))
        orientation = match.group(2).lower()

        # Store in appropriate dictionary
        if orientation == 'v':
            if number in vertical_images:
                raise ValueError(f"Duplicate vertical image for number {number}: {filename} and {vertical_images[number].name}")
            vertical_images[number] = file_path
        else:  # orientation == 'h'
            if number in horizontal_images:
                raise ValueError(f"Duplicate horizontal image for number {number}: {filename} and {horizontal_images[number].name}")
            horizontal_images[number] = file_path

    # Report invalid files if any
    if invalid_files:
        error_msg = "Invalid files found in custom directory:\n"
        for filename, reason in invalid_files:
            error_msg += f"  - {filename}: {reason}\n"
        raise ValueError(error_msg.rstrip())

    # Check that each number has both v and h variants
    all_numbers = set(vertical_images.keys()) | set(horizontal_images.keys())
    missing_pairs = []

    for num in sorted(all_numbers):
        if num not in vertical_images:
            missing_pairs.append(f"  - {num}: missing vertical image ({num}v.*)")
        if num not in horizontal_images:
            missing_pairs.append(f"  - {num}: missing horizontal image ({num}h.*)")

    if missing_pairs:
        error_msg = "Incomplete image pairs found:\n" + "\n".join(missing_pairs)
        raise ValueError(error_msg)

    # Create sorted list of pairs
    pairs = [
        CustomImagePair(num, vertical_images[num], horizontal_images[num])
        for num in sorted(all_numbers)
    ]

    return pairs


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

    Resizes hero to fit within MAX_HERO_WIDTH x MAX_HERO_HEIGHT,
    then centers it on title_background_w_frame.png within the hero region.
    """
    print(f"{C['blue']}Creating hero title slide...{C['reset']}")

    # Create temp directory for resized hero
    temp_hero_dir = Path.cwd() / 'temp_hero'
    temp_hero_dir.mkdir(exist_ok=True)

    # Resize hero image using existing resize logic
    resized_hero = temp_hero_dir / 'hero_resized.png'
    dim = get_dimensions(hero_path)
    geometry = calculate_resize_geometry(dim, ImageConfig.MAX_HERO_WIDTH, ImageConfig.MAX_HERO_HEIGHT)

    if geometry:
        run(['convert', str(hero_path), '-geometry', geometry, str(resized_hero)])
        print(f"{C['dim']}  Resized hero image{C['reset']}")
    else:
        shutil.copy2(hero_path, resized_hero)
        print(f"{C['dim']}  Hero image already correct size{C['reset']}")

    # Get dimensions of resized hero
    hero_dim = get_dimensions(resized_hero)

    # Calculate centering offset within hero region
    x_offset = ImageConfig.HERO_REGION_X + ((ImageConfig.HERO_REGION_WIDTH - hero_dim.width) // 2)
    y_offset = ImageConfig.HERO_REGION_Y + ((ImageConfig.HERO_REGION_HEIGHT - hero_dim.height) // 2)

    # Composite hero onto title background with frame
    title_bg = resources_dir / 'title_background_w_frame.png'
    composite_image(resized_hero, title_bg, output_path, f'+{x_offset}+{y_offset}')

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

    # Check for directories and files (both old and new naming conventions)
    paths_to_check = [
        # New naming convention
        base / 'images_vertical',
        base / 'images_horizontal',
        base / 'images_export',
        base / 'images_resized_vertical',
        base / 'images_resized_horizontal',
        base / 'images_export_w_horizontal',
        base / 'images_export_w_horizontal_and_frame',
        base / 'images_export_final',
        # Other files
        base / 'temp_hero',
        base / 'grid.png',
        base / 'grid_temp.png',
        base / 'temp_hero_title.png',
        base / 'booster_card_urls.txt',
        base / 'booster_art_urls.txt',
    ]

    existing = [p for p in paths_to_check if p.exists()]

    if not existing:
        return True

    # Found existing files - warn the user
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
            # CUSTOM mode: load from custom directory
            load_custom_images(mode.custom_pairs, dirs['vertical'], dirs['horizontal'])

            # Process custom images with specific resize and overlay logic
            # Resize vertical images
            resize_images_generic(
                dirs['vertical'],
                ImageConfig.MAX_CUSTOM_VERT_WIDTH,
                ImageConfig.MAX_CUSTOM_VERT_HEIGHT,
                "vertical"
            )

            # Resize horizontal images
            resize_horizontal_images(dirs['horizontal'])

            # Overlay vertical images centered in custom region
            overlay_images_centered_in_region(
                dirs['vertical'],
                resources / 'marble-background.png',
                dirs['export'],
                ImageConfig.CUSTOM_VERT_REGION_X,
                ImageConfig.CUSTOM_VERT_REGION_Y,
                ImageConfig.CUSTOM_VERT_REGION_WIDTH,
                ImageConfig.CUSTOM_VERT_REGION_HEIGHT,
                "vertical images"
            )

            # Overlay horizontal images using horizontal centering logic
            overlay_horizontal_on_backgrounds(dirs['horizontal'], dirs['export'], dirs['export_w_horizontal'])

        elif mode.mode == "SCRY":
            # SCRY mode: fetch MTG cards from Scryfall
            card_urls = get_scryfall_urls(mode.query, 'png')
            print(f"{C['green']}✓ Found {len(card_urls)} cards{C['reset']}\n")

            art_urls = get_scryfall_urls(mode.query, 'art_crop')
            print(f"{C['green']}✓ Found {len(art_urls)} artworks{C['reset']}\n")

            download_images(card_urls, dirs['vertical'], 'card')
            download_images(art_urls, dirs['horizontal'], 'art')

            # Process MTG card images
            resize_horizontal_images(dirs['horizontal'])
            overlay_cards_on_backgrounds(dirs['vertical'], dirs['export'], resources / 'marble-background.png')
            overlay_horizontal_on_backgrounds(dirs['horizontal'], dirs['export'], dirs['export_w_horizontal'])

        else:
            # BOOST mode: use pre-fetched MTG card URLs
            card_urls = mode.card_urls
            art_urls = mode.art_urls

            download_images(card_urls, dirs['vertical'], 'card')
            download_images(art_urls, dirs['horizontal'], 'art')

            # Process MTG card images
            resize_horizontal_images(dirs['horizontal'])
            overlay_cards_on_backgrounds(dirs['vertical'], dirs['export'], resources / 'marble-background.png')
            overlay_horizontal_on_backgrounds(dirs['horizontal'], dirs['export'], dirs['export_w_horizontal'])
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
