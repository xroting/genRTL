#!/usr/bin/env python3
"""
Convert av_logo.png to high-quality icon formats for genRTL
Creates proper multi-size ICO files with embedded PNG data
"""

from PIL import Image
import os
import struct
import io

def make_square(img):
    """Center image on a square transparent canvas"""
    width, height = img.size
    size = max(width, height)
    square = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    x = (size - width) // 2
    y = (size - height) // 2
    square.paste(img, (x, y), img if img.mode == 'RGBA' else None)
    return square

def create_ico(images, output_path):
    """Create ICO file with proper multi-size PNG support"""
    num_images = len(images)

    # ICO header size and entry size
    header_size = 6
    entry_size = 16
    data_offset = header_size + (entry_size * num_images)

    # Prepare image data as PNG (better quality than BMP in ICO)
    image_data = []
    for img in images:
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        image_data.append(buffer.getvalue())

    # Write ICO file
    with open(output_path, 'wb') as f:
        # Header: reserved (2), type=1 (2), count (2)
        f.write(struct.pack('<HHH', 0, 1, num_images))

        # Directory entries
        offset = data_offset
        for i, img in enumerate(images):
            w = img.size[0] if img.size[0] < 256 else 0
            h = img.size[1] if img.size[1] < 256 else 0
            size = len(image_data[i])
            # width, height, colors, reserved, planes, bpp, size, offset
            f.write(struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, size, offset))
            offset += size

        # Image data
        for data in image_data:
            f.write(data)

    file_size = os.path.getsize(output_path)
    print(f"  Created: {output_path} ({file_size:,} bytes)")

def convert_to_png_sizes(img, output_dir):
    """Save image at various sizes for Linux"""
    sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

    for size in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        output_path = os.path.join(output_dir, f'code_{size}.png')
        resized.save(output_path, 'PNG', optimize=True)

    print(f"  Created {len(sizes)} PNG sizes in {output_dir}")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_logo = os.path.join(script_dir, 'av_logo.png')

    if not os.path.exists(input_logo):
        print(f"Error: {input_logo} not found!")
        return 1

    print("=" * 60)
    print("Converting genRTL logo to high-quality icons")
    print("=" * 60)

    # Load and prepare source image
    img = Image.open(input_logo)
    print(f"\nSource: {img.size[0]}x{img.size[1]} pixels, Mode: {img.mode}")

    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # Make square if needed
    if img.size[0] != img.size[1]:
        img = make_square(img)
        print(f"Squared to: {img.size[0]}x{img.size[1]}")

    # Generate all icon sizes
    ico_sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
    icons = []
    for size in ico_sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        icons.append(resized)

    # ICO locations
    ico_locations = [
        os.path.join(script_dir, 'vscode', 'resources', 'win32'),
        os.path.join(script_dir, 'src', 'stable', 'resources', 'win32'),
        os.path.join(script_dir, 'src', 'insider', 'resources', 'win32'),
    ]

    print("\n[1/3] Creating Windows ICO files...")
    for win32_dir in ico_locations:
        if os.path.exists(win32_dir):
            ico_path = os.path.join(win32_dir, 'code.ico')
            create_ico(icons, ico_path)

    print("\n[2/3] Creating Windows tile PNGs...")
    for win32_dir in ico_locations:
        if os.path.exists(win32_dir):
            for size in [70, 150]:
                resized = img.resize((size, size), Image.Resampling.LANCZOS)
                png_path = os.path.join(win32_dir, f'code_{size}x{size}.png')
                resized.save(png_path, 'PNG', optimize=True)
                print(f"  Created: {png_path}")

    print("\n[3/3] Creating Linux PNG icons...")
    linux_dirs = [
        os.path.join(script_dir, 'vscode', 'resources', 'linux'),
        os.path.join(script_dir, 'src', 'stable', 'resources', 'linux'),
        os.path.join(script_dir, 'src', 'insider', 'resources', 'linux'),
    ]

    for linux_dir in linux_dirs:
        if os.path.exists(linux_dir):
            convert_to_png_sizes(img, linux_dir)

    print("\n" + "=" * 60)
    print("Icon conversion completed!")
    print("=" * 60)
    print(f"\nICO files contain {len(ico_sizes)} sizes: {ico_sizes}")
    print("Run './dev/build.sh -n' to rebuild with the new icons.")

    return 0

if __name__ == '__main__':
    exit(main())
