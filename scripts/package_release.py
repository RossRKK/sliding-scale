"""Package a built module as the module.json and zip a Foundry release serves."""

import json
import zipfile
from pathlib import Path
from typing import Annotated

import typer

app = typer.Typer(add_completion=False)


@app.command()
def main(
    version: Annotated[str, typer.Option(help="release version, e.g. 0.1.0")],
    repository: Annotated[str, typer.Option(help="GitHub owner/name the release is published on")],
    module_dir: Annotated[Path, typer.Option(help="built module directory")] = Path("dist"),
    out_dir: Annotated[Path, typer.Option(help="where the release files are written")] = Path(
        "release"
    ),
) -> None:
    """Write <out-dir>/module.json and <out-dir>/<id>.zip for a GitHub release."""
    package_release(module_dir, out_dir, version, repository)


def package_release(module_dir: Path, out_dir: Path, version: str, repository: str) -> Path:
    """Stamp the version and download URL into the manifest and zip the module with it."""
    manifest = json.loads((module_dir / "module.json").read_text())
    archive_name = f"{manifest['id']}.zip"
    manifest["version"] = version
    manifest["download"] = (
        f"https://github.com/{repository}/releases/download/v{version}/{archive_name}"
    )
    stamped = json.dumps(manifest, indent=4) + "\n"

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "module.json").write_text(stamped)
    archive = out_dir / archive_name
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for path in sorted(module_dir.rglob("*")):
            if path.is_file() and path.name != "module.json":
                zip_file.write(path, path.relative_to(module_dir).as_posix())
        zip_file.writestr("module.json", stamped)
    return archive


if __name__ == "__main__":
    app(prog_name="package-release")
