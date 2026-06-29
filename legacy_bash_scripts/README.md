# legacy_bash_scripts/

The original bash implementations of the pipeline, kept as **frozen reference
only**. They are not maintained and should not be extended.

| File | Was |
|---|---|
| `download_images.sh` | Original main pipeline (superseded by `download_images.py`) |
| `booster-builder-bash.sh` | Original booster composer (superseded by `booster_builder.py`) |
| `cleanup.sh` | Original cleanup utility (superseded by `cleanup.py`) |

These use Zsh-specific syntax. The Python versions replaced them; both the bash and
Python layers are now legacy — the future of the repo is the static site (see
`CLAUDE.md` and `docs/website-plan.md`). Mine these for the pipeline's behavior, not
as code to evolve.
