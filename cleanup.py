#!/usr/bin/env python3
"""
Cleanup Script

Removes all generated files and directories from the image processing pipeline.
"""

import shutil
from pathlib import Path


# ANSI color codes
class Color:
    GREEN = '\033[32m'     # Standard green instead of bright green
    YELLOW = '\033[33m'    # Standard yellow instead of bright yellow
    DIM = '\033[2m'
    BOLD = '\033[1m'
    RESET = '\033[0m'


def main():
    """Remove all generated files and directories."""
    base = Path.cwd()

    # Directories to remove
    dirs_to_remove = [
        'images_card',
        'images_art',
        'images_export',
        'images_resized_art',
        'images_export_w_art',
        'images_export_w_art_and_frame',
        'images_export_final',
    ]

    # Files to remove
    files_to_remove = [
        'temp_card_images.txt',
        'temp_art_images.txt',
        'booster_card_urls.txt',
        'booster_art_urls.txt',
        'grid.png',
        'grid_temp.png',
    ]

    # Remove directories
    for dir_name in dirs_to_remove:
        dir_path = base / dir_name
        if dir_path.exists():
            shutil.rmtree(dir_path)
            print(f"{Color.DIM}Removed {dir_name}/{Color.RESET}")

    # Remove files
    for file_name in files_to_remove:
        file_path = base / file_name
        if file_path.exists():
            file_path.unlink()
            print(f"{Color.DIM}Removed {file_name}{Color.RESET}")

    print(f"\n{Color.BOLD}{Color.GREEN}✓ Cleanup complete{Color.RESET}\n")


if __name__ == '__main__':
    main()
