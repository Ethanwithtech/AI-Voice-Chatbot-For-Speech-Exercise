{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.nodejs_20
    pkgs.ffmpeg
    pkgs.gcc
    pkgs.pkg-config
  ];
}
