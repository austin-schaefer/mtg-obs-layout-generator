#!/usr/bin/env bash

# Fail gracefully
## Exit on error
set -o errexit
## Exit on accessing an unset variable
set -o nounset
## Treat any error in pipe command as failing whole command
set -o pipefail

rm -rf images_card
rm -rf images_art
rm -rf images_export
rm -rf images_resized_art
rm -rf images_export_w_art
rm -rf images_export_w_art_and_frame
rm -f temp_card_images.txt
rm -f temp_art_images.txt

printf "SUCCESS: Removed all export files\n\n"