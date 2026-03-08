{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.nodejs_20
    pkgs.ffmpeg
    pkgs.gcc
    pkgs.pkg-config
    pkgs.postgresql
    pkgs.libffi
    pkgs.openssl
  ];
}
