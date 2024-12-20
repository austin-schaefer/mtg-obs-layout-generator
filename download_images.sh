#!/usr/bin/env bash

# Fail gracefully
## Exit on error
set -o errexit
## Exit on accessing an unset variable
set -o nounset
## Treat any error in pipe command as failing whole command
set -o pipefail

# Prompt for user input
printf "> Enter Scryfall search query: "
read scryfall_search
printf "> Enter grid arrangement (e.g. 8x0, 9x0, etc.): "
read grid_arrangement
printf "\n"

# Create export directories and temp directories
mkdir images_card
mkdir images_export
mkdir images_art
mkdir images_resized_art
mkdir images_export_w_art
mkdir images_export_w_art_and_frame
mkdir images_export_final

# Get list of card images, export to temp file
python3 scry $scryfall_search --print="%{image_uris.png}" > temp_card_images.txt
printf "SUCCESS: Got list of card images\n\n"

# Instantiate variable for card filenames
card_count=1

# Download images of all cards
printf "START: Downloading all card images\n"
for card_image in "${(@f)"$(<temp_card_images.txt)"}"
{
    sleep 0.11
    printf -v card_numbers "%05d" $card_count
    wget -q -O ./images_card/$card_numbers.png $card_image
    printf "    Downloaded card: $card_image - $card_numbers\n"
    let card_count=card_count+1
}
## Cleanup temp_card_images.txt and update status
rm temp_card_images.txt
printf "SUCCESS: Downloaded all card images\n\n"

# Download art
## Get list of art images, export to temp file
python3 scry $scryfall_search --print="%{image_uris.art_crop}" > temp_art_images.txt
printf "SUCCESS: Got list of art images\n\n"
printf "START: Download all art images\n"
## Instantiate variable for art filenames
art_count=1
## Download images of all art
for art_image in "${(@f)"$(<temp_art_images.txt)"}"
{
    sleep 0.11
    printf -v art_numbers "%05d" $art_count
    wget -q -O ./images_art/$art_numbers.png $art_image
    printf "    Downloaded art: $art_image - $art_numbers\n"
    let art_count=art_count+1
}
## Cleanup temp_art_images.txt and update status
rm temp_art_images.txt
printf "SUCCESS: Downloaded all art images\n\n"

# Resize all art to consistent size
## It looks messy, but basically it just reads width and height
## And then applies appropriate imagemagick syntax based on those
printf "START: Resizing art images\n"
for input_art in ./images_art/*
{
    # Create variable to set same filename as source image
    export_art_filename=$(printf "$input_art" | sed 's@./images_art/@@')
    # Read width and height of source image
    grid_width=$(identify -ping -format '%w' $input_art)
    grid_height=$(identify -ping -format '%h' $input_art)
    # Resize 'em
    ## If it's too wide and too tall, shrink to fit in these dimensions
    if (( $grid_width > 1142 && $grid_height > 920)) ; then
        convert $input_art -geometry 1142x920 images_resized_art/$export_art_filename
    ## If it's only too wide, shrink to fit by width
    elif (( $grid_width > 1142 )) ; then
        convert $input_art -geometry 1142 images_resized_art/$export_art_filename
    ## If it's only too tall, shrink to fit by height
    elif (( $grid_height > 920 )) ; then
        convert $input_art -geometry x920 images_resized_art/$export_art_filename
    ## If it's too narrow and too short, upscale to fit
    elif (( $grid_width < 1143 && $grid_height < 921 )) ; then\
        convert $input_art -geometry 1142x920 images_resized_art/$export_art_filename
    fi
    printf "    Resized art $input_art...\n"
}

# Remove original art directory and rename new directory to old directory name
rm -rf images_art
mv images_resized_art images_art
printf "SUCCESS: Resized all art images\n\n"

# Overlay cards and art
## Loop through card images and overlay onto background
printf "START: Creating export images\n"
for input_image in ./images_card/*
{
    # Create variable to set same filename as source image
    export_filename=$(printf "$input_image" | sed 's@./images_card/@@')
    # Overlay card image onto background
    magick composite -geometry +210+195 $input_image resources/marble-background.png images_export/$export_filename
    printf "    Overlayed image $input_image...\n"
}
printf "SUCCESS: All export images created\n\n"
## Loop through card art images and overlay onto image
printf "START: Adding art to export images\n"
for input_image in ./images_art/*
{
    # Create variable to set same filename as source image
    export_filename=$(printf "$input_image" | sed 's@./images_art/@@')
    # Read image height and do some math to align it properly
    image_width=$(identify -ping -format '%w' $input_image)
    image_height=$(identify -ping -format '%h' $input_image)
    horizontal_offset=$(( 1000 + ( (1494 - $image_width) / 2 ) ))
    vertical_offset=$(( 70 + ( (940 - $image_height) / 2 ) ))
    # Overlay card art and export image
    magick composite -geometry +$horizontal_offset+$vertical_offset $input_image images_export/$export_filename images_export_w_art/$export_filename
    printf "    Added art to $input_image...\n"
}
printf "SUCCESS: All art export images created\n\n"

# Overlay frames on images and punch transparency hole
## Overlay host image
printf "START: Overlaying host image\n"
for input_image in ./images_export_w_art/*
{
    ## Create variable to set same filename as source image
    export_filename=$(printf "$input_image" | sed 's@./images_export_w_art/@@')
    # Overlay host images
    magick composite -geometry +0+0 resources/host-frames-card-discussion.png $input_image images_export_w_art_and_frame/$export_filename
    printf "    Added host frame to $input_image...\n"
}
## Punch transparency holes
for input_image in ./images_export_w_art_and_frame/*
{
    ## Create variable to set same filename as source image
    export_filename=$(printf "$input_image" | sed 's@./images_export_w_art_and_frame/@@')
    ## Add first transparency box
    convert $input_image \( +clone -fill white -colorize 100 -fill black -draw "rectangle 1010,858 1489,1337" -draw "rectangle 2008,858 2487,1337" \) -alpha off -compose copy_opacity -composite images_export_final/$export_filename
    printf "    Added transparency box 1 to $input_image...\n"
}
printf "SUCCESS: Overlaid host images and transparencies\n"

# Remove temporary export directory and rename
rm -rf images_export
rm -rf images_export_w_art
rm -rf images_export_w_art_and_frame
printf "SUCCESS: All export images created\n\n"

# Create grid image
## Create grid image
cd images_card
montage -density 200 -tile $grid_arrangement -geometry +10+40 -background none *.png grid.png
printf "SUCCESS: Card grid created\n\n"
## Resize grid image conditionally based on size
grid_width=$(identify -ping -format '%w' grid.png)
grid_height=$(identify -ping -format '%h' grid.png)
if (( $grid_width > 2500 && $grid_height > 1400)) ; then
    convert grid.png -geometry 2500x1400 grid_resized.png
elif (( $grid_width > 2500 )) ; then
    convert grid.png -geometry 2500 grid_resized.png
elif (( $grid_height > 1400 )) ; then
    convert grid.png -geometry x1400 grid_resized.png
elif (( $grid_width < 2501 && $grid_height < 1401 )) ; then
    convert grid.png -geometry 2500x1400 grid_resized.png
fi 
## Create composite grid image
cp grid_resized.png ..
cd ..
magick composite -gravity center grid_resized.png resources/title_background.png grid.png
rm grid_resized.png
printf "SUCCESS: Composite grid created\n\n"