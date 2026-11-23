import json
import zipfile
from pathlib import Path

import pytest

from install_foundry_package import InvalidPackageError, PackageKind, install


def make_archive(path: Path, files: dict[str, str]) -> Path:
    with zipfile.ZipFile(path, "w") as zip_file:
        for name, content in files.items():
            zip_file.writestr(name, content)
    return path


def system_archive(tmp_path: Path, package_id: str, extra: dict[str, str] | None = None) -> Path:
    files = {"system.json": json.dumps({"id": package_id}), **(extra or {})}
    return make_archive(tmp_path / f"{package_id}.zip", files)


def test_installs_into_data_dir_by_kind_and_id(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    archive = system_archive(tmp_path, "pf2e", {"lang/en.json": "{}"})

    target = install(data_dir, PackageKind.SYSTEM, "pf2e", archive)

    assert target == data_dir / "Data" / "systems" / "pf2e"
    assert (target / "system.json").is_file()
    assert (target / "lang" / "en.json").is_file()


def test_replaces_an_existing_install(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    install(data_dir, PackageKind.SYSTEM, "pf2e", system_archive(tmp_path, "pf2e", {"old.txt": ""}))

    target = install(data_dir, PackageKind.SYSTEM, "pf2e", system_archive(tmp_path, "pf2e"))

    assert not (target / "old.txt").exists()
    assert sorted(p.name for p in target.parent.iterdir()) == ["pf2e"]


@pytest.mark.parametrize(
    ("files", "message"),
    [
        ({"pf2e/system.json": json.dumps({"id": "pf2e"})}, "no system.json at its root"),
        ({"system.json": json.dumps({"id": "sf2e"})}, "expected 'pf2e'"),
    ],
)
def test_rejects_invalid_archive_and_keeps_existing_install(
    tmp_path: Path, files: dict[str, str], message: str
) -> None:
    data_dir = tmp_path / "data"
    install(
        data_dir, PackageKind.SYSTEM, "pf2e", system_archive(tmp_path, "pf2e", {"keep.txt": ""})
    )

    with pytest.raises(InvalidPackageError, match=message):
        install(data_dir, PackageKind.SYSTEM, "pf2e", make_archive(tmp_path / "bad.zip", files))

    systems = data_dir / "Data" / "systems"
    assert (systems / "pf2e" / "keep.txt").is_file()
    assert sorted(p.name for p in systems.iterdir()) == ["pf2e"]


def test_modules_use_module_manifest(tmp_path: Path) -> None:
    archive = make_archive(
        tmp_path / "m.zip", {"module.json": json.dumps({"id": "sf2e-anachronism"})}
    )

    target = install(tmp_path, PackageKind.MODULE, "sf2e-anachronism", archive)

    assert target == tmp_path / "Data" / "modules" / "sf2e-anachronism"
