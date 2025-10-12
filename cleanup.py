#!/usr/bin/env python3
"""
Cleanup Script

Removes all generated files and directories from the image processing pipeline.
"""

import shutil
from pathlib import Path


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
            print(f"Removed {dir_name}/")

    # Remove files
    for file_name in files_to_remove:
        file_path = base / file_name
        if file_path.exists():
            file_path.unlink()
            print(f"Removed {file_name}")

    print("\n✓ Cleanup complete\n")


if __name__ == '__main__':
    main()
