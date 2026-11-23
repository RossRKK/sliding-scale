{
  description = "Foundry VTT module development for pf2e";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    # Same Foundry packaging as the styx server in chaos.nix. It uses requireFile,
    # so the licensed zip must be added to the store once (see README).
    foundryvtt = {
      url = "github:reckenrode/nix-foundryvtt";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, foundryvtt }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system nixpkgs.legacyPackages.${system});
      # Python packages the scripts/ CLIs import.
      scriptPythonPackages = ps: [ ps.typer ];
    in
    {
      packages = forAllSystems (system: pkgs: rec {
        # Pinned to the build the styx server runs, so local testing matches it.
        foundry = foundryvtt.packages.${system}.foundryvtt_14.overrideAttrs { build = "364"; };

        run-foundry = pkgs.writeShellScriptBin "run-foundry" ''
          exec ${pkgs.python3.withPackages scriptPythonPackages}/bin/python3 ${./scripts/run_foundry.py} --foundry ${foundry}/bin/foundryvtt "$@"
        '';
      });

      devShells = forAllSystems (system: pkgs: {
        default = pkgs.mkShell {
          packages = [
            # Node 24 is what Foundry v14 and the pf2e toolchain run on.
            pkgs.nodejs_24
            (pkgs.python3.withPackages (ps: scriptPythonPackages ps ++ [ ps.pytest ]))
            pkgs.ruff
            self.packages.${system}.run-foundry
          ];
        };
      });
    };
}
