"""Install (or replace) the Foundry system or module a manifest URL describes."""

import enum
import json
import shutil
import tempfile
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

import typer


class PackageKind(str, enum.Enum):
    SYSTEM = "systems"
    MODULE = "modules"

    @property
    def manifest_name(self) -> str:
        return {PackageKind.SYSTEM: "system.json", PackageKind.MODULE: "module.json"}[self]


@dataclass(frozen=True)
class PackageManifest:
    id: str
    version: str
    download: str

    @classmethod
    def parse(cls, raw: dict) -> "PackageManifest":
        return cls(id=raw["id"], version=raw["version"], download=raw["download"])


class InvalidPackageError(Exception):
    pass


app = typer.Typer(add_completion=False)


@app.command()
def main(
    data_dir: Annotated[Path, typer.Argument(help="Foundry user data directory")],
    kind: Annotated[PackageKind, typer.Argument(help="whether the package is a system or module")],
    manifest_url: Annotated[str, typer.Argument(help="URL of the package's manifest json")],
) -> None:
    """Install (or replace) the Foundry system or module a manifest URL describes."""
    with urllib.request.urlopen(manifest_url) as response:
        manifest = PackageManifest.parse(json.load(response))
    print(f"Installing {kind.value}/{manifest.id} {manifest.version} from {manifest.download}")

    with tempfile.TemporaryDirectory() as scratch:
        archive = Path(scratch) / "package.zip"
        with urllib.request.urlopen(manifest.download) as response, archive.open("wb") as out:
            shutil.copyfileobj(response, out)
        try:
            target = install(data_dir.resolve(), kind, manifest.id, archive)
        except InvalidPackageError as error:
            raise SystemExit(f"install-foundry-package: {error}")
    print(f"Installed to {target}")


def install(data_dir: Path, kind: PackageKind, package_id: str, archive: Path) -> Path:
    """Unpack archive as data_dir/Data/<kind>/<package_id>, leaving any old install if it is invalid."""
    packages_dir = data_dir / "Data" / kind.value
    packages_dir.mkdir(parents=True, exist_ok=True)
    target = packages_dir / package_id

    # Staged beside the target so the final move is a rename on the same filesystem.
    with tempfile.TemporaryDirectory(dir=packages_dir, prefix=f".{package_id}.") as staging:
        unpacked = Path(staging) / package_id
        with zipfile.ZipFile(archive) as zip_file:
            zip_file.extractall(unpacked)
        check_manifest(unpacked / kind.manifest_name, package_id)
        shutil.rmtree(target, ignore_errors=True)
        unpacked.rename(target)
    return target


def check_manifest(manifest: Path, package_id: str) -> None:
    if not manifest.is_file():
        raise InvalidPackageError(f"archive has no {manifest.name} at its root")
    found_id = json.loads(manifest.read_text()).get("id")
    if found_id != package_id:
        raise InvalidPackageError(f"archive is package {found_id!r}, expected {package_id!r}")


if __name__ == "__main__":
    app(prog_name="install-foundry-package")
