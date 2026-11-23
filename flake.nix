{
  description = "Foundry VTT module development for pf2e";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          # Node 24 is what Foundry v14 and the pf2e toolchain run on.
          packages = [ pkgs.nodejs_24 ];
        };
      });
    };
}
