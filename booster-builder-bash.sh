#!/usr/bin/env bash

# Get a set code
read -p "Enter a set code: " set_code
set_code="$(echo "$set_code" | tr '[:lower:]' '[:upper:]')"  # Uppercase normalize input

# Set all variables to 0
commons=0
uncommons=0
rares=0
mythics=0
tsb_cards=0

# Figure out how many cards in the booster
case "$set_code" in

    ### === 1. SPECIAL ODD-STRUCTURE OLD SETS ===

    # Arabian Nights (ARN), Antiquities (ATQ) — 6C / 2U (no true rare slot)
    ARN|ATQ)
        commons=6; uncommons=2; rares=0; mythics=0
    ;;

    # The Dark (DRK) , Fallen Empires, Homelands - weird subsheet logic, roughly simplified
    DRK|FEM|HML)
        commons=6; uncommons=0; rares=0; mythics=0

        for slot in 1 2; do
            if (( RANDOM % 100 < 34 )); then
                rares=$((rares + 1))
            else
                uncommons=$((uncommons + 1))
            fi
        done
    ;;

    # Alliances and Chronicles - 12 cards
    ALL|CHR)
        commons=8; uncommons=3; rares=1; mythics=0
    ;;

    # Unglued - 10 cards
    UGL)
        commons=6; uncommons=2; rares=1; mythics=0
    ;;

    # Core sets for a while had 1 basic replace 1 common
    7ED|8ED|9ED)
        commons=10; uncommons=3; rares=1; mythics=0
    ;;

    # Time Spiral has the timeshifted sheet
    TSP)
        commons=10; uncommons=3; rares=1; mythics=0
        tsb_cards=1
    ;;

    ### === 2. EXPLICIT NO-MYTHIC 11/3/1 STANDARD BOOSTERS ===
    # Everything here has standard booster structure but predates mythics.
    # Or in some cases

    LEA|LEB|2ED|3ED|ICE|MIR|VIS|WTH|TMP|STH|EXO|USG|ULG|UDS|MMQ|NMS|PCY|INV|PLS|APC|ONS|LGN|SCG|MRD|DST|5DN|CHK|BOK|SOK|RAV|GPT|DIS|CSP|PLC|FUT|10E|POR|PO2|P3K|PTK|UNH)
        commons=11; uncommons=3; rares=1; mythics=0
    ;;

    ### === 3. DEFAULT — SET HAS MYTHICS ===
    # Default modern draft booster with mythic odds ~1:8

    *)
        commons=10
        uncommons=3

        # Rare slot with mythic chance: 1 in 8 mythic
        if (( RANDOM % 8 == 0 )); then
            mythics=1
            rares=0
        else
            rares=1
            mythics=0
        fi
    ;;
esac

# Print # of cards in the booster as a sanity-check
echo -n "$set_code booster contents: $commons commons, $uncommons uncommons, $rares rares, $mythics mythics"
[ "$tsb_cards" -ne 0 ] && echo -n ", $tsb_cards timeshifted"
echo