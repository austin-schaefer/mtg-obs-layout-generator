#!/usr/bin/env python3
"""
Booster Builder

Determines and builds Magic: The Gathering booster pack composition based on set code.
Handles historical set variations and modern booster structures.
"""

import sys
import random
import subprocess
from pathlib import Path
from dataclasses import dataclass


@dataclass
class BoosterConfig:
    """Configuration for a Magic: The Gathering booster pack."""
    commons: int
    uncommons: int
    rares: int
    mythics: int
    tsb_cards: int
    layout: str

    def __str__(self) -> str:
        """Return a human-readable description of the booster."""
        parts = [
            f"{self.commons} commons",
            f"{self.uncommons} uncommons",
            f"{self.rares} rares",
            f"{self.mythics} mythics"
        ]
        if self.tsb_cards > 0:
            parts.append(f"{self.tsb_cards} timeshifted")
        return ", ".join(parts)


@dataclass
class Card:
    """A card with its image URLs."""
    card_url: str
    art_url: str


class BoosterBuilder:
    """Builds booster pack configurations based on Magic: The Gathering set codes."""

    # Special odd-structure old sets
    ARABIAN_ANTIQUITIES = {'ARN', 'ATQ'}
    DARK_FALLEN_HOMELANDS = {'DRK', 'FEM', 'HML'}
    ALLIANCES_CHRONICLES = {'ALL', 'CHR'}
    UNGLUED = {'UGL'}
    EARLY_CORE_SETS = {'7ED', '8ED', '9ED'}
    TIME_SPIRAL = {'TSP'}

    # Pre-mythic standard boosters
    PRE_MYTHIC_SETS = {
        'LEA', 'LEB', '2ED', '3ED', 'ICE', 'MIR', 'VIS', 'WTH', 'TMP', 'STH',
        'EXO', 'USG', 'ULG', 'UDS', 'MMQ', 'NMS', 'PCY', 'INV', 'PLS', 'APC',
        'ONS', 'LGN', 'SCG', 'MRD', 'DST', '5DN', 'CHK', 'BOK', 'SOK', 'RAV',
        'GPT', 'DIS', 'CSP', 'PLC', 'FUT', '10E', 'POR', 'PO2', 'P3K', 'PTK',
        'UNH'
    }

    def __init__(self, set_code: str):
        self.set_code = set_code

    def run_scry(self, query: str, print_format: str) -> list[str]:
        """Query Scryfall using the scry tool."""
        result = subprocess.run(
            ['python3', 'scry', query, f'--print={print_format}'],
            check=True,
            capture_output=True,
            text=True
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]

    def get_cards_by_rarity(self, rarity: str, count: int) -> list[Card]:
        """Get N random cards of a specific rarity from the set."""
        if count == 0:
            return []

        # Query for cards of this rarity in this set (excluding basic lands)
        query = f"e:{self.set_code.lower()} r:{rarity} -t:basic"

        # Get both card and art URLs
        card_urls = self.run_scry(query, '%{image_uris.png}')
        art_urls = self.run_scry(query, '%{image_uris.art_crop}')

        if len(card_urls) != len(art_urls):
            raise ValueError(f"Mismatch between card and art URL counts for {rarity}")

        # Create Card objects
        all_cards = [Card(card, art) for card, art in zip(card_urls, art_urls)]

        if len(all_cards) < count:
            raise ValueError(f"Not enough {rarity}s in set {self.set_code}: need {count}, found {len(all_cards)}")

        # Select random cards without duplicates
        selected = random.sample(all_cards, count)

        # Randomize order within rarity
        random.shuffle(selected)

        return selected

    def get_tsb_cards(self, count: int) -> list[Card]:
        """Get random timeshifted cards."""
        if count == 0:
            return []

        query = "e:tsb"
        card_urls = self.run_scry(query, '%{image_uris.png}')
        art_urls = self.run_scry(query, '%{image_uris.art_crop}')

        all_cards = [Card(card, art) for card, art in zip(card_urls, art_urls)]

        if len(all_cards) < count:
            raise ValueError(f"Not enough TSB cards: need {count}, found {len(all_cards)}")

        selected = random.sample(all_cards, count)
        random.shuffle(selected)

        return selected

    def build_booster_config(self) -> BoosterConfig:
        """
        Determine booster configuration based on set code.

        Returns:
            BoosterConfig with card counts and layout
        """
        set_code = self.set_code

        # Arabian Nights, Antiquities — 8 cards
        if set_code in self.ARABIAN_ANTIQUITIES:
            return BoosterConfig(
                commons=6,
                uncommons=2,
                rares=0,
                mythics=0,
                tsb_cards=0,
                layout="4x0"
            )

        # The Dark, Fallen Empires, Homelands — 8 cards with randomized slots
        elif set_code in self.DARK_FALLEN_HOMELANDS:
            commons = 6
            uncommons = 0
            rares = 0

            # Two slots with 1/3 chance of rare, otherwise uncommon
            for _ in range(2):
                if random.randint(0, 2) == 0:
                    rares += 1
                else:
                    uncommons += 1

            return BoosterConfig(
                commons=commons,
                uncommons=uncommons,
                rares=rares,
                mythics=0,
                tsb_cards=0,
                layout="5x0"
            )

        # Alliances and Chronicles — 12 cards
        elif set_code in self.ALLIANCES_CHRONICLES:
            return BoosterConfig(
                commons=8,
                uncommons=3,
                rares=1,
                mythics=0,
                tsb_cards=0,
                layout="6x0"
            )

        # Unglued — 10 cards
        elif set_code in self.UNGLUED:
            return BoosterConfig(
                commons=6,
                uncommons=2,
                rares=1,
                mythics=0,
                tsb_cards=0,
                layout="5x0"
            )

        # Early core sets — 14 cards (1 basic land replaces 1 common)
        elif set_code in self.EARLY_CORE_SETS:
            return BoosterConfig(
                commons=10,
                uncommons=3,
                rares=1,
                mythics=0,
                tsb_cards=0,
                layout="7x0"
            )

        # Time Spiral — has timeshifted sheet
        elif set_code in self.TIME_SPIRAL:
            return BoosterConfig(
                commons=10,
                uncommons=3,
                rares=1,
                mythics=0,
                tsb_cards=1,
                layout="5x0"
            )

        # Pre-mythic standard boosters — 15 cards, no mythics
        elif set_code in self.PRE_MYTHIC_SETS:
            return BoosterConfig(
                commons=11,
                uncommons=3,
                rares=1,
                mythics=0,
                tsb_cards=0,
                layout="5x0"
            )

        # Default modern draft booster with mythic odds ~1:8
        else:
            # Rare slot with mythic chance: 1 in 8 is mythic
            if random.randint(0, 7) == 0:
                mythics = 1
                rares = 0
            else:
                mythics = 0
                rares = 1

            return BoosterConfig(
                commons=10,
                uncommons=3,
                rares=rares,
                mythics=mythics,
                tsb_cards=0,
                layout="7x0"
            )

    def build_booster(self) -> tuple[list[Card], str]:
        """
        Build a complete booster pack with actual cards.

        Returns:
            Tuple of (list of cards in order, grid layout)
        """
        config = self.build_booster_config()

        print(f"{self.set_code} booster contents: {config}")
        print(f"Booster layout: {config.layout}\n")

        # Build booster in order: commons, uncommons, rares, mythics, TSB
        booster = []

        print("Building booster...")
        if config.commons > 0:
            print(f"  Selecting {config.commons} commons...")
            booster.extend(self.get_cards_by_rarity('common', config.commons))

        if config.uncommons > 0:
            print(f"  Selecting {config.uncommons} uncommons...")
            booster.extend(self.get_cards_by_rarity('uncommon', config.uncommons))

        if config.rares > 0:
            print(f"  Selecting {config.rares} rares...")
            booster.extend(self.get_cards_by_rarity('rare', config.rares))

        if config.mythics > 0:
            print(f"  Selecting {config.mythics} mythics...")
            booster.extend(self.get_cards_by_rarity('mythic', config.mythics))

        if config.tsb_cards > 0:
            print(f"  Selecting {config.tsb_cards} timeshifted cards...")
            booster.extend(self.get_tsb_cards(config.tsb_cards))

        print(f"✓ Built booster with {len(booster)} cards\n")

        return booster, config.layout

    def save_booster(self, booster: list[Card], output_dir: Path = Path.cwd()):
        """Save booster URLs to files for download_images.py to use."""
        card_urls_file = output_dir / 'booster_card_urls.txt'
        art_urls_file = output_dir / 'booster_art_urls.txt'

        with open(card_urls_file, 'w') as f:
            for card in booster:
                f.write(f"{card.card_url}\n")

        with open(art_urls_file, 'w') as f:
            for card in booster:
                f.write(f"{card.art_url}\n")

        print(f"✓ Saved booster to {card_urls_file} and {art_urls_file}\n")


def main():
    """Main entry point."""
    try:
        # Check if set code was provided as command line argument
        if len(sys.argv) > 1:
            set_code = sys.argv[1].upper()
        else:
            set_code = input("Enter a set code: ").strip().upper()

        print()

        builder = BoosterBuilder(set_code)
        booster, layout = builder.build_booster()
        builder.save_booster(booster)

        # Return the layout for download_images.py to use
        print(f"LAYOUT:{layout}")

    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
