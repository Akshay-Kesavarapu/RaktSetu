import zlib
import struct
import binascii
import os

def create_png(width, height, draw_func, output_path):
    # RGBA image buffer
    # Each row starts with filter byte 0 followed by width * 4 bytes
    raw_data = bytearray()
    
    for y in range(height):
        raw_data.append(0) # filter byte 0 (None)
        for x in range(width):
            r, g, b, a = draw_func(x, y, width, height)
            raw_data.extend([r, g, b, a])
            
    # PNG signature
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = struct.pack('>I', binascii.crc32(b'IHDR' + ihdr_data) & 0xffffffff)
    png.extend(struct.pack('>I', len(ihdr_data)))
    png.extend(b'IHDR')
    png.extend(ihdr_data)
    png.extend(ihdr_crc)
    
    # IDAT chunk
    compressed_data = zlib.compress(bytes(raw_data), level=9)
    idat_crc = struct.pack('>I', binascii.crc32(b'IDAT' + compressed_data) & 0xffffffff)
    png.extend(struct.pack('>I', len(compressed_data)))
    png.extend(b'IDAT')
    png.extend(compressed_data)
    png.extend(idat_crc)
    
    # IEND chunk
    iend_crc = struct.pack('>I', binascii.crc32(b'IEND') & 0xffffffff)
    png.extend(struct.pack('>I', 0))
    png.extend(b'IEND')
    png.extend(iend_crc)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(png)
    print(f"Generated {output_path} ({width}x{height})")

def vitals_icon(x, y, w, h):
    # Background: Rounded dark navy (#0B1F3A)
    # Center: Red Blood Droplet (#B3261E / #E53935)
    cx, cy = w / 2.0, h / 2.0
    r_max = w / 2.0
    
    # Normalized coordinates (-1 to 1)
    nx = (x - cx) / (w / 2.0)
    ny = (y - cy) / (h / 2.0)
    dist = (nx**2 + ny**2)**0.5
    
    # Rounded squircle background
    squircle = nx**4 + ny**4
    if squircle > 0.85:
        # Transparent outside squircle
        return 0, 0, 0, 0
    elif squircle > 0.80:
        # Anti-aliased border
        alpha = int(255 * (0.85 - squircle) / 0.05)
        return 11, 31, 58, alpha
    
    # Base background: Dark Navy #0B1F3A
    bg_r, bg_g, bg_b = 11, 31, 58
    
    # Draw Blood Droplet inside
    # Droplet top at (0, -0.55), circle at (0, 0.15) with radius 0.40
    # Equation for droplet shape:
    # Circle part:
    circle_dist = (nx**2 + (ny - 0.15)**2)**0.5
    
    # Triangle top part:
    # y between -0.55 and 0.15, |x| <= 0.40 * (y - (-0.55)) / (0.15 - (-0.55))
    is_in_droplet = False
    if circle_dist <= 0.42:
        is_in_droplet = True
    elif -0.58 <= ny <= 0.15:
        max_x = 0.42 * (ny + 0.58) / 0.73
        if abs(nx) <= max_x:
            is_in_droplet = True
            
    if is_in_droplet:
        # Red droplet gradient (#B3261E to #E53935)
        # Highlight near top left
        hl = ((nx + 0.12)**2 + (ny - 0.05)**2)**0.5
        if hl < 0.12:
            return 255, 120, 110, 255
        return 218, 54, 51, 255
        
    return bg_r, bg_g, bg_b, 255

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    public_dir = os.path.join(base_dir, 'frontend', 'public')
    create_png(192, 192, vitals_icon, os.path.join(public_dir, 'icon-192.png'))
    create_png(512, 512, vitals_icon, os.path.join(public_dir, 'icon-512.png'))
