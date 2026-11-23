"""Run a local Foundry server with a built module linked into its data directory."""

import json
import os
from pathlib import Path
from typing import Annotated

import typer

app = typer.Typer(add_completion=False)


@app.command(context_settings={"allow_extra_args": True, "ignore_unknown_options": True})
def main(
    ctx: typer.Context,
    data_dir: Annotated[Path, typer.Argument(help="Foundry user data directory")],
    module_dir: Annotated[Path, typer.Argument(help="built module directory (has module.json)")],
    foundry: Annotated[Path, typer.Option(help="foundryvtt executable")],
) -> None:
    """Run a local Foundry server with a built module linked into its data directory.

    Extra options (e.g. --port=30001) are passed through to Foundry.
    """
    data_dir = data_dir.resolve()
    try:
        link_module(data_dir, module_dir.resolve())
    except MissingManifestError as error:
        raise SystemExit(f"run-foundry: {error}; build the module first (npm run build)")

    os.execv(foundry, [str(foundry), f"--dataPath={data_dir}", "--noupnp", "--noupdate", *ctx.args])


class MissingManifestError(Exception):
    pass


def link_module(data_dir: Path, module_dir: Path) -> Path:
    """Symlink module_dir into data_dir's modules, named by its manifest id, replacing any old link."""
    manifest = module_dir / "module.json"
    if not manifest.is_file():
        raise MissingManifestError(f"{manifest} not found")
    module_id = json.loads(manifest.read_text())["id"]

    link = data_dir / "Data" / "modules" / module_id
    link.parent.mkdir(parents=True, exist_ok=True)
    # A link, not a copy, so watch rebuilds show up on a browser reload.
    staged = link.with_name(f".{module_id}.link")
    staged.unlink(missing_ok=True)
    staged.symlink_to(module_dir, target_is_directory=True)
    os.replace(staged, link)
    return link


if __name__ == "__main__":
    app(prog_name="run-foundry")
