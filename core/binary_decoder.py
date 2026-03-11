import struct
import os

class BinaryMeshDecoder:
    """
    Directly parses binary .stl streams into continuous memory arrays.
    Bypasses standard 3D libraries to ensure zero-latency execution.
    """
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.triangles = []
        
    def decode(self) -> list:
        """
        Extracts normal vectors and geometric vertices from the binary matrix.
        """
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Matrix file missing: {self.file_path}")

        with open(self.file_path, 'rb') as file:
            # Bypass 80-byte header
            file.read(80)
            
            # Extract unsigned 32-bit integer for triangle count
            triangle_count = struct.unpack('<I', file.read(4))[0]
            
            for _ in range(triangle_count):
                # 50 bytes per triangle: 12 bytes normal, 36 bytes vertices, 2 bytes attribute
                data = file.read(50)
                if len(data) != 50:
                    break
                
                unpacked_data = struct.unpack('<12fH', data)
                
                # Normal vector (nx, ny, nz)
                normal = unpacked_data[0:3]
                # Vertices (v1, v2, v3)
                v1 = unpacked_data[3:6]
                v2 = unpacked_data[6:9]
                v3 = unpacked_data[9:12]
                
                self.triangles.append({
                    "normal": normal,
                    "vertices": [v1, v2, v3]
                })
                
        return self.triangles