#!/usr/bin/env python3
"""
OBS Layout Image Processor

Refactored Python version of download_images.sh
Handles the complete image processing pipeline for Magic: The Gathering card layouts.
"""

import os
import sys
import subprocess
import time
import shutil
from pathlib import Path
from typing import List, Tuple


class ImageProcessor:
    """Main class for processing MTG card images into OBS layouts."""

    def __init__(self):
        self.base_dir = Path.cwd()
        self.directories = {
            'card': self.base_dir / 'images_card',
            'art': self.base_dir / 'images_art',
            'resized_art': self.base_dir / 'images_resized_art',
            'export': self.base_dir / 'images_export',
            'export_w_art': self.base_dir / 'images_export_w_art',
            'export_w_art_and_frame': self.base_dir / 'images_export_w_art_and_frame',
            'export_final': self.base_dir / 'images_export_final',
        }
        self.resources_dir = self.base_dir / 'resources'

    def print_status(self, message: str, prefix: str = ""):
        """Print status message with optional prefix."""
        print(f"{prefix}{message}")

    def run_command(self, cmd: List[str], capture_output: bool = False) -> subprocess.CompletedProcess:
        """Run a shell command with error handling."""
        try:
            result = subprocess.run(
                cmd,
                check=True,
                capture_output=capture_output,
                text=True
            )
            return result
        except subprocess.CalledProcessError as e:
            self.print_status(f"ERROR: Command failed: {' '.join(cmd)}", "")
            self.print_status(f"Error: {e}", "")
            sys.exit(1)

    def get_user_input(self) -> Tuple[str, str, str]:
        """Get necessary user input for the processing pipeline."""
        input_type = input("> Input type? Enter SCRY for Scryfall search, or BOOST for booster-builder: ").strip()

        if input_type == "SCRY":
            scryfall_search = input("> Enter Scryfall search query: ").strip()
            grid_arrangement = input("> Enter grid arrangement (e.g. 8x0, 9x0, etc.): ").strip()
            print()
            return input_type, scryfall_search, grid_arrangement

        return input_type, "", ""

    def create_directories(self):
        """Create all necessary directories for the pipeline."""
        for dir_path in self.directories.values():
            dir_path.mkdir(exist_ok=True)

    def get_scryfall_urls(self, search_query: str, url_type: str) -> List[str]:
        """
        Query Scryfall for card URLs using the scry tool.

        Args:
            search_query: Scryfall search query string
            url_type: Either 'png' for card images or 'art_crop' for artwork

        Returns:
            List of image URLs
        """
        print_format = f"%{{image_uris.{url_type}}}"
        result = self.run_command(
            ['python3', 'scry', search_query, f'--print={print_format}'],
            capture_output=True
        )

        # Split by newlines and filter out empty strings
        urls = [url.strip() for url in result.stdout.split('\n') if url.strip()]
        return urls

    def download_images(self, urls: List[str], output_dir: Path, image_type: str):
        """
        Download images from URLs with rate limiting.

        Args:
            urls: List of image URLs to download
            output_dir: Directory to save images
            image_type: Description for logging (e.g., 'card' or 'art')
        """
        self.print_status(f"START: Downloading all {image_type} images")

        for count, url in enumerate(urls, start=1):
            # Rate limiting - respect Scryfall API guidelines
            time.sleep(0.11)

            # Format filename with zero-padding
            filename = f"{count:05d}.png"
            output_path = output_dir / filename

            # Download image quietly
            self.run_command(['wget', '-q', '-O', str(output_path), url])
            self.print_status(f"Downloaded {image_type}: {url} - {filename}", "    ")

        self.print_status(f"SUCCESS: Downloaded all {image_type} images\n")

    def get_image_dimensions(self, image_path: Path) -> Tuple[int, int]:
        """Get width and height of an image using ImageMagick identify."""
        width_result = self.run_command(
            ['identify', '-ping', '-format', '%w', str(image_path)],
            capture_output=True
        )
        height_result = self.run_command(
            ['identify', '-ping', '-format', '%h', str(image_path)],
            capture_output=True
        )

        return int(width_result.stdout.strip()), int(height_result.stdout.strip())

    def resize_art_images(self):
        """Resize artwork to fit within 1142x920 pixel constraints."""
        self.print_status("START: Resizing art images")

        art_dir = self.directories['art']
        resized_dir = self.directories['resized_art']

        for art_file in sorted(art_dir.glob('*.png')):
            width, height = self.get_image_dimensions(art_file)
            output_path = resized_dir / art_file.name

            # Determine appropriate resize geometry
            if width > 1142 and height > 920:
                # Too wide and too tall - fit to both dimensions
                geometry = '1142x920'
            elif width > 1142:
                # Only too wide - fit by width
                geometry = '1142'
            elif height > 920:
                # Only too tall - fit by height
                geometry = 'x920'
            elif width < 1143 and height < 921:
                # Too small - upscale to fit
                geometry = '1142x920'
            else:
                # No resize needed - copy file
                shutil.copy2(art_file, output_path)
                self.print_status(f"Copied art {art_file.name} (no resize needed)...", "    ")
                continue

            # Resize image
            self.run_command(['convert', str(art_file), '-geometry', geometry, str(output_path)])
            self.print_status(f"Resized art {art_file.name}...", "    ")

        # Replace original art directory with resized version
        shutil.rmtree(art_dir)
        resized_dir.rename(art_dir)

        self.print_status("SUCCESS: Resized all art images\n")

    def overlay_cards_on_backgrounds(self):
        """Overlay card images onto marble backgrounds."""
        self.print_status("START: Adding cards to backgrounds")

        card_dir = self.directories['card']
        export_dir = self.directories['export']
        background = self.resources_dir / 'marble-background.png'

        for card_file in sorted(card_dir.glob('*.png')):
            output_path = export_dir / card_file.name

            # Overlay card at position +210+195
            self.run_command([
                'magick', 'composite',
                '-geometry', '+210+195',
                str(card_file),
                str(background),
                str(output_path)
            ])
            self.print_status(f"Overlaid card to {card_file.name}...", "    ")

        self.print_status("SUCCESS: Done adding cards to backgrounds\n")

    def overlay_art_on_backgrounds(self):
        """Overlay artwork onto backgrounds with dynamic centering."""
        self.print_status("START: Adding art to backgrounds")

        art_dir = self.directories['art']
        export_dir = self.directories['export']
        export_w_art_dir = self.directories['export_w_art']

        for art_file in sorted(art_dir.glob('*.png')):
            # Get dimensions for centering calculation
            width, height = self.get_image_dimensions(art_file)

            # Calculate offsets to center artwork
            horizontal_offset = 1000 + ((1494 - width) // 2)
            vertical_offset = 70 + ((940 - height) // 2)

            # Overlay art on the corresponding background with card
            input_bg = export_dir / art_file.name
            output_path = export_w_art_dir / art_file.name

            self.run_command([
                'magick', 'composite',
                '-geometry', f'+{horizontal_offset}+{vertical_offset}',
                str(art_file),
                str(input_bg),
                str(output_path)
            ])
            self.print_status(f"Overlaid art to {art_file.name}...", "    ")

        self.print_status("SUCCESS: Done adding art to backgrounds\n")

    def overlay_frames_and_transparency(self):
        """Overlay host frames and punch transparency holes."""
        self.print_status("START: Overlaying host image")

        export_w_art_dir = self.directories['export_w_art']
        export_w_frame_dir = self.directories['export_w_art_and_frame']
        final_dir = self.directories['export_final']
        host_frame = self.resources_dir / 'host-frames-card-discussion.png'

        # Overlay host frame
        for input_file in sorted(export_w_art_dir.glob('*.png')):
            output_path = export_w_frame_dir / input_file.name

            self.run_command([
                'magick', 'composite',
                '-geometry', '+0+0',
                str(host_frame),
                str(input_file),
                str(output_path)
            ])
            self.print_status(f"Overlaid host frame to {input_file.name}...", "    ")

        # Punch transparency holes
        for input_file in sorted(export_w_frame_dir.glob('*.png')):
            output_path = final_dir / input_file.name

            # Create transparency rectangles at specific coordinates
            self.run_command([
                'convert', str(input_file),
                '(', '+clone', '-fill', 'white', '-colorize', '100',
                '-fill', 'black',
                '-draw', 'rectangle 1010,858 1489,1337',
                '-draw', 'rectangle 2008,858 2487,1337', ')',
                '-alpha', 'off',
                '-compose', 'copy_opacity',
                '-composite',
                str(output_path)
            ])
            self.print_status(f"Added transparency boxes to {input_file.name}...", "    ")

        self.print_status("SUCCESS: Done overlaying host images and transparencies\n")

    def cleanup_temp_directories(self):
        """Remove temporary export directories."""
        dirs_to_remove = [
            self.directories['export'],
            self.directories['export_w_art'],
            self.directories['export_w_art_and_frame']
        ]

        for dir_path in dirs_to_remove:
            if dir_path.exists():
                shutil.rmtree(dir_path)

        self.print_status("SUCCESS: Finished cleaning up\n")

    def create_grid(self, grid_arrangement: str):
        """Create montage grid and composite onto background."""
        self.print_status("Creating grid image...")

        card_dir = self.directories['card']
        grid_path = card_dir / 'grid.png'
        grid_resized_path = self.base_dir / 'grid_resized.png'
        final_grid_path = self.base_dir / 'grid.png'

        # Change to card directory for montage
        original_dir = Path.cwd()
        os.chdir(card_dir)

        try:
            # Create montage grid
            self.run_command([
                'montage',
                '-density', '200',
                '-tile', grid_arrangement,
                '-geometry', '+10+40',
                '-background', 'none',
                *sorted([str(f.name) for f in card_dir.glob('*.png')]),
                'grid.png'
            ])
            self.print_status("SUCCESS: Card grid created\n")

            # Get grid dimensions
            width, height = self.get_image_dimensions(grid_path)

            # Resize grid conditionally
            if width > 2500 and height > 1400:
                geometry = '2500x1400'
            elif width > 2500:
                geometry = '2500'
            elif height > 1400:
                geometry = 'x1400'
            elif width < 2501 and height < 1401:
                geometry = '2500x1400'
            else:
                # No resize needed
                shutil.copy2(grid_path, grid_resized_path)
                os.chdir(original_dir)
                self.composite_final_grid(grid_resized_path, final_grid_path)
                return

            # Resize grid
            self.run_command([
                'convert',
                'grid.png',
                '-geometry', geometry,
                str(grid_resized_path)
            ])

            # Return to original directory
            os.chdir(original_dir)

            # Composite grid onto title background
            self.composite_final_grid(grid_resized_path, final_grid_path)

        finally:
            # Ensure we return to original directory
            os.chdir(original_dir)

    def composite_final_grid(self, grid_path: Path, output_path: Path):
        """Composite the resized grid onto the title background."""
        title_bg = self.resources_dir / 'title_background.png'

        self.run_command([
            'magick', 'composite',
            '-gravity', 'center',
            str(grid_path),
            str(title_bg),
            str(output_path)
        ])

        # Clean up intermediate file
        if grid_path.exists():
            grid_path.unlink()

        self.print_status("SUCCESS: Final grid exported\n")

    def run(self):
        """Execute the complete image processing pipeline."""
        # Get user input
        input_type, scryfall_search, grid_arrangement = self.get_user_input()

        if input_type != "SCRY":
            self.print_status("ERROR: Only SCRY mode is currently supported")
            sys.exit(1)

        # Create directories
        self.create_directories()

        # Get and download card images
        card_urls = self.get_scryfall_urls(scryfall_search, 'png')
        self.print_status("SUCCESS: Got list of card images\n")
        self.download_images(card_urls, self.directories['card'], 'card')

        # Get and download art images
        art_urls = self.get_scryfall_urls(scryfall_search, 'art_crop')
        self.print_status("SUCCESS: Got list of art images\n")
        self.download_images(art_urls, self.directories['art'], 'art')

        # Process images
        self.resize_art_images()
        self.overlay_cards_on_backgrounds()
        self.overlay_art_on_backgrounds()
        self.overlay_frames_and_transparency()
        self.cleanup_temp_directories()

        # Create final grid
        self.create_grid(grid_arrangement)


def main():
    """Main entry point."""
    processor = ImageProcessor()

    try:
        processor.run()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
