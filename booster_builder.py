#!/usr/bin/env python3
"""
Booster Builder

Determines Magic: The Gathering booster pack composition based on set code.
Handles historical set variations and modern booster structures.
"""

import sys
import random
from typing import Dict, Tuple
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

    def total_cards(self) -> int:
        """Calculate total number of cards in the booster."""
        return self.commons + self.uncommons + self.rares + self.mythics + self.tsb_cards

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

    def __init__(self):
        pass

    def get_set_code(self) -> str:
        """Prompt user for set code and normalize to uppercase."""
        set_code = input("Enter a set code: ").strip().upper()
        print()
        return set_code

    def build_booster_config(self, set_code: str) -> BoosterConfig:
        """
        Determine booster configuration based on set code.

        Args:
            set_code: Magic set code (e.g., 'NEO', 'ARN', 'TSP')

        Returns:
            BoosterConfig with card counts and layout
        """
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

    def print_booster_info(self, set_code: str, config: BoosterConfig):
        """Print booster configuration information."""
        print(f"{set_code} booster contents: {config}")
        print(f"Booster layout: {config.layout}")

    def run(self):
        """Execute the booster builder workflow."""
        set_code = self.get_set_code()
        config = self.build_booster_config(set_code)
        self.print_booster_info(set_code, config)
        return config


def main():
    """Main entry point."""
    builder = BoosterBuilder()

    try:
        builder.run()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
