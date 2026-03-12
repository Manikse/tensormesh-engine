import struct
import os

class TensorStreamer:
    """
    True O(1) memory, single-pass streaming engine for binary STL files.
    Decodes binary data and calculates volume/area on the fly, storing zero geometry.
    """
    @staticmethod
    def analyze_mesh(file_path: str) -> dict:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Matrix file missing: {file_path}")

        file_size = os.path.getsize(file_path)
        total_volume = 0.0
        total_surface_area = 0.0

        with open(file_path, 'rb') as file:
            # Bypass 80-byte header
            file.read(80)
            
            # Extract triangle count
            triangle_count = struct.unpack('<I', file.read(4))[0]
            
            # Security check: Validate STL size to prevent silent failures on malformed files
            expected_size = 84 + (triangle_count * 50)
            if file_size < expected_size:
                raise ValueError("Malformed STL: Binary payload does not match triangle count.")

            # Single-pass streaming loop
            for _ in range(triangle_count):
                data = file.read(50)
                if len(data) != 50:
                    break
                
                # Unpack directly to primitive floats (ignoring normals as they are often unnormalized in CAD)
                unpacked = struct.unpack('<12fH', data)
                v1x, v1y, v1z = unpacked[3:6]
                v2x, v2y, v2z = unpacked[6:9]
                v3x, v3y, v3z = unpacked[9:12]

                # --- 1. Surface Area Integration ---
                abx, aby, abz = v2x - v1x, v2y - v1y, v2z - v1z
                acx, acy, acz = v3x - v1x, v3y - v1y, v3z - v1z
                
                cross_x = aby * acz - abz * acy
                cross_y = abz * acx - abx * acz
                cross_z = abx * acy - aby * acx
                
                area = 0.5 * (cross_x**2 + cross_y**2 + cross_z**2)**0.5
                total_surface_area += area

                # --- 2. Volume Integration (Signed Volume of Tetrahedron) ---
                v2_cross_v3_x = v2y * v3z - v2z * v3y
                v2_cross_v3_y = v2z * v3x - v2x * v3z
                v2_cross_v3_z = v2x * v3y - v2y * v3x
                
                dot_product = v1x * v2_cross_v3_x + v1y * v2_cross_v3_y + v1z * v2_cross_v3_z
                total_volume += dot_product / 6.0

        return {
            "triangle_count": triangle_count,
            "volume_mm3": round(abs(total_volume), 4),
            "surface_area_mm2": round(total_surface_area, 4)
        }